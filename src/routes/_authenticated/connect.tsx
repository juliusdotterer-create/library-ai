import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bot,
  Check,
  Copy,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/connect")({
  component: ConnectPage,
  head: () => ({
    meta: [
      { title: "Mit Agent verbinden — Library" },
      { name: "description", content: "Verbinde ChatGPT, Claude oder andere MCP-Clients mit deiner Library." },
      { property: "og:title", content: "Mit Agent verbinden — Library" },
      { property: "og:description", content: "Verbinde ChatGPT, Claude oder andere MCP-Clients mit deiner Library." },
      { property: "og:type", content: "website" },
    ],
  }),
});

function makeSlug(name: string): string {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
  const reserved = ["workspace", "computer-use", "claude-in-chrome", "claude-preview", "claude-browser"];
  if (reserved.includes(normalized)) return `${normalized}-app`;
  return normalized || "lovable-app";
}

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={cn(
        "gap-2 transition-colors",
        copied && "border-green-500/50 text-green-600",
      )}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? "Kopiert" : label ?? "Kopieren"}
    </Button>
  );
}

function Step({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {number}
      </span>
      <span className="text-sm text-muted-foreground">{children}</span>
    </li>
  );
}

function ConnectPage() {
  const { mcpUrl, claudeCodeCommand, appName, encodedName, encodedUrl } = useMemo(() => {
    const name = "Library";
    const origin = typeof window !== "undefined" ? window.location.origin : "https://library-ai.lovable.app";
    const url = new URL("/mcp", origin).toString();
    const slug = makeSlug(name);
    return {
      mcpUrl: url,
      claudeCodeCommand: `claude mcp add --scope user --transport http ${slug} '${url.replace(/'/g, "'\\''")}'`,
      appName: name,
      encodedName: encodeURIComponent(name),
      encodedUrl: encodeURIComponent(url),
    };
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Mit Agent verbinden
        </h1>
        <p className="text-muted-foreground">
          Verbinde ChatGPT, Claude oder einen anderen MCP-Client mit {appName}, damit der Agent deine Library-Daten sicher als du einsehen kann.
        </p>
      </div>

      <Card className="glass overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bot className="size-5 text-primary" />
            MCP-Server-URL
          </CardTitle>
          <CardDescription>
            Diese URL wird in deinem AI-Client eingefügt. Sie passt sich automatisch der aktuellen Domain an.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <code className="flex-1 rounded-xl bg-muted/50 px-4 py-3 text-sm break-all">
              {mcpUrl}
            </code>
            <CopyButton value={mcpUrl} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="chatgpt" className="w-full">
        <TabsList className="grid h-auto min-h-9 w-full grid-cols-2 gap-1 sm:h-9 sm:grid-cols-5">
          <TabsTrigger value="chatgpt">ChatGPT</TabsTrigger>
          <TabsTrigger value="claude">Claude</TabsTrigger>
          <TabsTrigger value="claude-code">Claude Code</TabsTrigger>
          <TabsTrigger value="anara">Anara</TabsTrigger>
          <TabsTrigger value="other">Andere</TabsTrigger>
        </TabsList>

        <TabsContent value="anara" className="mt-4 space-y-4">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bot className="size-5 text-primary" />
                Anara verbinden
              </CardTitle>
              <CardDescription>
                Anara greift dann über deine Anmeldung auf deine eigenen Dokumente, Ordner und Termine zu.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Deine {appName}-Adresse für Anara</p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <code className="flex-1 rounded-xl bg-muted/50 px-4 py-3 text-sm break-all">
                    {mcpUrl}
                  </code>
                  <CopyButton value={mcpUrl} />
                </div>
              </div>
              <ol className="space-y-3">
                <Step number={1}>
                  Öffne in{" "}
                  <a
                    href="https://anara.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    anara.com
                    <ExternalLink className="size-3" />
                  </a>{" "}
                  die Einstellungen für Verbindungen bzw. MCP.
                </Step>
                <Step number={2}>Lege eine neue MCP-Verbindung an und füge die obige {appName}-Adresse ein.</Step>
                <Step number={3}>Melde dich im geöffneten Fenster mit deinem {appName}-Konto an.</Step>
                <Step number={4}>Bitte Anara anschließend, in {appName} zu suchen oder Dokumente zu lesen.</Step>
              </ol>
              <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-4">
                <p className="text-sm font-medium text-foreground">Umgekehrte Richtung: Anaras eigene MCP-Adresse</p>
                <p className="text-sm text-muted-foreground">
                  Diese Adresse brauchst du nur, wenn ein anderer Agent auf deine Anara-Quellen zugreifen soll – nicht für die Verbindung oben.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <code className="flex-1 rounded-xl bg-background/60 px-4 py-3 text-sm break-all">
                    https://anara.com/api/mcp
                  </code>
                  <CopyButton value="https://anara.com/api/mcp" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chatgpt" className="mt-4 space-y-4">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="size-5 text-primary" />
                ChatGPT verbinden
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                <Step number={1}>
                  Öffne{" "}
                  <a
                    href="https://chatgpt.com/#settings/Connectors/Advanced"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  >
                    chatgpt.com/#settings/Connectors/Advanced
                    <ExternalLink className="size-3" />
                  </a>{" "}
                  und aktiviere den Entwicklermodus (Developer mode).
                </Step>
                <Step number={2}>Klicke auf „Create app“ und gib der Verbindung einen Namen.</Step>
                <Step number={3}>Füge die obige MCP-URL ein und erstelle die Verbindung.</Step>
                <Step number={4}>Aktiviere die App im Chat-Composer und frage ChatGPT, {appName} zu nutzen.</Step>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="claude" className="mt-4 space-y-4">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="size-5 text-primary" />
                Claude verbinden
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Claude öffnet das Connector-Formular mit Name und URL vorausgefüllt:
              </p>
              <Button
                variant="outline"
                className="w-full gap-2"
                asChild
              >
                <a
                  href={`https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=${encodedName}&connectorUrl=${encodedUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Connector in Claude öffnen
                  <ExternalLink className="size-4" />
                </a>
              </Button>
              <ol className="space-y-3">
                <Step number={1}>Klicke oben auf „Connector in Claude öffnen“.</Step>
                <Step number={2}>Prüfe Name und URL, dann klicke auf „Add“.</Step>
                <Step number={3}>Aktiviere den Connector im Chat-Composer und bitte Claude, {appName} zu nutzen.</Step>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="claude-code" className="mt-4 space-y-4">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Terminal className="size-5 text-primary" />
                Claude Code verbinden
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Führe diesen einzeiligen Befehl im Terminal aus:
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <code className="flex-1 rounded-xl bg-muted/50 px-4 py-3 text-sm break-all">
                  {claudeCodeCommand}
                </code>
                <CopyButton value={claudeCodeCommand} />
              </div>
              <ol className="space-y-3">
                <Step number={1}>Kopiere und führe den Befehl aus.</Step>
                <Step number={2}>Starte Claude Code und gib <code className="rounded bg-muted px-1 py-0.5 text-xs">/mcp</code> ein, um die Verbindung zu prüfen.</Step>
                <Step number={3}>Bei geschütztem Server meldest du dich im angezeigten OAuth-Fenster an.</Step>
                <Step number={4}>Frage Claude Code, {appName} zu nutzen.</Step>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="other" className="mt-4 space-y-4">
          <Card className="glass">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bot className="size-5 text-primary" />
                Anderer MCP-Client
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                <Step number={1}>Öffne die MCP-Server- oder Connector-Einstellungen deines Clients.</Step>
                <Step number={2}>Erstelle eine neue Remote-MCP-Server-Verbindung.</Step>
                <Step number={3}>Gib der Verbindung einen Namen und füge die obige MCP-URL ein.</Step>
                <Step number={4}>Schließe die Anmeldung bzw. OAuth-Autorisierung ab.</Step>
                <Step number={5}>Aktiviere die Verbindung und bitte den Agenten, {appName} zu nutzen.</Step>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <RefreshCw className="size-5 text-primary" />
            Tools aktualisieren
          </CardTitle>
          <CardDescription>
            Wenn sich die App ändert, musst du die Tool-Liste im Agenten neu laden.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><strong>ChatGPT:</strong> App-Einstellungen → Connector → „Refresh“ neben Information.</li>
            <li><strong>Claude:</strong> Connectors-Seite → Connector auswählen → Tools aktualisieren.</li>
            <li><strong>Claude Code:</strong> Neue Sitzung startet automatisch mit den aktuellen Tools. Bei geänderter URL: <code className="rounded bg-muted px-1 py-0.5 text-xs">claude mcp remove library</code>, dann den Install-Befehl erneut ausführen.</li>
            <li><strong>Anara:</strong> Verbindungs-Einstellungen öffnen, die Library-Verbindung auswählen und neu laden.</li>
            <li><strong>Andere:</strong> In den Connector-Einstellungen „Reload“ oder „Reconnect“ wählen.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
