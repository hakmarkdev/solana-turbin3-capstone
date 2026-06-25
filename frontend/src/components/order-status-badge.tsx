import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/lib/program";
import { cn } from "@/lib/utils";

const LABELS: Record<OrderStatus, string> = {
  funded: "Funded",
  released: "Released",
  refunded: "Refunded",
  disputed: "Disputed",
  resolved: "Resolved",
};

const STYLES: Record<OrderStatus, string> = {
  funded: "border-foreground/30 bg-foreground text-background",
  released: "border-transparent bg-muted text-muted-foreground",
  refunded: "border-transparent bg-muted text-muted-foreground",
  disputed: "border-destructive/40 bg-destructive/10 text-destructive",
  resolved: "border-transparent bg-muted text-muted-foreground",
};

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", STYLES[status], className)}
    >
      {LABELS[status]}
    </Badge>
  );
}
