import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PDF_FAILURE_TEXT, type PdfFailure } from "@/lib/pdf-errors";

export function PdfFailureView({ failure, onPassword }: { failure: PdfFailure; onPassword: (pw: string) => void }) {
  const [pw, setPw] = useState("");
  if (failure === "password" || failure === "wrong-password") {
    return (
      <form
        className="mx-auto flex max-w-xs flex-col items-center gap-3 py-10 text-center"
        onSubmit={(e) => { e.preventDefault(); if (pw) onPassword(pw); }}
      >
        <Lock className="size-6 text-muted-foreground" />
        <p className="text-sm font-semibold">Diese PDF ist passwortgeschützt</p>
        {failure === "wrong-password" && <p className="text-xs text-destructive">Passwort falsch – bitte erneut versuchen.</p>}
        <input
          type="password"
          autoFocus
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Passwort eingeben"
          className="w-full rounded-xl border border-field-border bg-field px-3 py-2 text-sm"
        />
        <Button type="submit" className="rounded-2xl" disabled={!pw}>Öffnen</Button>
      </form>
    );
  }
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-2 py-10 text-center">
      {failure === "drm" && <Lock className="size-6 text-muted-foreground" />}
      <p className="text-sm text-muted-foreground">{PDF_FAILURE_TEXT[failure]}</p>
    </div>
  );
}
