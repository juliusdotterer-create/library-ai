import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function findUserByEmail(email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

export const lookupTransferTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string }) => input)
  .handler(async ({ data, context }) => {
    const user = await findUserByEmail(data.email);
    if (!user) return { found: false as const };
    if (user.id === context.userId) return { found: false as const, self: true };
    return { found: true as const, email: user.email ?? data.email };
  });

export const transferAccountData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; confirm: string }) => input)
  .handler(async ({ data, context }) => {
    if (data.confirm.trim().toUpperCase() !== "ÜBERTRAGEN") {
      throw new Error("Bestätigung fehlt.");
    }
    const target = await findUserByEmail(data.email);
    if (!target) throw new Error("Kein registrierter Account mit dieser E-Mail gefunden.");
    if (target.id === context.userId) throw new Error("Das ist dein eigener Account.");

    const src = context.supabase; // RLS: nur eigene Daten
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = target.id;

    // Seitenweise laden: der Datenzugriff liefert pro Abfrage max. 1000 Zeilen
    const grab = async <T,>(table: string, cols: string) => {
      const page = 1000;
      const all: unknown[] = [];
      for (let from = 0; ; from += page) {
        const { data: rows, error } = await src
          .from(table as never)
          .select(cols)
          .range(from, from + page - 1);
        if (error) throw new Error(`${table}: ${error.message}`);
        const batch = rows ?? [];
        all.push(...batch);
        if (batch.length < page) break;
      }
      return all as T[];
    };

    const insertAll = async (table: string, rows: Record<string, unknown>[]) => {
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabaseAdmin
          .from(table as never)
          .insert(rows.slice(i, i + 200) as never);
        if (error) throw new Error(`${table}: ${error.message}`);
      }
    };

    // ---- Ordner (Hierarchie erhalten)
    type F = { id: string; parent_id: string | null; name: string; color: string | null; deleted_at: string | null };
    const folders = (await grab<F>("folders", "id,parent_id,name,color,deleted_at")).filter(
      (f) => !f.deleted_at,
    );
    const folderMap = new Map<string, string>();
    folders.forEach((f) => folderMap.set(f.id, crypto.randomUUID()));

    // Eltern zuerst einfügen (sonst verletzt der Verweis auf den Elternordner die Fremdschlüssel-Regel)
    const byId = new Map(folders.map((f) => [f.id, f]));
    const depthOf = (f: F) => {
      let depth = 0;
      let cur: F | undefined = f;
      const seen = new Set<string>();
      while (cur?.parent_id && byId.has(cur.parent_id) && !seen.has(cur.id)) {
        seen.add(cur.id);
        cur = byId.get(cur.parent_id);
        depth++;
        if (depth > 50) break;
      }
      return depth;
    };
    const levels = new Map<number, F[]>();
    for (const f of folders) {
      const d = depthOf(f);
      levels.set(d, [...(levels.get(d) ?? []), f]);
    }
    for (const depth of [...levels.keys()].sort((a, b) => a - b)) {
      await insertAll(
        "folders",
        (levels.get(depth) ?? []).map((f) => ({
          id: folderMap.get(f.id),
          user_id: uid,
          parent_id: f.parent_id ? (folderMap.get(f.parent_id) ?? null) : null,
          name: f.name,
          color: f.color,
        })),
      );
    }


    // ---- Dokumente inkl. Dateien im Speicher
    type D = {
      id: string;
      folder_id: string | null;
      name: string;
      storage_path: string;
      mime_type: string | null;
      size_bytes: number | null;
      kind: string;
      deleted_at: string | null;
    };
    const docs = (
      await grab<D>("documents", "id,folder_id,name,storage_path,mime_type,size_bytes,kind,deleted_at")
    ).filter((d) => !d.deleted_at);

    const docMap = new Map<string, string>();
    const docRows: Record<string, unknown>[] = [];
    let filesCopied = 0;
    let filesFailed = 0;
    for (const d of docs) {
      const newId = crypto.randomUUID();
      const safe = d.name.replace(/[^\w.\-]/g, "_");
      const newPath = `${uid}/${crypto.randomUUID()}-${safe}`;
      const { error } = await supabaseAdmin.storage.from("documents").copy(d.storage_path, newPath);
      if (error) {
        filesFailed++;
        continue;
      }
      filesCopied++;
      docMap.set(d.id, newId);
      docRows.push({
        id: newId,
        user_id: uid,
        folder_id: d.folder_id ? (folderMap.get(d.folder_id) ?? null) : null,
        name: d.name,
        storage_path: newPath,
        mime_type: d.mime_type,
        size_bytes: d.size_bytes,
        kind: d.kind,
      });
    }
    await insertAll("documents", docRows);

    // ---- Termine
    type E = {
      title: string;
      notes: string | null;
      start_at: string;
      end_at: string | null;
      all_day: boolean;
      color: string | null;
      document_id: string | null;
    };
    const events = await grab<E>("events", "title,notes,start_at,end_at,all_day,color,document_id");
    await insertAll(
      "events",
      events.map((e) => ({
        user_id: uid,
        title: e.title,
        notes: e.notes,
        start_at: e.start_at,
        end_at: e.end_at,
        all_day: e.all_day,
        color: e.color,
        document_id: e.document_id ? (docMap.get(e.document_id) ?? null) : null,
      })),
    );

    // ---- Lehrpläne + Aufgaben
    type P = { id: string; title: string; description: string | null; start_date: string | null; end_date: string | null };
    const plans = await grab<P>("study_plans", "id,title,description,start_date,end_date");
    const planMap = new Map<string, string>();
    plans.forEach((p) => planMap.set(p.id, crypto.randomUUID()));
    await insertAll(
      "study_plans",
      plans.map((p) => ({
        id: planMap.get(p.id),
        user_id: uid,
        title: p.title,
        description: p.description,
        start_date: p.start_date,
        end_date: p.end_date,
      })),
    );

    type T = {
      plan_id: string;
      title: string;
      notes: string | null;
      due_date: string | null;
      status: string;
      document_id: string | null;
      position: number;
    };
    const tasks = await grab<T>("study_tasks", "plan_id,title,notes,due_date,status,document_id,position");
    await insertAll(
      "study_tasks",
      tasks
        .filter((t) => planMap.has(t.plan_id))
        .map((t) => ({
          user_id: uid,
          plan_id: planMap.get(t.plan_id),
          title: t.title,
          notes: t.notes,
          due_date: t.due_date,
          status: t.status,
          document_id: t.document_id ? (docMap.get(t.document_id) ?? null) : null,
          position: t.position,
        })),
    );

    // ---- Links
    type L = { title: string; url: string; description: string | null; position: number };
    const links = await grab<L>("links", "title,url,description,position");
    await insertAll(
      "links",
      links.map((l) => ({
        user_id: uid,
        title: l.title,
        url: l.url,
        description: l.description,
        position: l.position,
      })),
    );

    return {
      ok: true as const,
      email: target.email ?? data.email,
      folders: folders.length,
      documents: docRows.length,
      filesCopied,
      filesFailed,
      events: events.length,
      plans: plans.length,
      tasks: tasks.length,
      links: links.length,
    };
  });
