/**
 * Lokale Datenbank für die eigenständige Demo.
 *
 * Ersetzt den Supabase-Client vollständig im Browser: Tabellen liegen als
 * JSON in IndexedDB, Dateien (Storage) als Blobs ebenfalls in IndexedDB.
 * Es gibt keinen Server, keine Konten und keine Secrets. Die API bildet nur
 * den Teil von supabase-js nach, den die App tatsächlich benutzt
 * (from/select/insert/update/upsert/delete mit Filtern, storage, auth).
 */

type Row = Record<string, unknown>;
type Result<T = unknown> = { data: T; error: { message: string } | null; count?: number | null };

/* ------------------------------------------------------------------ */
/* Lokaler Benutzer                                                    */
/* ------------------------------------------------------------------ */

export const LOCAL_USER_ID = "00000000-0000-4000-8000-000000000001";

export const localUser = {
  id: LOCAL_USER_ID,
  aud: "authenticated",
  role: "authenticated",
  email: "lokal@library.local",
  app_metadata: { provider: "local" },
  user_metadata: { display_name: "Lokal" },
  created_at: "2026-01-01T00:00:00.000Z",
};

export const localSession = {
  access_token: "local",
  refresh_token: "local",
  token_type: "bearer",
  expires_in: 60 * 60 * 24 * 365,
  expires_at: 4102444800,
  user: localUser,
};

/* ------------------------------------------------------------------ */
/* IndexedDB                                                           */
/* ------------------------------------------------------------------ */

