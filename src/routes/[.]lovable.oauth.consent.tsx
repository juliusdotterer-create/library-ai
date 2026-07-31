import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

type OAuthDetails = {
  client?: { name?: string; redirect_uri?: string };
  scope?: string;
  redirect_url?: string;
  redirect_to?: string;
};


export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const details = data as OAuthDetails | null;
    const immediate = details?.redirect_url ?? details?.redirect_to;
    if (immediate && !details?.client) throw redirect({ href: immediate });
    return details;
  },

  component: Consent,
  errorComponent: ({ error }) => (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="glass max-w-md rounded-[2rem] p-7 text-sm">
        Diese Autorisierungsanfrage konnte nicht geladen werden:{" "}
        {String((error as Error)?.message ?? error)}
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData() as {
    client?: { name?: string; redirect_uri?: string };
    scope?: string;
    user?: { email?: string };
  } | null;
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientName = details?.client?.name ?? "Diese Anwendung";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await supabase.auth.oauth.approveAuthorization(authorization_id)
      : await supabase.auth.oauth.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("Der Autorisierungsserver hat kein Ziel zurückgegeben.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="glass w-full max-w-md rounded-[2rem] p-7">
        <div className="mb-5 flex items-center gap-3">
          <Logo className="size-11" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              {clientName} mit Library verbinden
            </h1>
            <p className="text-sm text-muted-foreground">
              {clientName} kann die freigegebenen Werkzeuge in deinem Namen nutzen.
            </p>
          </div>
        </div>

        <ul className="mb-5 space-y-2 text-sm">
          <li>• Deine Dokumente und Ordner lesen und durchsuchen</li>
          <li>• Deine Termine lesen und neue Termine anlegen</li>
          <li>• Deine Lehrplan-Aufgaben und Links lesen</li>
        </ul>

        {details?.client?.redirect_uri ? (
          <p className="mb-4 break-all text-xs text-muted-foreground">
            Weiterleitung an: {details.client.redirect_uri}
          </p>
        ) : null}

        <p className="mb-5 text-xs text-muted-foreground">
          Die Zugriffsregeln dieser App bleiben bestehen – es werden nur deine eigenen Daten sichtbar.
        </p>

        {error ? (
          <p role="alert" className="mb-4 rounded-2xl border border-primary/40 bg-primary/10 p-3 text-sm">
            {error}
          </p>
        ) : null}

        <div className="flex gap-3">
          <Button className="flex-1 rounded-2xl" disabled={busy} onClick={() => void decide(true)}>
            Zugriff erlauben
          </Button>
          <Button
            variant="outline"
            className="flex-1 rounded-2xl"
            disabled={busy}
            onClick={() => void decide(false)}
          >
            Abbrechen
          </Button>
        </div>
      </div>
    </main>
  );
}
