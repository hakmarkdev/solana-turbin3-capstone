use anchor_lang::prelude::*;

#[error_code]
pub enum StableCartError {
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Fee basis points out of range (max 1000 = 10%)")]
    InvalidFeeBps,
    #[msg("Deadline must be in the future and within the allowed horizon")]
    InvalidDeadline,
    #[msg("Order is not in the required state for this action")]
    InvalidStatus,
    #[msg("Deadline has not yet passed")]
    DeadlineNotReached,
    #[msg("Deadline has already passed; disputes are closed")]
    DeadlinePassed,
    #[msg("Signer is not authorized for this action")]
    Unauthorized,
    #[msg("Mint is not the protocol-approved mint")]
    InvalidMint,
    #[msg("buyer_bps out of range (max 100%)")]
    InvalidSplit,
    #[msg("Buyer and merchant must be different accounts")]
    SelfDealing,
    #[msg("Arithmetic overflow")]
    Overflow,
}
