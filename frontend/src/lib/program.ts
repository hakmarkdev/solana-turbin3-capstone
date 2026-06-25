import {
  AnchorProvider,
  BN,
  Program,
  type Idl,
  type Wallet,
} from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import idlJson from "./idl/stablecart.json";

export const idl = idlJson as Idl;

// A minimal signer shape compatible with AnchorProvider
export interface AnchorCompatibleWallet {
  publicKey: PublicKey;
  signTransaction: Wallet["signTransaction"];
  signAllTransactions: Wallet["signAllTransactions"];
}

export function getProvider(
  connection: Connection,
  wallet: AnchorCompatibleWallet
): AnchorProvider {
  return new AnchorProvider(connection, wallet as Wallet, {
    commitment: "confirmed",
  });
}

// Program bound to a wallet that can send transactions
export function getProgram(provider: AnchorProvider): Program {
  return new Program(idl, provider);
}

// Read-only program for fetching accounts without a connected wallet
export function getReadonlyProgram(connection: Connection): Program {
  const provider = new AnchorProvider(
    connection,
    {
      publicKey: PublicKey.default,
      signTransaction: async (tx) => tx,
      signAllTransactions: async (txs) => txs,
    } as Wallet,
    { commitment: "confirmed" }
  );
  return new Program(idl, provider);
}

export type OrderStatus =
  | "funded"
  | "released"
  | "refunded"
  | "disputed"
  | "resolved";

export interface ConfigAccount {
  admin: PublicKey;
  arbiter: PublicKey;
  allowedMint: PublicKey;
  feeBps: number;
  treasuryBump: number;
  bump: number;
}

export interface OrderAccount {
  buyer: PublicKey;
  merchant: PublicKey;
  arbiter: PublicKey;
  mint: PublicKey;
  amount: BN;
  feeBps: number;
  orderId: BN;
  deadline: BN;
  status: Record<OrderStatus, Record<string, never>>;
  vaultBump: number;
  bump: number;
}

// Decodes the anchor enum object into a flat status string
export function statusOf(order: OrderAccount): OrderStatus {
  return Object.keys(order.status)[0] as OrderStatus;
}

export type Role = "buyer" | "merchant" | "arbiter";

// Which roles the given wallet holds on an order buyer,merchant, or arbiter
export function rolesFor(
  order: OrderAccount,
  wallet: PublicKey | null | undefined
): Role[] {
  if (!wallet) return [];
  const roles: Role[] = [];
  if (order.buyer.equals(wallet)) roles.push("buyer");
  if (order.merchant.equals(wallet)) roles.push("merchant");
  if (order.arbiter.equals(wallet)) roles.push("arbiter");
  return roles;
}