const DB_NAME = "library-local";
const TABLES = "tables";
const FILES = "files";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(TABLES)) db.createObjectStore(TABLES);
      if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(store: string, key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(store: string, key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* Tabellen im Speicher halten, schreibend nach IndexedDB spiegeln. */
const cache = new Map<string, Row[]>();

async function loadTable(name: string): Promise<Row[]> {
  const hit = cache.get(name);
  if (hit) return hit;
  const rows = (await idbGet<Row[]>(TABLES, name)) ?? [];
  // Ein paralleler Aufruf kann den Cache inzwischen gefüllt (und verändert) haben.
  const again = cache.get(name);
  if (again) return again;
  cache.set(name, rows);
  return rows;
}

async function saveTable(name: string, rows: Row[]): Promise<void> {
  cache.set(name, rows);
  await idbPut(TABLES, name, rows);
}

/* ------------------------------------------------------------------ */
/* Standardwerte (entsprechen den früheren Spalten-Defaults)          */
/* ------------------------------------------------------------------ */

const DEFAULTS: Record<string, Row> = {
  folders: { is_favorite: false, color: null, source: "local", external_id: null, parent_id: null },
  documents: {
    kind: "document",
    storage_path: "",
    source: "upload",
    drive_state: "none",
    external_id: null,
    mime_type: null,
    folder_id: null,
    notebook_id: null,
    size_bytes: null,
  },
  events: { all_day: false, color: null, notes: null, document_id: null },
  study_tasks: { status: "open", position: 0, notes: null, due_date: null, document_id: null },
  links: { position: 0, app_url: null, description: null },
  timetable_entries: { weekday: 1, start_time: "08:00", end_time: "09:00", room: null, teacher: null, color: null },
  document_annotations: { data: [] },
  document_notepads: { content: "" },
  notebooks: { title: "Neues Notizbuch" },
  notebook_pages: { position: 0, strokes: [], text: "" },
  document_text: { content: "", pages: [], page_count: 0, status: "pending", source: "text", attempts: 0 },
  user_settings: { theme_mode: "light", accent: "orange", accent_hue: 55, glass_intensity: 1 },
};

/** Tabellen, deren Primärschlüssel nicht `id` heißt. */
const PRIMARY_KEY: Record<string, string> = {
  user_settings: "user_id",
  web_search_prefs: "user_id",
  document_text: "document_id",
};

function withDefaults(table: string, row: Row): Row {
  const now = new Date().toISOString();
  const pk = PRIMARY_KEY[table] ?? "id";
  const base: Row = {
    ...(pk === "id" ? { id: crypto.randomUUID() } : {}),
    user_id: LOCAL_USER_ID,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    ...DEFAULTS[table],
  };
  return { ...base, ...row };
}

/* ------------------------------------------------------------------ */
/* Filter                                                              */
/* ------------------------------------------------------------------ */

type Filter = (row: Row) => boolean;

function likeToRegex(pattern: string, insensitive: boolean): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
  return new RegExp(`^${escaped}$`, insensitive ? "is" : "s");
}

function cmp(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return String(a).localeCompare(String(b), "de", { numeric: true });
}

function opFilter(column: string, op: string, value: unknown): Filter {
  switch (op) {
    case "eq":
      return (r) => r[column] === value;
    case "neq":
      return (r) => r[column] !== value;
    case "is":
      return (r) => (value === null ? r[column] === null || r[column] === undefined : r[column] === value);
    case "in": {
      const list = Array.isArray(value)
        ? value
        : String(value).replace(/^\(|\)$/g, "").split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
      return (r) => list.includes(r[column] as never);
    }
    case "gt":
      return (r) => r[column] != null && cmp(r[column], value) > 0;
    case "gte":
      return (r) => r[column] != null && cmp(r[column], value) >= 0;
    case "lt":
      return (r) => r[column] != null && cmp(r[column], value) < 0;
    case "lte":
      return (r) => r[column] != null && cmp(r[column], value) <= 0;
    case "like":
      return (r) => likeToRegex(String(value), false).test(String(r[column] ?? ""));
    case "ilike":
      return (r) => likeToRegex(String(value), true).test(String(r[column] ?? ""));
    default:
      throw new Error(`Filter "${op}" wird lokal nicht unterstützt`);
  }
}

/* ------------------------------------------------------------------ */
/* Query-Builder                                                       */
/* ------------------------------------------------------------------ */

type Action = "select" | "insert" | "update" | "upsert" | "delete";

class Query implements PromiseLike<Result> {
  private action: Action = "select";
  private columns: string | null = "*";
  private returning = false;
  private payload: Row[] = [];
  private patch: Row = {};
  private filters: Filter[] = [];
  private orders: { column: string; ascending: boolean; nullsFirst?: boolean }[] = [];
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private limitN: number | null = null;
  private mode: "many" | "single" | "maybe" = "many";
  private countMode: string | null = null;
  private head = false;
  private onConflict: string | null = null;
  private ignoreDuplicates = false;

  constructor(private table: string) {}

  select(columns = "*", opts?: { count?: string; head?: boolean }) {
    if (this.action === "select") this.columns = columns;
    else {
      this.returning = true;
      this.columns = columns;
    }
    if (opts?.count) this.countMode = opts.count;
    if (opts?.head) this.head = true;
    return this;
  }
  insert(values: Row | Row[]) {
    this.action = "insert";
    this.payload = Array.isArray(values) ? values : [values];
    return this;
  }
  upsert(values: Row | Row[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.action = "upsert";
    this.payload = Array.isArray(values) ? values : [values];
    this.onConflict = opts?.onConflict ?? null;
    this.ignoreDuplicates = !!opts?.ignoreDuplicates;
    return this;
  }
  update(values: Row) {
    this.action = "update";
    this.patch = values;
    return this;
  }
  delete() {
    this.action = "delete";
    return this;
  }

  eq(c: string, v: unknown) { this.filters.push(opFilter(c, "eq", v)); return this; }
  neq(c: string, v: unknown) { this.filters.push(opFilter(c, "neq", v)); return this; }
  is(c: string, v: unknown) { this.filters.push(opFilter(c, "is", v)); return this; }
  in(c: string, v: unknown[]) { this.filters.push(opFilter(c, "in", v)); return this; }
  gt(c: string, v: unknown) { this.filters.push(opFilter(c, "gt", v)); return this; }
  gte(c: string, v: unknown) { this.filters.push(opFilter(c, "gte", v)); return this; }
  lt(c: string, v: unknown) { this.filters.push(opFilter(c, "lt", v)); return this; }
  lte(c: string, v: unknown) { this.filters.push(opFilter(c, "lte", v)); return this; }
  like(c: string, v: string) { this.filters.push(opFilter(c, "like", v)); return this; }
  ilike(c: string, v: string) { this.filters.push(opFilter(c, "ilike", v)); return this; }
  filter(c: string, op: string, v: unknown) { this.filters.push(opFilter(c, op, v)); return this; }
  not(c: string, op: string, v: unknown) {
    const f = opFilter(c, op, v);
    this.filters.push((r) => !f(r));
    return this;
  }
  match(obj: Row) {
    for (const [k, v] of Object.entries(obj)) this.eq(k, v);
    return this;
  }

  order(column: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.orders.push({ column, ascending: opts?.ascending ?? true, nullsFirst: opts?.nullsFirst });
    return this;
  }
  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  single() {
    this.mode = "single";
    return this;
  }
  maybeSingle() {
    this.mode = "maybe";
    return this;
  }
  abortSignal() {
    return this;
  }
  returns() {
    return this;
  }
  throwOnError() {
    return this;
  }

  private project(row: Row): Row {
    if (!this.columns || this.columns.trim() === "*") return { ...row };
    const out: Row = {};
    for (const raw of this.columns.split(",")) {
      const col = raw.trim();
      if (!col) continue;
      if (col === "*") Object.assign(out, row);
      else out[col] = row[col] ?? null;
    }
    return out;
  }

  private matches(row: Row) {
    return this.filters.every((f) => f(row));
  }

  private sort(rows: Row[]) {
    if (!this.orders.length) return rows;
    return [...rows].sort((a, b) => {
      for (const o of this.orders) {
        const av = a[o.column];
        const bv = b[o.column];
        const aNull = av === null || av === undefined;
        const bNull = bv === null || bv === undefined;
        if (aNull !== bNull) {
          const nullsFirst = o.nullsFirst ?? !o.ascending;
          return aNull === nullsFirst ? -1 : 1;
        }
        const c = cmp(av, bv);
        if (c !== 0) return o.ascending ? c : -c;
      }
      return 0;
    });
  }

  private finish(rows: Row[], count: number | null = null): Result {
    if (this.mode === "many") return { data: rows, error: null, count };
    if (rows.length === 1) return { data: rows[0], error: null, count };
    if (rows.length === 0 && this.mode === "maybe") return { data: null, error: null, count };
    return {
      data: null,
      error: { message: rows.length ? "Mehrere Zeilen gefunden" : "Keine Zeile gefunden" },
      count,
    };
  }

  private async run(): Promise<Result> {
    await loadTable(this.table);
    // Nach dem await frisch aus dem Cache lesen, damit parallele Schreibzugriffe
    // sich nicht gegenseitig überschreiben (alles danach läuft synchron bis saveTable).
    const all = cache.get(this.table) ?? [];

    if (this.action === "select") {
      let rows = this.sort(all.filter((r) => this.matches(r)));
      const count = this.countMode ? rows.length : null;
      if (this.head) return { data: null, error: null, count };
      if (this.rangeFrom !== null) rows = rows.slice(this.rangeFrom, (this.rangeTo ?? rows.length) + 1);
      if (this.limitN !== null) rows = rows.slice(0, this.limitN);
      return this.finish(rows.map((r) => this.project(r)), count);
    }

    if (this.action === "insert") {
      const added = this.payload.map((r) => withDefaults(this.table, r));
      await saveTable(this.table, [...all, ...added]);
      return this.returning ? this.finish(added.map((r) => this.project(r))) : { data: null, error: null };
    }

    if (this.action === "upsert") {
      const keys = (this.onConflict ?? PRIMARY_KEY[this.table] ?? "id").split(",").map((k) => k.trim());
      const next = [...all];
      const touched: Row[] = [];
      for (const r of this.payload) {
        const idx = next.findIndex((x) => keys.every((k) => r[k] !== undefined && x[k] === r[k]));
        if (idx >= 0) {
          if (this.ignoreDuplicates) continue;
          next[idx] = { ...next[idx], ...r, updated_at: r.updated_at ?? new Date().toISOString() };
          touched.push(next[idx]);
        } else {
          const row = withDefaults(this.table, r);
          next.push(row);
          touched.push(row);
        }
      }
      await saveTable(this.table, next);
      return this.returning ? this.finish(touched.map((r) => this.project(r))) : { data: null, error: null };
    }

    if (this.action === "update") {
      const touched: Row[] = [];
      const now = new Date().toISOString();
      const next = all.map((r) => {
        if (!this.matches(r)) return r;
        const u = { ...r, ...this.patch, updated_at: this.patch.updated_at ?? now };
        touched.push(u);
        return u;
      });
      await saveTable(this.table, next);
      return this.returning ? this.finish(touched.map((r) => this.project(r))) : { data: null, error: null };
    }

    // delete
    const removed = all.filter((r) => this.matches(r));
    await saveTable(this.table, all.filter((r) => !this.matches(r)));
    return this.returning ? this.finish(removed.map((r) => this.project(r))) : { data: null, error: null };
  }

  then<A = Result, B = never>(
    onfulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.run()
      .catch((e: unknown) => ({ data: null, error: { message: e instanceof Error ? e.message : String(e) } }))
      .then(onfulfilled, onrejected);
  }
}

/* ------------------------------------------------------------------ */
/* Storage                                                             */
/* ------------------------------------------------------------------ */

const urlCache = new Map<string, string>();

function bucket(name: string) {
  const key = (path: string) => `${name}/${path}`;
  return {
    async upload(path: string, file: Blob, opts?: { contentType?: string; upsert?: boolean }) {
      const blob = opts?.contentType && file.type !== opts.contentType ? new Blob([file], { type: opts.contentType }) : file;
      await idbPut(FILES, key(path), blob);
      return { data: { path }, error: null };
    },
    async download(path: string) {
      const blob = await idbGet<Blob>(FILES, key(path));
      return blob ? { data: blob, error: null } : { data: null, error: { message: "Datei nicht gefunden" } };
    },
    async createSignedUrl(path: string) {
      const blob = await idbGet<Blob>(FILES, key(path));
      if (!blob) return { data: null, error: { message: "Datei nicht gefunden" } };
      let url = urlCache.get(key(path));
      if (!url) {
        url = URL.createObjectURL(blob);
        urlCache.set(key(path), url);
      }
      return { data: { signedUrl: url }, error: null };
    },
    async remove(paths: string[]) {
      for (const p of paths) {
        const u = urlCache.get(key(p));
        if (u) URL.revokeObjectURL(u);
        urlCache.delete(key(p));
        await idbDelete(FILES, key(p));
      }
      return { data: paths.map((name) => ({ name })), error: null };
    },
  };
}

/* ------------------------------------------------------------------ */
/* Auth (immer angemeldet als lokaler Benutzer)                        */
/* ------------------------------------------------------------------ */

const auth = {
  async getSession() {
    return { data: { session: localSession }, error: null };
  },
  async getUser() {
    return { data: { user: localUser }, error: null };
  },
  onAuthStateChange(cb: (event: string, session: typeof localSession) => void) {
    queueMicrotask(() => cb("INITIAL_SESSION", localSession));
    return { data: { subscription: { unsubscribe() {} } } };
  },
  async signOut() {
    return { error: null };
  },
  async updateUser(attrs: { data?: Row }) {
    if (attrs?.data) Object.assign(localUser.user_metadata, attrs.data);
    return { data: { user: localUser }, error: null };
  },
};

/* ------------------------------------------------------------------ */
/* Client                                                              */
/* ------------------------------------------------------------------ */

export const localDb = {
  from: (table: string) => new Query(table),
  storage: { from: bucket },
  auth,
};

/** Alle lokalen Daten löschen (Tabellen und Dateien). */
export async function resetLocalData() {
  cache.clear();
  for (const u of urlCache.values()) URL.revokeObjectURL(u);
  urlCache.clear();
  dbPromise?.then((db) => db.close());
  dbPromise = null;
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}
