import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { BPS_DENOMINATOR } from "./constants";

const BPS_DENOMINATOR_BN = new BN(BPS_DENOMINATOR);

const divisorCache = new Map<number, BN>();
function pow10(decimals: number): BN {
  let d = divisorCache.get(decimals);
  if (!d) {
    d = new BN(10).pow(new BN(decimals));
    divisorCache.set(decimals, d);
  }
  return d;
}

// Parse a base58 string into a PublicKey, or null if invalid
export function tryPublicKey(value: string): PublicKey | null {
  try {
    return new PublicKey(value);
  } catch {
    return null;
  }
}

// `amount * bps / 10_000`, matching the on-chain `bps_of` helper
export function applyBps(amount: BN, bps: number): BN {
  return amount.mul(new BN(bps)).div(BPS_DENOMINATOR_BN);
}

// Dispute settlement split
export function computeSplit(amount: BN, feeBps: number, buyerBps: number) {
  const buyerShare = applyBps(amount, buyerBps);
  const remaining = amount.sub(buyerShare);
  const fee = applyBps(remaining, feeBps);
  const merchantShare = remaining.sub(fee);
  return { buyerShare, merchantShare, fee };
}

// Format basis points as a percentage string, e.g. 20 -> "0.20%"
export function formatFeePct(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

// Shorten a base58 address for display
export function shortAddress(key: PublicKey | string, chars = 4): string {
  const s = typeof key === "string" ? key : key.toBase58();
  return `${s.slice(0, chars)}…${s.slice(-chars)}`;
}

// Convert a raw token amount (BN, base units) to a human string
export function formatTokenAmount(raw: BN, decimals = 6): string {
  const negative = raw.isNeg();
  const abs = raw.abs();
  const divisor = pow10(decimals);
  const whole = abs.div(divisor).toString();
  const frac = abs.mod(divisor).toString().padStart(decimals, "0");
  const trimmedFrac = frac.replace(/0+$/, "");
  const body = trimmedFrac ? `${whole}.${trimmedFrac}` : whole;
  return negative ? `-${body}` : body;
}

// Parse a non-negative decimal string into a raw BN amount
export function parseTokenAmount(value: string, decimals = 6): BN {
  const trimmed = value.trim();
  if (!/^(\d+(\.\d+)?|\.\d+)$/.test(trimmed)) {
    throw new Error("Invalid amount");
  }
  const [whole = "", frac = ""] = trimmed.split(".");
  if (frac.length > decimals) {
    throw new Error(`Too many decimal places (max ${decimals})`);
  }
  const paddedFrac = frac.padEnd(decimals, "0");
  const combined = `${whole}${paddedFrac}`.replace(/^0+(?=\d)/, "");
  return new BN(combined || "0");
}

export function formatDeadline(deadline: BN): string {
  const ms = deadline.toNumber() * 1000;
  return new Date(ms).toLocaleString();
}

export function deadlinePassed(deadline: BN): boolean {
  return Date.now() / 1000 > deadline.toNumber();
}

// Human time format ("in 3 days" / "2 hours ago")
export function relativeTime(deadline: BN): string {
  const diffSec = deadline.toNumber() - Date.now() / 1000;
  const abs = Math.abs(diffSec);
  const steps: [number, string][] = [
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
    [1, "second"],
  ];
  const [secondsPer, unit] = steps.find(([s]) => abs >= s) ?? [1, "second"];
  const value = Math.round(abs / secondsPer);
  const plural = value === 1 ? "" : "s";
  return diffSec >= 0
    ? `in ${value} ${unit}${plural}`
    : `${value} ${unit}${plural} ago`;
}
