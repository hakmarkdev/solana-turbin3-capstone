import { toast } from "sonner";
import { explorerUrl } from "./constants";

export function humanizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const anchorMatch = msg.match(/Error Message: ([^.]+)\./);

  if (anchorMatch) return anchorMatch[1];
  if (/User rejected|rejected the request/i.test(msg))
    return "Transaction rejected in wallet";
  if (/insufficient funds|0x1\b/i.test(msg))
    return "Insufficient funds for this transaction";
  if (msg.length > 160) return msg.slice(0, 157) + "…";
  return msg;
}

// Wrap a TX sending promise with consistent loading / success / error toasts
export async function runTx(
  label: string,
  fn: () => Promise<string>
): Promise<string | null> {
  const id = toast.loading(`${label}…`);
  try {
    const sig = await fn();
    toast.success(`${label} confirmed`, {
      id,
      description: "View on Solana Explorer",
      action: {
        label: "Open",
        onClick: () => window.open(explorerUrl("tx", sig), "_blank"),
      },
    });
    return sig;
  } catch (err) {
    toast.error(`${label} failed`, {
      id,
      description: humanizeError(err),
    });
    return null;
  }
}
