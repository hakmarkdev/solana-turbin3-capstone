use anchor_lang::prelude::*;

/// Global protocol singleton
#[account]
#[derive(InitSpace)]
pub struct Config {
    /// Protocol owner
    pub admin: Pubkey,
    /// Protocol dispute resolver
    pub arbiter: Pubkey,
    /// The only mint accepted for orders is USDC token
    pub allowed_mint: Pubkey,
    /// Protocol fee in basis points (e.g. 20 is 0.20%, etc...)
    pub fee_bps: u16,
    /// Bump for the treasury token-account PDA
    pub treasury_bump: u8,
    /// Bump for this Config PDA
    pub bump: u8,
}
