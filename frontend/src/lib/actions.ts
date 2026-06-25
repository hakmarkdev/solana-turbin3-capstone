import { BN, type Program } from "@coral-xyz/anchor";
import {
  PublicKey,
  SystemProgram,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import { configPda, orderPda, treasuryPda, vaultPda } from "./pdas";
import type { OrderAccount } from "./program";

export function ata(mint: PublicKey, owner: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, owner, false, TOKEN_PROGRAM_ID);
}

// Prepend an idempotent create-ATA instruction
function ensureAta(
  payer: PublicKey,
  mint: PublicKey,
  owner: PublicKey
): TransactionInstruction {
  return createAssociatedTokenAccountIdempotentInstruction(
    payer,
    ata(mint, owner),
    owner,
    mint,
    TOKEN_PROGRAM_ID
  );
}

// Admin
export async function initialize(
  program: Program,
  admin: PublicKey,
  params: { feeBps: number; arbiter: PublicKey; mint: PublicKey }
): Promise<string> {
  const config = configPda();
  return program.methods
    .initialize(params.feeBps, params.arbiter)
    .accountsPartial({
      admin,
      config,
      mint: params.mint,
      treasury: treasuryPda(),
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

// Buyer
export async function createOrder(
  program: Program,
  buyer: PublicKey,
  params: {
    merchant: PublicKey;
    mint: PublicKey;
    amount: BN;
    deadline: BN;
    orderId: BN;
  }
): Promise<string> {
  const order = orderPda(buyer, params.orderId);
  return program.methods
    .createOrder(params.orderId, params.amount, params.deadline)
    .accountsPartial({
      buyer,
      merchant: params.merchant,
      config: configPda(),
      mint: params.mint,
      order,
      vault: vaultPda(order),
      buyerAta: ata(params.mint, buyer),
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

// Release / claim / refund
function releaseAccounts(signer: PublicKey, order: PublicKey, o: OrderAccount) {
  const config = configPda();
  return {
    signer,
    config,
    order,
    buyer: o.buyer,
    merchant: o.merchant,
    mint: o.mint,
    vault: vaultPda(order),
    merchantAta: ata(o.mint, o.merchant),
    treasury: treasuryPda(),
    tokenProgram: TOKEN_PROGRAM_ID,
  };
}

// Buyer releases escrowed funds to the merchant
export async function confirmRelease(
  program: Program,
  signer: PublicKey,
  order: PublicKey,
  o: OrderAccount
): Promise<string> {
  return program.methods
    .confirmRelease()
    .accountsPartial(releaseAccounts(signer, order, o))
    .preInstructions([ensureAta(signer, o.mint, o.merchant)])
    .rpc();
}

// Merchant claims funds after the deadline has elapsed
export async function claimAfterDeadline(
  program: Program,
  signer: PublicKey,
  order: PublicKey,
  o: OrderAccount
): Promise<string> {
  return program.methods
    .claimAfterDeadline()
    .accountsPartial(releaseAccounts(signer, order, o))
    .preInstructions([ensureAta(signer, o.mint, o.merchant)])
    .rpc();
}

// Merchant refunds the full amount to the buyer
export async function refund(
  program: Program,
  signer: PublicKey,
  order: PublicKey,
  o: OrderAccount
): Promise<string> {
  return program.methods
    .refund()
    .accountsPartial({
      merchant: signer,
      order,
      buyer: o.buyer,
      mint: o.mint,
      vault: vaultPda(order),
      buyerAta: ata(o.mint, o.buyer),
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .preInstructions([ensureAta(signer, o.mint, o.buyer)])
    .rpc();
}

// Dispute
export async function openDispute(
  program: Program,
  signer: PublicKey,
  order: PublicKey
): Promise<string> {
  return program.methods.openDispute().accountsPartial({ signer, order }).rpc();
}

// Arbiter resolves a dispute, splitting funds by buyerBps
export async function resolveDispute(
  program: Program,
  signer: PublicKey,
  order: PublicKey,
  o: OrderAccount,
  buyerBps: number
): Promise<string> {
  const config = configPda();
  return program.methods
    .resolveDispute(buyerBps)
    .accountsPartial({
      arbiter: signer,
      config,
      order,
      buyer: o.buyer,
      merchant: o.merchant,
      mint: o.mint,
      vault: vaultPda(order),
      buyerAta: ata(o.mint, o.buyer),
      merchantAta: ata(o.mint, o.merchant),
      treasury: treasuryPda(),
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .preInstructions([
      ensureAta(signer, o.mint, o.buyer),
      ensureAta(signer, o.mint, o.merchant),
    ])
    .rpc();
}
