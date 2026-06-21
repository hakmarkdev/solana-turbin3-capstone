pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;
pub mod util;

use anchor_lang::prelude::*;

pub use constants::*;
pub use error::*;
pub use events::*;
pub use instructions::*;
pub use state::*;

declare_id!("AjvoeycnpCrp2EqDPJ3GMaiAWoeHqKSHpRLEAwoMeJH1");

#[program]
pub mod stablecart {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, fee_bps: u16, arbiter: Pubkey) -> Result<()> {
        instructions::initialize::initialize(ctx, fee_bps, arbiter)
    }

    pub fn create_order(
        ctx: Context<CreateOrder>,
        order_id: u64,
        amount: u64,
        deadline: i64,
    ) -> Result<()> {
        instructions::create_order::create_order(ctx, order_id, amount, deadline)
    }

    pub fn confirm_release(ctx: Context<Release>) -> Result<()> {
        instructions::release::confirm_release(ctx)
    }

    pub fn claim_after_deadline(ctx: Context<Release>) -> Result<()> {
        instructions::release::claim_after_deadline(ctx)
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        instructions::refund::refund(ctx)
    }

    pub fn open_dispute(ctx: Context<OpenDispute>) -> Result<()> {
        instructions::dispute::open_dispute(ctx)
    }

    pub fn resolve_dispute(ctx: Context<ResolveDispute>, buyer_bps: u16) -> Result<()> {
        instructions::dispute::resolve_dispute(ctx, buyer_bps)
    }
}
