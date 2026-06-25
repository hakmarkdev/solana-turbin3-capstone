import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BN } from "@coral-xyz/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  getAccount,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { AlertCircle, Loader2, Package } from "lucide-react";
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
import { CenteredMessage } from "@/components/centered-message";
import { useProgram } from "@/hooks/useProgram";
import { useConfig } from "@/hooks/useConfig";
import { useMintDecimals } from "@/hooks/useMintDecimals";
import { ata, createOrder } from "@/lib/actions";
import { orderPda } from "@/lib/pdas";
import { runTx } from "@/lib/tx-toast";
import {
  formatFeePct,
  formatTokenAmount,
  parseTokenAmount,
  tryPublicKey,
} from "@/lib/format";
import { MAX_ESCROW_SECONDS } from "@/lib/constants";

function defaultDeadline(): string {
  const d = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CreateOrder() {
  const navigate = useNavigate();
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const { program, canSign } = useProgram();
  const { config, initialized, loading: configLoading } = useConfig();

  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [orderId, setOrderId] = useState(() => String(Date.now()));
  const [submitting, setSubmitting] = useState(false);

  const [balance, setBalance] = useState<BN | null>(null);

  const mint = config?.allowedMint ?? null;
  const decimals = useMintDecimals(mint);

  // Load the buyer's USDC balance once the mint + wallet are known.
  useEffect(() => {
    if (!mint || !publicKey) return;
    let active = true;
    getAccount(connection, ata(mint, publicKey), "confirmed", TOKEN_PROGRAM_ID)
      .then((acc) => active && setBalance(new BN(acc.amount.toString())))
      .catch((e) => {
        if (!active) return;
        if (
          e instanceof TokenAccountNotFoundError ||
          e instanceof TokenInvalidAccountOwnerError
        ) {
          setBalance(new BN(0));
        } else {
          setBalance(null);
        }
      });
    return () => {
      active = false;
    };
  }, [connection, mint, publicKey]);

  const validation = useMemo(() => {
    if (!publicKey) return "Connect your wallet to continue";
    if (!merchant) return null;
    const merchantKey = tryPublicKey(merchant);
    if (!merchantKey) return "Merchant is not a valid address";
    if (merchantKey.equals(publicKey))
      return "Buyer and merchant must be different accounts";
    if (amount) {
      let raw: BN;
      try {
        raw = parseTokenAmount(amount, decimals);
      } catch (e) {
        return e instanceof Error ? e.message : "Amount is not a valid number";
      }
      if (raw.lten(0)) return "Amount must be greater than zero";
      if (balance && raw.gt(balance))
        return `Amount exceeds your balance (${formatTokenAmount(
          balance,
          decimals
        )} USDC)`;
    }
    const ts = Math.floor(new Date(deadline).getTime() / 1000);
    const now = Math.floor(Date.now() / 1000);
    if (!ts || isNaN(ts)) return "Pick a valid deadline";
    if (ts <= now) return "Deadline must be in the future";
    if (ts > now + MAX_ESCROW_SECONDS) return "Deadline must be within 90 days";
    return null;
  }, [publicKey, merchant, amount, deadline, decimals, balance]);

  const ready =
    publicKey &&
    merchant &&
    amount &&
    deadline &&
    decimals !== undefined &&
    !validation &&
    canSign;

  async function submit() {
    const merchantKey = tryPublicKey(merchant);
    if (!publicKey || !mint || !ready || !merchantKey || decimals === undefined)
      return;
    setSubmitting(true);
    const id = new BN(orderId);
    const sig = await runTx("Creating order", () =>
      createOrder(program, publicKey, {
        merchant: merchantKey,
        mint,
        amount: parseTokenAmount(amount, decimals),
        deadline: new BN(Math.floor(new Date(deadline).getTime() / 1000)),
        orderId: id,
      })
    );
    setSubmitting(false);
    if (sig) {
      navigate(`/orders/${orderPda(publicKey, id).toBase58()}`);
    }
  }

  if (!publicKey) {
    return (
      <CenteredMessage
        title="Connect your wallet"
        body="You need a connected Solana wallet to create an escrow order."
      >
        <WalletMultiButton />
      </CenteredMessage>
    );
  }

  if (!configLoading && !initialized) {
    return (
      <CenteredMessage
        title="Protocol not initialized"
        body="The StableCart Config account hasn't been created yet. An admin must initialize the protocol before orders can be funded."
      >
        <Button onClick={() => navigate("/admin")}>Go to Admin</Button>
      </CenteredMessage>
    );
  }

  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Package className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Create an order
          </h1>
          <p className="text-sm text-muted-foreground">
            Lock USDC into escrow for a merchant.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Order details</CardTitle>
          <CardDescription>
            Funds are held in a vault until you release them, the deadline
            passes, or a dispute is resolved.
            {config && (
              <>
                {" "}
                Protocol fee:{" "}
                <span className="font-medium text-foreground">
                  {formatFeePct(config.feeBps)}
                </span>
                .
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Merchant address">
            <Input
              placeholder="Recipient's wallet address"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value.trim())}
              spellCheck={false}
            />
          </Field>

          <Field
            label="Amount (USDC)"
            hint={
              balance !== null
                ? `Balance: ${formatTokenAmount(balance, decimals)} USDC`
                : undefined
            }
          >
            <Input
              type="number"
              min="0"
              step="0.000001"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>

          <Field label="Release deadline">
            <Input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </Field>

          <Field label="Order ID (nonce)" hint="Unique per buyer">
            <Input
              value={orderId}
              onChange={(e) =>
                setOrderId(e.target.value.replace(/[^0-9]/g, ""))
              }
            />
          </Field>

          {validation && merchant && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {validation}
            </div>
          )}

          <Button
            className="w-full"
            disabled={!ready || submitting}
            onClick={submit}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Fund escrow
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
