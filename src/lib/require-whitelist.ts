import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Serverseitiges Gate für die Einladungs-Whitelist.
 *
 * Ergänzt `requireSupabaseAuth`: Neben einer gültigen Session muss die
 * E-Mail-Adresse des Nutzers auf der Whitelist stehen (oder der Nutzer muss
 * Admin sein). Die Prüfung läuft ausschließlich serverseitig mit Service-Role;
 * die Datenbankfunktion ist für anon/authenticated nicht mehr aufrufbar.
 */
export const requireWhitelisted = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const email = String(context.claims?.email ?? "").trim().toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let allowed = false;
    if (email) {
      const { data: row } = await supabaseAdmin
        .from("allowed_emails")
        .select("id")
        .ilike("email", email)
        .maybeSingle();
      allowed = Boolean(row);
    }

    if (!allowed) {
      const { data: roleRow } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", context.userId)
        .eq("role", "admin")
        .maybeSingle();
      allowed = Boolean(roleRow);
    }

    if (!allowed) {
      throw new Error("Forbidden: Account ist nicht freigeschaltet");
    }
    return next();
  });
