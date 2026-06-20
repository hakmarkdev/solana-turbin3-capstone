pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

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
}
