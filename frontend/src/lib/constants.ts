import { PublicKey } from "@solana/web3.js";

// StableCart program id (devnet or localnet)
export const PROGRAM_ID = new PublicKey(
  "AjvoeycnpCrp2EqDPJ3GMaiAWoeHqKSHpRLEAwoMeJH1"
);

// RPC endpoint
export const RPC_URL =
  import.meta.env.VITE_RPC_URL ?? "https://api.devnet.solana.com";

export const CLUSTER = (import.meta.env.VITE_CLUSTER ?? "devnet") as
  | "devnet"
  | "mainnet-beta"
  | "testnet";

// Circle's USDC mint on devnet — used as the default allowed mint
export const DEFAULT_USDC_MINT = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);

// On-chain protocol limits mirrored from the program constants
export const MAX_FEE_BPS = 1_000; // 10%
export const BPS_DENOMINATOR = 10_000;
export const MAX_ESCROW_SECONDS = 60 * 60 * 24 * 90; // 90 days

// PDA seeds
export const CONFIG_SEED = Buffer.from("config");
export const TREASURY_SEED = Buffer.from("treasury");
export const ORDER_SEED = Buffer.from("order");
export const VAULT_SEED = Buffer.from("vault");

export const EXPLORER_BASE = "https://explorer.solana.com";

export function explorerUrl(
  kind: "address" | "tx",
  value: string,
  cluster: string = CLUSTER
): string {
  const suffix = cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`;
  return `${EXPLORER_BASE}/${kind}/${value}${suffix}`;
}
