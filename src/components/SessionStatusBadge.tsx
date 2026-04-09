import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SessionStatus = "setup" | "active" | "closed";

const statusConfig: Record<SessionStatus, { label: string; className: string }> = {
  setup: { label: "Setup", className: "bg-muted text-muted-foreground border-transparent" },
  active: { label: "Active", className: "bg-success text-success-foreground border-transparent" },
  closed: { label: "Closed", className: "bg-destructive text-destructive-foreground border-transparent" },
};

export function SessionStatusBadge({ status, className }: { status: SessionStatus; className?: string }) {
  const config = statusConfig[status];
  return (
    <Badge className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
