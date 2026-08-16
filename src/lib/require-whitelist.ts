import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Serverseitiges Gate für die Einladungs-Whitelist.
 *
 * Ergänzt `requireSupabaseAuth`: Neben einer gültigen Session muss die
 * E-Mail-Adresse des Nutzers auf der Whitelist stehen (oder der Nutzer muss
 * Admin sein). Dadurch greift die Invite-Only-Regel für jede Server-Funktion
 * und nicht nur beim Navigieren in der UI.
 */
export const requireWhitelisted = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { data, error } = await context.supabase.rpc("is_whitelisted");
    if (error || data !== true) {
      throw new Error("Forbidden: Account ist nicht freigeschaltet");
    }
    return next();
  });
