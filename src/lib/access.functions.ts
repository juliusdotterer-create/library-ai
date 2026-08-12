import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OWNER_EMAIL = process.env["OWNER_EMAIL"];

/**
 * Prüft serverseitig, ob der angemeldete Nutzer freigeschaltet ist.
 * Die Owner-E-Mail wird ausschließlich aus der Umgebungsvariable gelesen;
 * ohne gesetzte Variable gibt es keinen Fallback-Admin.
 */
export const checkAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = String(context.claims?.email ?? "").toLowerCase();
    if (!email) return { allowed: false, isAdmin: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (OWNER_EMAIL && email === OWNER_EMAIL) {
      const { data: existingRole } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", context.userId)
        .eq("role", "admin")
        .maybeSingle();
      if (!existingRole) {
        await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: context.userId, role: "admin" }, { onConflict: "user_id,role" });
      }
    }

    const { data: allowedRow } = await supabaseAdmin
      .from("allowed_emails")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();

    return { allowed: Boolean(allowedRow), isAdmin: Boolean(roleRow) };
  });

/**
 * Prüft, ob eine (neue) E-Mail-Adresse auf der Whitelist steht.
 * Nur für angemeldete Nutzer, gibt ausschließlich ein Boolean zurück.
 */
export const isEmailAllowed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email: string }) => {
    const email = String(data?.email ?? "")
      .trim()
      .toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 255) {
      throw new Error("Ungültige E-Mail-Adresse");
    }
    return { email };
  })
  .handler(async ({ data }) => {
    if (OWNER_EMAIL && data.email === OWNER_EMAIL) return { allowed: true };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("allowed_emails")
      .select("id")
      .ilike("email", data.email)
      .maybeSingle();
    return { allowed: Boolean(row) };
  });
