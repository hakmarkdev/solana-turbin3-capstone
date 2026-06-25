import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  CONFIG_SEED,
  ORDER_SEED,
  PROGRAM_ID,
  TREASURY_SEED,
  VAULT_SEED,
} from "./constants";

// Config + treasury are protocol singletons
let _configPda: PublicKey | undefined;
let _treasuryPda: PublicKey | undefined;

export function configPda(): PublicKey {
  return (_configPda ??= PublicKey.findProgramAddressSync(
    [CONFIG_SEED],
    PROGRAM_ID
  )[0]);
}

// Treasury token-account PDA of the protocol's singleton config
export function treasuryPda(): PublicKey {
  return (_treasuryPda ??= PublicKey.findProgramAddressSync(
    [TREASURY_SEED, configPda().toBuffer()],
    PROGRAM_ID
  )[0]);
}

export function orderPda(buyer: PublicKey, orderId: BN): PublicKey {
  return PublicKey.findProgramAddressSync(
    [ORDER_SEED, buyer.toBuffer(), orderId.toArrayLike(Buffer, "le", 8)],
    PROGRAM_ID
  )[0];
}

export function vaultPda(order: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [VAULT_SEED, order.toBuffer()],
    PROGRAM_ID
  )[0];
}
