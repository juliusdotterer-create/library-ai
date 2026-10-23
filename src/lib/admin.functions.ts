import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Admin-Aktion: sendet einer freigeschalteten Adresse eine Mail mit
 * Zurücksetz-Link. Passwörter werden dabei nie gelesen oder gesetzt.
 */
export const sendPasswordResetForEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email: string; redirectTo: string }) => {
    const email = String(data?.email ?? "")
      .trim()
      .toLowerCase();
    const redirectTo = String(data?.redirectTo ?? "").trim();
    if (!EMAIL_RE.test(email) || email.length > 255) throw new Error("Ungültige E-Mail-Adresse");
    if (!/^https?:\/\//.test(redirectTo) || redirectTo.length > 500) {
      throw new Error("Ungültige Zieladresse");
    }
    return { email, redirectTo };
  })
  .handler(async ({ data, context }) => {
    // Rollen werden über die RLS-geschützte Tabelle als angemeldeter Nutzer geprüft.
    const { data: roleRow } = await context.supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Nur Admins dürfen Zurücksetz-Links senden.");


    // Zieladresse muss auf diese App zeigen.
    const reqOrigin = new URL(getRequest().url).origin;
    let target: URL;
    try {
      target = new URL(data.redirectTo);
    } catch {
      throw new Error("Ungültige Zieladresse");
    }
    if (target.origin !== reqOrigin) throw new Error("Ungültige Zieladresse");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Nur an freigeschaltete Adressen senden.
    const { data: allowed } = await supabaseAdmin
      .from("allowed_emails")
      .select("id")
      .ilike("email", data.email)
      .maybeSingle();
    if (!allowed) throw new Error("Adresse ist nicht freigeschaltet.");

    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${reqOrigin}/passwort-neu`,
    });
    if (error) throw new Error(error.message);
    return { sent: true };
  });
