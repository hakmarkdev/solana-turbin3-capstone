use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum OrderStatus {
    Funded,
    Released,
    Refunded,
    Disputed,
    Resolved,
}

/// Order escrow state
#[account]
#[derive(InitSpace)]
pub struct Order {
    pub buyer: Pubkey,
    pub merchant: Pubkey,
    /// Snapshotted from Config at creation
    pub arbiter: Pubkey,
    /// Config.allowed_mint
    pub mint: Pubkey,
    /// Locked amount
    pub amount: u64,
    /// Snapshotted from Config - creation
    pub fee_bps: u16,
    /// Unique nonce for PDA per buyer
    pub order_id: u64,
    /// Unix ts after which the merchant may claim it
    pub deadline: i64,
    pub status: OrderStatus,
    pub vault_bump: u8,
    pub bump: u8,
}
