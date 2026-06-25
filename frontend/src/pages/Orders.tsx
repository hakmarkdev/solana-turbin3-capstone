import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { Inbox, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderCard } from "@/components/order-card";
import { useOrders, type OrderEntry } from "@/hooks/useOrders";
import { rolesFor, statusOf, type Role } from "@/lib/program";

type Tab = "all" | Role;

export function Orders() {
  const { publicKey } = useWallet();
  const { orders, loading, error, refresh } = useOrders();
  const { buckets, primary } = useMemo(() => {
    const buckets: Record<Tab, OrderEntry[]> = {
      all: orders,
      buyer: [],
      merchant: [],
      arbiter: [],
    };
    const primary = new Map<string, Role>();
    for (const e of orders) {
      const roles = rolesFor(e.account, publicKey);
      if (roles[0]) primary.set(e.publicKey.toBase58(), roles[0]);
      if (roles.includes("buyer")) buckets.buyer.push(e);
      if (roles.includes("merchant")) buckets.merchant.push(e);
      if (roles.includes("arbiter") && statusOf(e.account) === "disputed")
        buckets.arbiter.push(e);
    }
    return { buckets, primary };
  }, [orders, publicKey]);

  return (
    <div className="py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Active escrow orders on-chain. Settled orders are closed and drop
            off this list.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => refresh()}>
            <RefreshCw className={loading ? "animate-spin" : ""} />
          </Button>
          <Button asChild>
            <Link to="/create">
              <Plus className="h-4 w-4" /> New order
            </Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({buckets.all.length})</TabsTrigger>
          <TabsTrigger value="buyer" disabled={!publicKey}>
            Buying ({buckets.buyer.length})
          </TabsTrigger>
          <TabsTrigger value="merchant" disabled={!publicKey}>
            Selling ({buckets.merchant.length})
          </TabsTrigger>
          <TabsTrigger value="arbiter" disabled={!publicKey}>
            To arbitrate ({buckets.arbiter.length})
          </TabsTrigger>
        </TabsList>

        {(["all", "buyer", "merchant", "arbiter"] as Tab[]).map((tab) => (
          <TabsContent key={tab} value={tab}>
            <OrderGrid
              loading={loading}
              error={error}
              entries={buckets[tab]}
              primary={primary}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function OrderGrid({
  loading,
  error,
  entries,
  primary,
}: {
  loading: boolean;
  error: string | null;
  entries: OrderEntry[];
  primary: Map<string, Role>;
}) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-56" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-destructive">
          Failed to load orders: {error}
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Inbox className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium">No orders here yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            When an order matching this filter is created, it'll show up here.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/create">
              <Plus className="h-4 w-4" /> Create one
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((e) => (
        <OrderCard
          key={e.publicKey.toBase58()}
          entry={e}
          role={primary.get(e.publicKey.toBase58())}
        />
      ))}
    </div>
  );
}
