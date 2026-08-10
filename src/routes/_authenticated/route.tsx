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

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Zugangs-Whitelist: nur freigeschaltete E-Mail-Adressen dürfen die App nutzen.
    // Nur bei echten Netzwerk-/Timeout-Fehlern fail-open, sonst fail-closed.
    let allowed = true;
    try {
      allowed = (await checkAccess()).allowed;
    } catch (err) {
      if (!isNetworkError(err)) {
        await supabase.auth.signOut();
        throw redirect({ to: "/auth" });
      }
      // Bei Netzwerkproblemen vorübergehend durchlassen, damit die App nicht hängt.
      allowed = true;
    }
    if (!allowed) {
      if (typeof window !== "undefined") window.localStorage.setItem("access_blocked", "1");
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }

    return { user: data.user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
