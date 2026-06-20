use anchor_lang::prelude::*;

#[event]
pub struct OrderCreated {
    pub order: Pubkey,
    pub buyer: Pubkey,
    pub merchant: Pubkey,
    pub amount: u64,
    pub deadline: i64,
}

#[event]
pub struct OrderReleased {
    pub order: Pubkey,
    pub merchant_amount: u64,
    pub fee: u64,
    pub via_deadline: bool,
}

#[event]
pub struct OrderRefunded {
    pub order: Pubkey,
    pub amount: u64,
}

#[event]
pub struct OrderDisputed {
    pub order: Pubkey,
    pub opened_by: Pubkey,
}

#[event]
pub struct OrderResolved {
    pub order: Pubkey,
    pub buyer_share: u64,
    pub merchant_share: u64,
    pub fee: u64,
}
