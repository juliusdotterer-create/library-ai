import { useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Erschwertes Löschen: der exakte Name muss eingetippt werden.
 * Wird für endgültiges Löschen im Papierkorb verwendet.
 */
export function ConfirmDelete({
  name,
  title = "Endgültig löschen",
  description,
  onConfirm,
  children,
}: {
  name: string;
  title?: string;
  description?: string;
  onConfirm: () => void | Promise<void>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const ok = value.trim() === name.trim();

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setValue("");
      }}
    >
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent className="glass rounded-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description ??
              "Dieser Schritt kann nicht rückgängig gemacht werden. Tippe zur Bestätigung den Namen ein."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Name eintippen: <span className="font-semibold text-foreground">{name}</span>
          </Label>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={name}
            className="rounded-2xl"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-2xl">Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            disabled={!ok}
            className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={async (e) => {
              if (!ok) {
                e.preventDefault();
                return;
              }
              await onConfirm();
              setOpen(false);
              setValue("");
            }}
          >
            Endgültig löschen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
