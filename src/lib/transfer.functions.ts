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

async function grab<T>(src: Client, table: string, cols: string, order?: string, userId?: string) {
  const page = 1000;
  const all: T[] = [];
  for (let from = 0; ; from += page) {
    let q = src.from(table as never).select(cols);
    if (userId) q = q.eq("user_id", userId);
    q = q.range(from, from + page - 1);
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

export type Scopes = { library: boolean; calendar: boolean; plans: boolean; links: boolean };

type RequestRow = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  scopes: Scopes;
  status: "pending" | "accepted" | "rejected" | "expired";
  created_at: string;
  updated_at: string;
  expires_at: string;
  from_profile?: { display_name: string | null } | null;
  to_profile?: { display_name: string | null } | null;
};

type JsonValue = string | number | boolean | null | { [key: string]: JsonValue } | JsonValue[];

/**
 * Startet eine Übertragungs-Anfrage. Gibt immer eine nicht aufschlussreiche
 * Erfolgsmeldung zurück, damit nicht enumeriert werden kann, welche E-Mail-Adressen
 * registriert sind.
 */
export const createTransferRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; scopes: Scopes }) => {
    const email = String(input?.email ?? "").trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 255) {
      throw new Error("Ungültige E-Mail-Adresse");
    }
    return { email, scopes: input.scopes };
  })
  .handler(async ({ data, context }) => {
    const target = await findUserByEmail(data.email);
    if (!target || target.id === context.userId) {
      // Keine Unterscheidung, ob die Adresse existiert oder der eigene Account ist.
      return { ok: true as const, email: data.email };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Bestehende pending Anfrage an dieselbe Adresse verhindern.
    const { data: existing } = await supabaseAdmin
      .from("transfer_requests")
      .select("id")
      .eq("from_user_id", context.userId)
      .eq("to_user_id", target.id)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) return { ok: true as const, email: data.email };

    const { error } = await supabaseAdmin.from("transfer_requests").insert({
      from_user_id: context.userId,
      to_user_id: target.id,
      scopes: data.scopes as unknown as JsonValue,
      status: "pending",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (error) throw new Error(error.message);

    return { ok: true as const, email: data.email };
  });

export const listTransferRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("transfer_requests")
      .select(
        "id, from_user_id, to_user_id, scopes, status, created_at, updated_at, expires_at, from_profile:profiles!transfer_requests_from_user_id_fkey(display_name), to_profile:profiles!transfer_requests_to_user_id_fkey(display_name)",
      )
      .or(`from_user_id.eq.${context.userId},to_user_id.eq.${context.userId}`)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { requests: (rows ?? []) as unknown as RequestRow[] };
  });

export const cancelTransferRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requestId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: fetchErr } = await supabaseAdmin
      .from("transfer_requests")
      .select("id, from_user_id, status")
      .eq("id", data.requestId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!row) throw new Error("Anfrage nicht gefunden.");
    if (row.from_user_id !== context.userId) throw new Error("Nur der Initiator kann eine Anfrage zurückziehen.");
    if (row.status !== "pending") throw new Error("Die Anfrage wurde bereits bearbeitet.");

    const { error } = await supabaseAdmin.from("transfer_requests").delete().eq("id", data.requestId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const respondToTransferRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requestId: string; action: "accept" | "reject" }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: fetchErr } = await supabaseAdmin
      .from("transfer_requests")
      .select("id, from_user_id, to_user_id, scopes, status, expires_at")
      .eq("id", data.requestId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!row) throw new Error("Anfrage nicht gefunden.");
    if (row.to_user_id !== context.userId) throw new Error("Nur der Empfänger kann auf diese Anfrage antworten.");
    if (row.status !== "pending") throw new Error("Die Anfrage wurde bereits bearbeitet.");
    if (new Date(row.expires_at) < new Date()) {
      await supabaseAdmin.from("transfer_requests").update({ status: "expired" }).eq("id", data.requestId);
      throw new Error("Die Anfrage ist abgelaufen.");
    }

    if (data.action === "reject") {
      const { error } = await supabaseAdmin
        .from("transfer_requests")
        .update({ status: "rejected" })
        .eq("id", data.requestId);
      if (error) throw new Error(error.message);
      return { ok: true as const, accepted: false as const };
    }

    // accept: führe die eigentliche Übertragung durch.
    const scopes = (row.scopes ?? {}) as Scopes;
    const summary = await executeTransfer(row.from_user_id, context.userId, scopes);

    const { error } = await supabaseAdmin
      .from("transfer_requests")
      .update({ status: "accepted" })
      .eq("id", data.requestId);
    if (error) throw new Error(error.message);

    return { ok: true as const, accepted: true as const, summary };
  });

