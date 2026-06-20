use anchor_lang::prelude::*;

/// PDA seeds
#[constant]
pub const CONFIG_SEED: &[u8] = b"config";
#[constant]
pub const TREASURY_SEED: &[u8] = b"treasury";
#[constant]
pub const ORDER_SEED: &[u8] = b"order";
#[constant]
pub const VAULT_SEED: &[u8] = b"vault";

/// Max protocol fee (i.e., 1000 bps = 10%)
pub const MAX_FEE_BPS: u16 = 1_000;

/// Full basis points denom
pub const BPS_DENOMINATOR: u64 = 10_000;

pub const MAX_ESCROW_SECONDS: i64 = 60 * 60 * 24 * 90;
