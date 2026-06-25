import { Link } from "react-router-dom";
import {
  ArrowRight,
  Gavel,
  Lock,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Timer,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STEPS = [
  {
    icon: Lock,
    title: "Buyer funds escrow",
    body: "The buyer locks USDC into an on-chain vault tied to a single order. Funds never touch the merchant until terms are met.",
  },
  {
    icon: ShieldCheck,
    title: "Merchant delivers",
    body: "The buyer confirms release and the merchant is paid, minus a small protocol fee. No delivery? The merchant can refund anytime.",
  },
  {
    icon: Gavel,
    title: "Disputes, resolved",
    body: "Either party can open a dispute before the deadline. A neutral arbiter splits the funds fairly between buyer and merchant.",
  },
];

const FEATURES = [
  {
    icon: Lock,
    title: "Non-custodial escrow",
    body: "Each order owns its own vault PDA. Only the programs rules can move the money.",
  },
  {
    icon: Timer,
    title: "Deadline protection",
    body: "If the buyer goes quiet, the merchant can claim funds after the deadline passes.",
  },
  {
    icon: RefreshCw,
    title: "Instant refunds",
    body: "Merchants return the full amount to the buyer with a single transaction no fee taken.",
  },
  {
    icon: Gavel,
    title: "Arbitrated disputes",
    body: "A protocol arbiter resolves contested orders with a basis-point split.",
  },
];

export function Home() {
  return (
    <div className="space-y-20 py-10">
      {/* Hero */}
      <section className="mx-auto max-w-3xl text-center">
        <div className="mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <ShoppingCart className="h-16 w-16" />
        </div>
        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-6xl">
          Trustless checkout for{" "}
          <span className="underline decoration-4 underline-offset-8">
            marketplace
          </span>{" "}
          orders.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
          StableCart locks USDC in a per order vault and releases it to the
          merchant only when the deal is done with deadline protection, refunds,
          and arbitrated disputes built in.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/create">
              Create an order <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/orders">Browse orders</Link>
          </Button>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl">
        <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight">
          How it works
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Card key={s.title} className="relative">
              <CardHeader>
                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <s.icon className="h-5 w-5" />
                </div>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {s.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{s.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl">
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <Card key={f.title}>
              <CardHeader className="flex-row items-center gap-3 space-y-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border">
                  <f.icon className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base">{f.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{f.body}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl">
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <Wallet className="h-8 w-8" />
            <h3 className="text-2xl font-semibold">
              Connect your wallet to get started
            </h3>
            <p className="max-w-md text-sm text-primary-foreground/70">
              Connect a Solana wallet, fund your first escrow order, and settle
              with confidence.
            </p>
            <Button asChild variant="secondary" size="lg">
              <Link to="/create">
                Start an order <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
