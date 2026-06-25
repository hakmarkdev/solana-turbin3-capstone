import { Link } from "react-router-dom";
import { ArrowRight, Clock } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { Address } from "@/components/address";
import type { OrderEntry } from "@/hooks/useOrders";
import { statusOf, type Role } from "@/lib/program";
import { deadlinePassed, formatTokenAmount, relativeTime } from "@/lib/format";
import { useMintDecimals } from "@/hooks/useMintDecimals";
import { cn } from "@/lib/utils";

export function OrderCard({ entry, role }: { entry: OrderEntry; role?: Role }) {
  const { account, publicKey } = entry;
  const status = statusOf(account);
  const overdue = deadlinePassed(account.deadline);
  const decimals = useMintDecimals(account.mint);

  return (
    <Link to={`/orders/${publicKey.toBase58()}`} className="group block">
      <Card className="transition-colors group-hover:border-foreground/40">
        <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">
              Order #{account.orderId.toString()}
            </div>
            <div className="text-2xl font-semibold tracking-tight">
              {formatTokenAmount(account.amount, decimals)}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                USDC
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <OrderStatusBadge status={status} />
            {role && (
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                you: {role}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-0 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Buyer</span>
            <Address value={account.buyer} link={false} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Merchant</span>
            <Address value={account.merchant} link={false} />
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" /> Deadline
            </span>
            <span
              className={cn(
                "text-xs",
                overdue && status === "funded"
                  ? "text-destructive"
                  : "text-foreground"
              )}
            >
              {relativeTime(account.deadline)}
            </span>
          </div>
          <div className="flex items-center justify-end pt-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
            View details
            <ArrowRight className="ml-1 h-3 w-3" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
