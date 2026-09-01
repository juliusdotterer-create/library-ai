import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { checkAccess } from "@/lib/access.functions";

function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("abort") ||
    msg.includes("failed to fetch")
  );
}

/** Ergebnis der Zugangsprüfung pro Sitzung zwischenspeichern (5 Minuten). */
let accessCache: { userId: string; allowed: boolean; at: number } | null = null;
const ACCESS_TTL = 5 * 60_000;

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Session lokal lesen (kein Server-Roundtrip pro Seitenwechsel).
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user ?? null;
    if (!user) throw redirect({ to: "/auth" });

    const cached =
      accessCache && accessCache.userId === user.id && Date.now() - accessCache.at < ACCESS_TTL
        ? accessCache
        : null;

    // Zugangs-Whitelist: nur freigeschaltete E-Mail-Adressen dürfen die App nutzen.
    // Nur bei echten Netzwerk-/Timeout-Fehlern fail-open, sonst fail-closed.
    let allowed = true;
    if (cached) {
      allowed = cached.allowed;
    } else {
      try {
        allowed = (await checkAccess()).allowed;
        accessCache = { userId: user.id, allowed, at: Date.now() };
      } catch (err) {
        if (!isNetworkError(err)) {
          accessCache = null;
          await supabase.auth.signOut();
          throw redirect({ to: "/auth" });
        }
        // Bei Netzwerkproblemen vorübergehend durchlassen, damit die App nicht hängt.
        allowed = true;
      }
    }
    if (!allowed) {
      accessCache = null;
      if (typeof window !== "undefined") window.localStorage.setItem("access_blocked", "1");
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }

    return { user };
  },

  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
