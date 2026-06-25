import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BN } from "@coral-xyz/anchor";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  ArrowLeft,
  CheckCircle2,
  Gavel,
  Loader2,
  RotateCcw,
  ShieldAlert,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Address } from "@/components/address";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { DataRow } from "@/components/data-row";
import { CenteredMessage } from "@/components/centered-message";
import { useOrder } from "@/hooks/useOrders";
import { useProgram } from "@/hooks/useProgram";
import { useMintDecimals } from "@/hooks/useMintDecimals";
import { rolesFor, statusOf } from "@/lib/program";
import {
  claimAfterDeadline,
  confirmRelease,
  openDispute,
  refund,
  resolveDispute,
} from "@/lib/actions";
import { runTx } from "@/lib/tx-toast";
import {
  applyBps,
  computeSplit,
  deadlinePassed,
  formatDeadline,
  formatFeePct,
  formatTokenAmount,
  relativeTime,
  tryPublicKey,
} from "@/lib/format";

export function OrderDetail() {
  const { address } = useParams<{ address: string }>();
  const navigate = useNavigate();
  const { publicKey } = useWallet();
  const { program, canSign } = useProgram();

  const pubkey = useMemo(
    () => (address ? tryPublicKey(address) : null),
    [address]
  );

  const { order, loading, refresh } = useOrder(pubkey);
  const decimals = useMintDecimals(order?.mint);
  const [busy, setBusy] = useState(false);

  if (!pubkey) {
    return <NotFound message="That's not a valid order address." />;
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-10">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <NotFound message="This order doesn't exist, or it has already been settled and closed on-chain." />
    );
  }

  const status = statusOf(order);
  const roles = rolesFor(order, publicKey);
  const isBuyer = roles.includes("buyer");
  const isMerchant = roles.includes("merchant");
  const isArbiter = roles.includes("arbiter");
  const overdue = deadlinePassed(order.deadline);
  const fee = applyBps(order.amount, order.feeBps);
  const merchantNet = order.amount.sub(fee);

  async function act(
    label: string,
    fn: () => Promise<string>,
    after: "navigate" | "refresh" = "navigate"
  ) {
    setBusy(true);
    const sig = await runTx(label, fn);
    setBusy(false);
    if (!sig) return;
    if (after === "refresh") await refresh();
    else navigate("/orders");
  }

  return (
    <div className="mx-auto max-w-2xl py-10">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 mb-4 text-muted-foreground"
        onClick={() => navigate("/orders")}
      >
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardDescription>
                Order #{order.orderId.toString()}
              </CardDescription>
              <CardTitle className="mt-1 text-3xl">
                {formatTokenAmount(order.amount, decimals)}{" "}
                <span className="text-base font-normal text-muted-foreground">
                  USDC
                </span>
              </CardTitle>
            </div>
            <OrderStatusBadge status={status} />
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid gap-3 text-sm">
            <DataRow label="Escrow account">
              <Address value={pubkey} />
            </DataRow>
            <DataRow label="Buyer">
              <Address value={order.buyer} />
            </DataRow>
            <DataRow label="Merchant">
              <Address value={order.merchant} />
            </DataRow>
            <DataRow label="Arbiter">
              <Address value={order.arbiter} />
            </DataRow>
            <Separator />
            <DataRow label="Protocol fee">
              <span>
                {formatTokenAmount(fee, decimals)} USDC (
                {formatFeePct(order.feeBps)})
              </span>
            </DataRow>
            <DataRow label="Merchant receives on release">
              <span>{formatTokenAmount(merchantNet, decimals)} USDC</span>
            </DataRow>
            <Separator />
            <DataRow label="Deadline" align="start">
              <span className="text-right">
                {formatDeadline(order.deadline)}
                <span
                  className={
                    overdue && status === "funded"
                      ? "block text-xs text-destructive"
                      : "block text-xs text-muted-foreground"
                  }
                >
                  {relativeTime(order.deadline)}
                </span>
              </span>
            </DataRow>
          </div>

          {publicKey && (isBuyer || isMerchant || isArbiter) && (
            <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              You are the{" "}
              <span className="font-medium text-foreground">
                {[
                  isBuyer && "buyer",
                  isMerchant && "merchant",
                  isArbiter && "arbiter",
                ]
                  .filter(Boolean)
                  .join(" & ")}
              </span>{" "}
              on this order.
            </div>
          )}

          {/* Actions */}
          <Actions
            status={status}
            isBuyer={isBuyer}
            isMerchant={isMerchant}
            isArbiter={isArbiter}
            overdue={overdue}
            canSign={canSign}
            busy={busy}
            onRelease={() =>
              act("Releasing funds", () =>
                confirmRelease(program, publicKey!, pubkey, order)
              )
            }
            onRefund={() =>
              act("Refunding buyer", () =>
                refund(program, publicKey!, pubkey, order)
              )
            }
            onClaim={() =>
              act("Claiming funds", () =>
                claimAfterDeadline(program, publicKey!, pubkey, order)
              )
            }
            onDispute={() =>
              act(
                "Opening dispute",
                () => openDispute(program, publicKey!, pubkey),
                "refresh"
              )
            }
            onResolve={(buyerBps) =>
              act("Resolving dispute", () =>
                resolveDispute(program, publicKey!, pubkey, order, buyerBps)
              )
            }
            amount={order.amount}
            feeBps={order.feeBps}
            decimals={decimals}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Actions(props: {
  status: string;
  isBuyer: boolean;
  isMerchant: boolean;
  isArbiter: boolean;
  overdue: boolean;
  canSign: boolean;
  busy: boolean;
  onRelease: () => void;
  onRefund: () => void;
  onClaim: () => void;
  onDispute: () => void;
  onResolve: (buyerBps: number) => void;
  amount: BN;
  feeBps: number;
  decimals?: number;
}) {
  const { status, isBuyer, isMerchant, isArbiter, overdue, canSign, busy } =
    props;

  if (!canSign) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Connect the buyer, merchant, or arbiter wallet to act on this order.
      </p>
    );
  }

  const buttons: React.ReactNode[] = [];

  if (status === "funded") {
    if (isBuyer) {
      buttons.push(
        <Button key="release" disabled={busy} onClick={props.onRelease}>
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Release funds to merchant
        </Button>
      );
    }
    if (isMerchant) {
      buttons.push(
        <Button
          key="refund"
          variant="outline"
          disabled={busy}
          onClick={props.onRefund}
        >
          <RotateCcw className="h-4 w-4" /> Refund buyer
        </Button>
      );
      if (overdue) {
        buttons.push(
          <Button key="claim" disabled={busy} onClick={props.onClaim}>
            <Timer className="h-4 w-4" /> Claim (deadline passed)
          </Button>
        );
      }
    }
    if ((isBuyer || isMerchant) && !overdue) {
      buttons.push(
        <Button
          key="dispute"
          variant="destructive"
          disabled={busy}
          onClick={props.onDispute}
        >
          <ShieldAlert className="h-4 w-4" /> Open dispute
        </Button>
      );
    }
  }

  if (status === "disputed" && isArbiter) {
    buttons.push(
      <ResolveDialog
        key="resolve"
        busy={busy}
        amount={props.amount}
        feeBps={props.feeBps}
        decimals={props.decimals}
        onResolve={props.onResolve}
      />
    );
  }

  if (buttons.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        {status === "funded"
          ? "No actions available for your wallet on this order."
          : status === "disputed"
            ? "This order is in dispute. Only the arbiter can resolve it."
            : "This order is settled."}
      </p>
    );
  }

  return <div className="flex flex-col gap-2">{buttons}</div>;
}

