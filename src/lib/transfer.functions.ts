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

/** Stabile Ziel-ID aus Quell-ID + Ziel-Account: erlaubt Fortsetzen ohne Duplikate. */
async function detUuid(seed: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed));
  const b = new Uint8Array(buf).slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

type Client = { from: (t: never) => any };

async function grab<T>(src: Client, table: string, cols: string, order?: string) {
  const page = 1000;
  const all: T[] = [];
  for (let from = 0; ; from += page) {
    let q = src
      .from(table as never)
      .select(cols)
      .range(from, from + page - 1);
    if (order) q = q.order(order, { ascending: true });
    const { data: rows, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    const batch = (rows ?? []) as T[];
    all.push(...batch);
    if (batch.length < page) break;
  }
  return all;
}

async function upsertAll(table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabaseAdmin
      .from(table as never)
      .upsert(rows.slice(i, i + 200) as never, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
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

type F = {
  id: string;
  parent_id: string | null;
  name: string;
  color: string | null;
  deleted_at: string | null;
};

export type Scopes = { library: boolean; calendar: boolean; plans: boolean; links: boolean };

/** Schritt 1: Ordnerstruktur anlegen, Gesamtzahl der Dateien melden. */
export const transferStart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; confirm: string; scopes: Scopes }) => input)
  .handler(async ({ data, context }) => {
    if (data.confirm.trim().toUpperCase() !== "ÜBERTRAGEN") throw new Error("Bestätigung fehlt.");
    const target = await findUserByEmail(data.email);
    if (!target) throw new Error("Kein registrierter Account mit dieser E-Mail gefunden.");
    if (target.id === context.userId) throw new Error("Das ist dein eigener Account.");
    const uid = target.id;
    const src = context.supabase as unknown as Client;

    if (!data.scopes.library)
      return { uid, email: target.email ?? data.email, folders: 0, totalDocs: 0 };

    const folders = (
      await grab<F>(src, "folders", "id,parent_id,name,color,deleted_at")
    ).filter((f) => !f.deleted_at);


    const map = new Map<string, string>();
    for (const f of folders) map.set(f.id, await detUuid(`${uid}:folder:${f.id}`));

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
      await upsertAll(
        "folders",
        (levels.get(depth) ?? []).map((f) => ({
          id: map.get(f.id),
          user_id: uid,
          parent_id: f.parent_id ? (map.get(f.parent_id) ?? null) : null,
          name: f.name,
          color: f.color,
        })),
      );
    }

    const docs = await grab<{ id: string; deleted_at: string | null }>(
      src,
      "documents",
      "id,deleted_at",
    );
    const totalDocs = docs.filter((d) => !d.deleted_at).length;

    return { uid, email: target.email ?? data.email, folders: folders.length, totalDocs };
  });

type D = {
  id: string;
  folder_id: string | null;
  name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  kind: string;
  created_at: string;
  deleted_at: string | null;
};

