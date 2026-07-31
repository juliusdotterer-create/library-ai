import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const OWNER_EMAIL = "julius.dotterer@gmail.com";

/**
 * Prüft serverseitig, ob der angemeldete Nutzer freigeschaltet ist,
 * und legt für den Eigentümer-Account die Admin-Rolle an.
 */
export const checkAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = String(context.claims?.email ?? "").toLowerCase();
    if (!email) return { allowed: false, isAdmin: false };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (email === OWNER_EMAIL) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: context.userId, role: "admin" }, { onConflict: "user_id,role" });
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
