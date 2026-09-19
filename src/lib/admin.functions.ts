import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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


    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email, {
      redirectTo: data.redirectTo,
    });
    if (error) throw new Error(error.message);
    return { sent: true };
  });