function ResolveDialog({
  busy,
  amount,
  feeBps,
  decimals,
  onResolve,
}: {
  busy: boolean;
  amount: BN;
  feeBps: number;
  decimals?: number;
  onResolve: (buyerBps: number) => void;
}) {
  const [pct, setPct] = useState("50");
  const pctNum = Number(pct);
  const validPct =
    pct.trim() !== "" && !isNaN(pctNum) && pctNum >= 0 && pctNum <= 100;
  const buyerBps = Math.round(Math.min(100, Math.max(0, pctNum || 0)) * 100);
  const buyerPct = (buyerBps / 100).toString();
  const merchantPct = ((10000 - buyerBps) / 100).toString();
  const { buyerShare, merchantShare, fee } = computeSplit(
    amount,
    feeBps,
    buyerBps
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button disabled={busy}>
          <Gavel className="h-4 w-4" /> Resolve dispute
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resolve dispute</DialogTitle>
          <DialogDescription>
            Decide what share of the escrow goes back to the buyer. The
            remainder (minus protocol fee) goes to the merchant.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Buyer refund share (%)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="1"
              value={pct}
              onChange={(e) => setPct(e.target.value)}
            />
          </div>

          <div className="space-y-1 rounded-md border p-3 text-sm">
            <Split
              label="Buyer receives"
              value={`${formatTokenAmount(buyerShare, decimals)} USDC`}
            />
            <Split
              label="Merchant receives"
              value={`${formatTokenAmount(merchantShare, decimals)} USDC`}
            />
            <Split
              label="Protocol fee"
              value={`${formatTokenAmount(fee, decimals)} USDC`}
              muted
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            disabled={busy || !validPct}
            onClick={() => onResolve(buyerBps)}
            className="w-full"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {validPct
              ? `Confirm split (${buyerPct}% / ${merchantPct}%)`
              : "Enter a share between 0 and 100"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Split({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className={muted ? "text-muted-foreground" : "font-medium"}>
        {value}
      </span>
    </div>
  );
}

function NotFound({ message }: { message: string }) {
  return (
    <CenteredMessage title="Order not found" body={message}>
      <Button asChild variant="outline">
        <Link to="/orders">Back to orders</Link>
      </Button>
    </CenteredMessage>
  );
}
