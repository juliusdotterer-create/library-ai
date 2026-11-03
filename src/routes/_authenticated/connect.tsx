import { createFileRoute } from "@tanstack/react-router";
import { AgentConnectPanel } from "@/components/AgentConnectPanel";

export const Route = createFileRoute("/_authenticated/connect")({
  component: ConnectPage,
  head: () => ({
    meta: [
      { title: "Mit Agent verbinden — Library" },
      { name: "description", content: "Verbinde ChatGPT, Claude oder andere MCP-Clients mit deiner Library." },
      { property: "og:title", content: "Mit Agent verbinden — Library" },
      { property: "og:description", content: "Verbinde ChatGPT, Claude oder andere MCP-Clients mit deiner Library." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function ConnectPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Mit Agent verbinden
        </h1>
        <p className="text-muted-foreground">
          Verbinde ChatGPT, Claude oder einen anderen MCP-Client mit Library, damit der Agent deine Library-Daten sicher als du einsehen kann.
        </p>
      </div>

      <AgentConnectPanel />
    </div>
  );
}
