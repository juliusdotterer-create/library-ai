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
 * Erschwertes Löschen: zur Bestätigung muss "ja" eingetippt werden.
 */
export function ConfirmDelete({
  name,
  title = "Endgültig löschen",
  description,
  confirmLabel = "Endgültig löschen",
  onConfirm,
  children,
  open: openProp,
  onOpenChange,
}: {
  name: string;
  title?: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openState, setOpenState] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const setOpen = (o: boolean) => {
    if (!controlled) setOpenState(o);
    onOpenChange?.(o);
  };
  const [value, setValue] = useState("");
  const ok = value.trim().toLowerCase() === "ja";

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setValue("");
      }}
    >
      {children && <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>}
      <AlertDialogContent className="glass rounded-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description ??
              `„${name}“ wird endgültig gelöscht. Dieser Schritt kann nicht rückgängig gemacht werden.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Zum Bestätigen <span className="font-semibold text-foreground">ja</span> eintippen
          </Label>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="ja"
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
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