async function executeTransfer(fromUserId: string, toUserId: string, scopes: Scopes) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Quelldaten müssen mit Service-Role gelesen werden, da der Empfänger sonst
  // keine Leserechte auf die Daten des Initiators hat.
  const src = supabaseAdmin as unknown as Client;

  type F = {
    id: string;
    user_id: string;
    parent_id: string | null;
    name: string;
    color: string | null;
    deleted_at: string | null;
  };

  let folders = 0;
  let copied = 0;
  let failed = 0;

  if (scopes.library) {
    const folderRows = (await grab<F>(src, "folders", "id,user_id,parent_id,name,color,deleted_at", undefined, fromUserId)).filter(
      (f) => !f.deleted_at,
    );

    const map = new Map<string, string>();
    for (const f of folderRows) map.set(f.id, await detUuid(`${toUserId}:folder:${f.id}`));

    const byId = new Map(folderRows.map((f) => [f.id, f]));
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
    for (const f of folderRows) {
      const d = depthOf(f);
      levels.set(d, [...(levels.get(d) ?? []), f]);
    }
    for (const depth of [...levels.keys()].sort((a, b) => a - b)) {
      await upsertAll(
        "folders",
        (levels.get(depth) ?? []).map((f) => ({
          id: map.get(f.id),
          user_id: toUserId,
          parent_id: f.parent_id ? (map.get(f.parent_id) ?? null) : null,
          name: f.name,
          color: f.color,
        })),
      );
    }
    folders = folderRows.length;

    type D = {
      id: string;
      folder_id: string | null;
      name: string;
      storage_path: string;
      mime_type: string | null;
      size_bytes: number | null;
      kind: string;
      user_id: string;
    };

    for (let offset = 0; ; offset += 50) {
      const { data: rows, error } = await supabaseAdmin
        .from("documents")
        .select("id,folder_id,name,storage_path,mime_type,size_bytes,kind,user_id")
        .eq("user_id", fromUserId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + 49);
      if (error) throw new Error(`documents: ${error.message}`);
      const docs = (rows ?? []) as unknown as D[];
      if (!docs.length) break;

      const docRows: Record<string, unknown>[] = [];
      for (const d of docs) {
        const newId = await detUuid(`${toUserId}:doc:${d.id}`);
        const safe = d.name.replace(/[^\w.\-]/g, "_");
        const newPath = `${toUserId}/${newId}-${safe}`;
        const { error: copyErr } = await supabaseAdmin.storage.from("documents").copy(d.storage_path, newPath);
        const exists = copyErr && /exist|duplicate|409/i.test(copyErr.message);
        if (copyErr && !exists) {
          failed++;
          continue;
        }
        copied++;
        docRows.push({
          id: newId,
          user_id: toUserId,
          folder_id: d.folder_id ? await detUuid(`${toUserId}:folder:${d.folder_id}`) : null,
          name: d.name,
          storage_path: newPath,
          mime_type: d.mime_type,
          size_bytes: d.size_bytes,
          kind: d.kind,
        });
      }
      await upsertAll("documents", docRows);
      if (docs.length < 50) break;
    }
  }

  const existingDocs = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data: rows, error } = await supabaseAdmin
      .from("documents")
      .select("id")
      .eq("user_id", toUserId)
      .range(from, from + 999);
    if (error) throw new Error(`documents: ${error.message}`);
    (rows ?? []).forEach((r) => existingDocs.add(r.id));
    if ((rows ?? []).length < 1000) break;
  }
  const docRef = async (id: string | null) => {
    if (!id) return null;
    const mapped = await detUuid(`${toUserId}:doc:${id}`);
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
    user_id: string;
  };
  const events = scopes.calendar
    ? await grab<E>(src, "events", "id,title,notes,start_at,end_at,all_day,color,document_id,user_id", undefined, fromUserId)
    : [];
  await upsertAll(
    "events",
    await Promise.all(
      events.map(async (e) => ({
        id: await detUuid(`${toUserId}:event:${e.id}`),
        user_id: toUserId,
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
    user_id: string;
  };
  const plans = scopes.plans
    ? await grab<P>(src, "study_plans", "id,title,description,start_date,end_date,user_id", undefined, fromUserId)
    : [];
  await upsertAll(
    "study_plans",
    await Promise.all(
      plans.map(async (p) => ({
        id: await detUuid(`${toUserId}:plan:${p.id}`),
        user_id: toUserId,
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
    user_id: string;
  };
  const tasks = scopes.plans
    ? (
        await grab<T>(src, "study_tasks", "id,plan_id,title,notes,due_date,status,document_id,position,user_id")
      ).filter((t) => t.user_id === fromUserId)
    : [];
  await upsertAll(
    "study_tasks",
    await Promise.all(
      tasks
        .filter((t) => planIds.has(t.plan_id))
        .map(async (t) => ({
          id: await detUuid(`${toUserId}:task:${t.id}`),
          user_id: toUserId,
          plan_id: await detUuid(`${toUserId}:plan:${t.plan_id}`),
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
    user_id: string;
  };
  const links = scopes.links
    ? (await grab<L>(src, "links", "id,title,url,description,position,user_id")).filter(
        (l) => l.user_id === fromUserId,
      )
    : [];
  await upsertAll(
    "links",
    await Promise.all(
      links.map(async (l) => ({
        id: await detUuid(`${toUserId}:link:${l.id}`),
        user_id: toUserId,
        title: l.title,
        url: l.url,
        description: l.description,
        position: l.position,
      })),
    ),
  );

  return {
    folders,
    copied,
    failed,
    events: events.length,
    plans: plans.length,
    tasks: tasks.length,
    links: links.length,
  };
}
