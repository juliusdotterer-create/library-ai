import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type EmptyStateProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  className?: string;
};

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "col-span-full flex flex-col items-center gap-3 py-14 text-center",
        className,
      )}
    >
      <span className="flex size-14 items-center justify-center rounded-3xl bg-primary-soft text-primary shadow-sm">
        {icon}
      </span>
      <div className="max-w-xs space-y-1">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action && (
        <Button className="rounded-2xl" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
