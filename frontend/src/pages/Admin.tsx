import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { AlertCircle, Loader2, Settings2, ShieldCheck } from "lucide-react";
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
import { Address } from "@/components/address";
import { DataRow } from "@/components/data-row";
import { useConfig } from "@/hooks/useConfig";
import { useProgram } from "@/hooks/useProgram";
import { initialize } from "@/lib/actions";
import { configPda, treasuryPda } from "@/lib/pdas";
import { runTx } from "@/lib/tx-toast";
import { formatFeePct, tryPublicKey } from "@/lib/format";
import { DEFAULT_USDC_MINT, MAX_FEE_BPS } from "@/lib/constants";

export function Admin() {
  const { publicKey } = useWallet();
  const { program, canSign } = useProgram();
  const { config, initialized, loading, refresh } = useConfig();

  return (
    <div className="mx-auto max-w-xl py-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Settings2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Protocol admin
          </h1>
          <p className="text-sm text-muted-foreground">
            The global StableCart configuration singleton.
          </p>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-72 w-full" />
      ) : initialized && config ? (
        <ConfigView config={config} />
      ) : !publicKey ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-muted-foreground">
              Connect a wallet to initialize the protocol.
            </p>
            <WalletMultiButton />
          </CardContent>
        </Card>
      ) : (
        <InitializeForm
          admin={publicKey}
          canSign={canSign}
          onDone={refresh}
          initialize={(feeBps, arbiter, mint) =>
            initialize(program, publicKey, { feeBps, arbiter, mint })
          }
        />
      )}
    </div>
  );
}

function ConfigView({
  config,
}: {
  config: NonNullable<ReturnType<typeof useConfig>["config"]>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" /> Protocol initialized
        </CardTitle>
        <CardDescription>
          These values were set at initialization and govern every order.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <DataRow label="Admin">
          <Address value={config.admin} />
        </DataRow>
        <DataRow label="Arbiter">
          <Address value={config.arbiter} />
        </DataRow>
        <DataRow label="Allowed mint (USDC)">
          <Address value={config.allowedMint} />
        </DataRow>
        <Separator />
        <DataRow label="Protocol fee">
          <span>
            {formatFeePct(config.feeBps)} ({config.feeBps} bps)
          </span>
        </DataRow>
        <DataRow label="Config PDA">
          <Address value={configPda()} />
        </DataRow>
        <DataRow label="Treasury PDA">
          <Address value={treasuryPda()} />
        </DataRow>
      </CardContent>
    </Card>
  );
}

function InitializeForm({
  admin,
  canSign,
  initialize,
  onDone,
}: {
  admin: PublicKey;
  canSign: boolean;
  initialize: (
    feeBps: number,
    arbiter: PublicKey,
    mint: PublicKey
  ) => Promise<string>;
  onDone: () => void;
}) {
  const [feePct, setFeePct] = useState("0.20");
  // Default the arbiter to the connected wallet.
  const [arbiter, setArbiter] = useState(admin.toBase58());
  const [mint, setMint] = useState(DEFAULT_USDC_MINT.toBase58());
  const [submitting, setSubmitting] = useState(false);

  const feeBps = Math.round(Number(feePct) * 100);
  const arbiterKey = tryPublicKey(arbiter);
  const mintKey = tryPublicKey(mint);

  let error: string | null = null;
  if (isNaN(feeBps) || feeBps < 0) error = "Fee must be a positive number";
  else if (feeBps > MAX_FEE_BPS) error = "Fee cannot exceed 10%";
  else if (!arbiterKey) error = "Arbiter is not a valid address";
  else if (!mintKey) error = "Mint is not a valid address";

  async function submit() {
    if (error || !arbiterKey || !mintKey) return;
    setSubmitting(true);
    const sig = await runTx("Initializing protocol", () =>
      initialize(feeBps, arbiterKey, mintKey)
    );
    setSubmitting(false);
    if (sig) onDone();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Initialize protocol</CardTitle>
        <CardDescription>
          One-time setup. The connected wallet becomes the protocol admin.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Protocol fee (%)</Label>
          <Input
            type="number"
            min="0"
            max="10"
            step="0.01"
            value={feePct}
            onChange={(e) => setFeePct(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {feeBps} basis points. Max 10% (1000 bps).
          </p>
        </div>

        <div className="space-y-2">
          <Label>Arbiter address</Label>
          <Input
            value={arbiter}
            onChange={(e) => setArbiter(e.target.value.trim())}
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            The neutral party that resolves disputes.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Allowed mint (USDC)</Label>
          <Input
            value={mint}
            onChange={(e) => setMint(e.target.value.trim())}
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            The only token accepted for orders.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <Button
          className="w-full"
          disabled={!!error || submitting || !canSign}
          onClick={submit}
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Initialize protocol
        </Button>
      </CardContent>
    </Card>
  );
}
