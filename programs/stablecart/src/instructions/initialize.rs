use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::constants::*;
use crate::error::StableCartError;
use crate::state::Config;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + Config::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump,
    )]
    pub config: Box<Account<'info, Config>>,

    // The protocol allowed mint USDC token via Classic SPL Token only
    pub mint: Box<Account<'info, Mint>>,

    // Treasury token account - protocol fees
    #[account(
        init,
        payer = admin,
        seeds = [TREASURY_SEED, config.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = config,
    )]
    pub treasury: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn initialize(ctx: Context<Initialize>, fee_bps: u16, arbiter: Pubkey) -> Result<()> {
    require!(fee_bps <= MAX_FEE_BPS, StableCartError::InvalidFeeBps);

    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.arbiter = arbiter;
    config.allowed_mint = ctx.accounts.mint.key();
    config.fee_bps = fee_bps;
    config.treasury_bump = ctx.bumps.treasury;
    config.bump = ctx.bumps.config;

    Ok(())
}
