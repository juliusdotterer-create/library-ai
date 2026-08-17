import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

type RuntimeGlobals = typeof globalThis & {
  Deno?: { env?: { get?: (name: string) => string | undefined } };
  process?: { env?: Record<string, string | undefined> };
};

function runtimeEnv(name: string): string | undefined {
  const runtime = globalThis as RuntimeGlobals;
  return runtime.Deno?.env?.get?.(name) ?? runtime.process?.env?.[name];
}

function configuredEnv(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = runtimeEnv(name)?.trim();
    if (value) return value;
  }
  return undefined;
}

function supabaseProjectUrl(): string {
  const url = configuredEnv(["SUPABASE_URL", "VITE_SUPABASE_URL"]);
  if (!url) throw new Error("SUPABASE_URL (or VITE_SUPABASE_URL) is required");
  return url;
}

function supabasePublishableKey(): string {
  const direct = configuredEnv([
    "SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
  ]);
  if (direct) return direct;
  const keyset = runtimeEnv("SUPABASE_PUBLISHABLE_KEYS");
  if (keyset) {
    try {
      const parsed: unknown = JSON.parse(keyset);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const keys = parsed as Record<string, unknown>;
        const key = [keys.default, ...Object.values(keys)]
          .find((v): v is string => typeof v === "string" && v.trim().startsWith("sb_publishable_"))
          ?.trim();
        if (key) return key;
      }
    } catch {
      // Malformed dictionary; fall through to the legacy names below.
    }
  }
  const legacy = configuredEnv(["SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY"]);
  if (legacy) return legacy;
  throw new Error("SUPABASE_PUBLISHABLE_KEY, SUPABASE_PUBLISHABLE_KEYS, or SUPABASE_ANON_KEY is required");
}

/** Forwards the verified bearer token so RLS runs as the signed-in user. */
export function supabaseForUser(ctx: ToolContext) {
  const token = ctx.getToken();
  if (!token) throw new Error("supabaseForUser requires a verified OAuth token");
  return createClient(supabaseProjectUrl(), supabasePublishableKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function notAuthenticated() {
  return {
    content: [{ type: "text" as const, text: "Nicht angemeldet." }],
    isError: true,
  };
}

export function notWhitelisted() {
  return {
    content: [
      { type: "text" as const, text: "Dieser Account ist nicht freigeschaltet." },
    ],
    isError: true,
  };
}

/**
 * Liefert einen Supabase-Client nur, wenn der Nutzer auf der Whitelist steht.
 * Die Prüfung läuft mit Service-Role serverseitig (die DB-Funktion ist für
 * anon/authenticated nicht mehr aufrufbar). Gibt sonst `null` zurück.
 */
export async function supabaseForWhitelistedUser(ctx: ToolContext) {
  const supabase = supabaseForUser(ctx);
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const user = userData?.user;
  if (userErr || !user) return null;

  const serviceKey = configuredEnv(["SUPABASE_SERVICE_ROLE_KEY"]);
  if (!serviceKey) return null;
  const admin = createClient(supabaseProjectUrl(), serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const email = (user.email ?? "").trim().toLowerCase();
  if (email) {
    const { data: row } = await admin
      .from("allowed_emails")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (row) return supabase;
  }

  const { data: roleRow } = await admin
    .from("user_roles")
    .select("id")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  return roleRow ? supabase : null;
}

