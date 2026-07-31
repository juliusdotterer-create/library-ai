import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { checkAccess } from "@/lib/access.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Zugangs-Whitelist: nur freigeschaltete E-Mail-Adressen dürfen die App nutzen.
    const access = await checkAccess();
    if (!access.allowed) {
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
