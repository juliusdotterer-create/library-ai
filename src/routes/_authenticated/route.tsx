import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

/**
 * Eigenständige Demo: keine Anmeldung. Alle Seiten laufen direkt mit dem
 * lokalen Benutzer, die Daten liegen im Browser (siehe integrations/local/db).
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
