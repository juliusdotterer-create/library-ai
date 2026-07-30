import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Library – Dokumente, Kalender & Lehrpläne" },
      {
        name: "description",
        content:
          "Persönliches Studienarchiv: PDFs und Dateien in verschachtelten Ordnern, integrierter Kalender, eigene Lehrpläne und ein Linktree – in Off-White, Orange und Darkmode.",
      },
      { property: "og:title", content: "Library – Dokumente, Kalender & Lehrpläne" },
      {
        property: "og:description",
        content: "Persönliches Studienarchiv: PDFs und Dateien in verschachtelten Ordnern, integrierter Kalender, eigene Lehrpläne und ein Linktree – in Off-White, Orange und Darkmode.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      navigate({ to: data.session ? "/library" : "/auth", replace: true });
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="glass flex items-center gap-3 rounded-3xl px-6 py-4">
        <Logo className="size-8" />
        <h1 className="text-sm font-medium text-muted-foreground">Library wird geladen…</h1>
      </div>
    </div>
  );
}