/** Schritt 2: Dateien portionsweise kopieren (Fortschritt im Client). */
export const transferDocsChunk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; offset: number; limit?: number }) => input)
  .handler(async ({ data, context }) => {
    const target = await findUserByEmail(data.email);
    if (!target) throw new Error("Zielaccount nicht gefunden.");
    if (target.id === context.userId) throw new Error("Das ist dein eigener Account.");
    const uid = target.id;
    const limit = Math.min(Math.max(data.limit ?? 20, 1), 50);
    const src = context.supabase;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await src
      .from("documents" as never)
      .select("id,folder_id,name,storage_path,mime_type,size_bytes,kind,created_at,deleted_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(data.offset, data.offset + limit - 1);
    if (error) throw new Error(`documents: ${error.message}`);
    const docs = (rows ?? []) as unknown as D[];

    let copied = 0;
    let failed = 0;
    const docRows: Record<string, unknown>[] = [];
    for (const d of docs) {
      const newId = await detUuid(`${uid}:doc:${d.id}`);
      const safe = d.name.replace(/[^\w.\-]/g, "_");
      const newPath = `${uid}/${newId}-${safe}`;
      const { error: copyErr } = await supabaseAdmin.storage
        .from("documents")
        .copy(d.storage_path, newPath);
      const exists = copyErr && /exist|duplicate|409/i.test(copyErr.message);
      if (copyErr && !exists) {
        failed++;
        continue;
      }
      copied++;
      docRows.push({
        id: newId,
        user_id: uid,
        folder_id: d.folder_id ? await detUuid(`${uid}:folder:${d.folder_id}`) : null,
        name: d.name,
        storage_path: newPath,
        mime_type: d.mime_type,
        size_bytes: d.size_bytes,
        kind: d.kind,
      });
    }
    await upsertAll("documents", docRows);

    return { processed: docs.length, copied, failed, done: docs.length < limit };
  });

/** Schritt 3: Termine, Lehrpläne, Aufgaben und Links übertragen. */
export const transferFinish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string }) => input)
  .handler(async ({ data, context }) => {
    const target = await findUserByEmail(data.email);
    if (!target) throw new Error("Zielaccount nicht gefunden.");
    if (target.id === context.userId) throw new Error("Das ist dein eigener Account.");
    const uid = target.id;
    const src = context.supabase as unknown as Client;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const existingDocs = new Set<string>();
    for (let from = 0; ; from += 1000) {
      const { data: rows, error } = await supabaseAdmin
        .from("documents")
        .select("id")
        .eq("user_id", uid)
        .range(from, from + 999);
      if (error) throw new Error(`documents: ${error.message}`);
      (rows ?? []).forEach((r) => existingDocs.add(r.id));
      if ((rows ?? []).length < 1000) break;
    }
    const docRef = async (id: string | null) => {
      if (!id) return null;
      const mapped = await detUuid(`${uid}:doc:${id}`);
      return existingDocs.has(mapped) ? mapped : null;
    };

    type E = {
      id: string;
      title: string;
      notes: string | null;
      start_at: string;
      end_at: string | null;
      all_day: boolean;
      color: string | null;
      document_id: string | null;
    };
    const events = await grab<E>(
      src,
      "events",
      "id,title,notes,start_at,end_at,all_day,color,document_id",
    );
    await upsertAll(
      "events",
      await Promise.all(
        events.map(async (e) => ({
          id: await detUuid(`${uid}:event:${e.id}`),
          user_id: uid,
          title: e.title,
          notes: e.notes,
          start_at: e.start_at,
          end_at: e.end_at,
          all_day: e.all_day,
          color: e.color,
          document_id: await docRef(e.document_id),
        })),
      ),
    );

    type P = {
      id: string;
      title: string;
      description: string | null;
      start_date: string | null;
      end_date: string | null;
    };
    const plans = await grab<P>(src, "study_plans", "id,title,description,start_date,end_date");
    await upsertAll(
      "study_plans",
      await Promise.all(
        plans.map(async (p) => ({
          id: await detUuid(`${uid}:plan:${p.id}`),
          user_id: uid,
          title: p.title,
          description: p.description,
          start_date: p.start_date,
          end_date: p.end_date,
        })),
      ),
    );
    const planIds = new Set(plans.map((p) => p.id));

    type T = {
      id: string;
      plan_id: string;
      title: string;
      notes: string | null;
      due_date: string | null;
      status: string;
      document_id: string | null;
      position: number;
    };
    const tasks = await grab<T>(
      src,
      "study_tasks",
      "id,plan_id,title,notes,due_date,status,document_id,position",
    );
    await upsertAll(
      "study_tasks",
      await Promise.all(
        tasks
          .filter((t) => planIds.has(t.plan_id))
          .map(async (t) => ({
            id: await detUuid(`${uid}:task:${t.id}`),
            user_id: uid,
            plan_id: await detUuid(`${uid}:plan:${t.plan_id}`),
            title: t.title,
            notes: t.notes,
            due_date: t.due_date,
            status: t.status,
            document_id: await docRef(t.document_id),
            position: t.position,
          })),
      ),
    );

    type L = {
      id: string;
      title: string;
      url: string;
      description: string | null;
      position: number;
    };
    const links = await grab<L>(src, "links", "id,title,url,description,position");
    await upsertAll(
      "links",
      await Promise.all(
        links.map(async (l) => ({
          id: await detUuid(`${uid}:link:${l.id}`),
          user_id: uid,
          title: l.title,
          url: l.url,
          description: l.description,
          position: l.position,
        })),
      ),
    );

    return {
      ok: true as const,
      email: target.email ?? data.email,
      events: events.length,
      plans: plans.length,
      tasks: tasks.length,
      links: links.length,
    };
  });
