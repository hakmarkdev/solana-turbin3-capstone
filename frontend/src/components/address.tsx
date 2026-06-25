import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import type { PublicKey } from "@solana/web3.js";
import { shortAddress } from "@/lib/format";
import { explorerUrl } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Address({
  value,
  className,
  chars = 4,
  link = true,
}: {
  value: PublicKey | string;
  className?: string;
  chars?: number;
  link?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const base58 = typeof value === "string" ? value : value.toBase58();

  const copy = async () => {
    await navigator.clipboard.writeText(base58);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-xs",
        className
      )}
    >
      <span title={base58}>{shortAddress(base58, chars)}</span>
      <button
        type="button"
        onClick={copy}
        className="text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Copy address"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
      {link && (
        <a
          href={explorerUrl("address", base58)}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground transition-colors hover:text-foreground"
          aria-label="View on explorer"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </span>
  );
}
