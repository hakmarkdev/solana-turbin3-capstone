use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked};

use crate::constants::*;
use crate::error::StableCartError;
use crate::events::OrderCreated;
use crate::state::{Config, Order, OrderStatus};

#[derive(Accounts)]
#[instruction(order_id: u64)]
pub struct CreateOrder<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// CHECK: Merchant is only stored as a pubkey
    pub merchant: UncheckedAccount<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,

    #[account(
        constraint = mint.key() == config.allowed_mint @ StableCartError::InvalidMint,
    )]
    pub mint: Box<Account<'info, Mint>>,

    #[account(
        init,
        payer = buyer,
        space = 8 + Order::INIT_SPACE,
        seeds = [ORDER_SEED, buyer.key().as_ref(), &order_id.to_le_bytes()],
        bump,
    )]
    pub order: Box<Account<'info, Order>>,

    #[account(
        init,
        payer = buyer,
        seeds = [VAULT_SEED, order.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = order,
    )]
    pub vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = buyer,
    )]
    pub buyer_ata: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub(crate) fn create_order(
    ctx: Context<CreateOrder>,
    order_id: u64,
    amount: u64,
    deadline: i64,
) -> Result<()> {
    require!(amount > 0, StableCartError::InvalidAmount);
    require!(
        ctx.accounts.merchant.key() != ctx.accounts.buyer.key(),
        StableCartError::SelfDealing
    );

    let now = Clock::get()?.unix_timestamp;
    require!(
        deadline > now && deadline <= now + MAX_ESCROW_SECONDS,
        StableCartError::InvalidDeadline
    );

    // Transfer USDC token between buyer and vault
    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.buyer_ata.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.mint.decimals,
    )?;

    let order = &mut ctx.accounts.order;
    order.buyer = ctx.accounts.buyer.key();
    order.merchant = ctx.accounts.merchant.key();
    order.arbiter = ctx.accounts.config.arbiter;
    order.mint = ctx.accounts.mint.key();
    order.amount = amount;
    order.fee_bps = ctx.accounts.config.fee_bps;
    order.order_id = order_id;
    order.deadline = deadline;
    order.status = OrderStatus::Funded;
    order.vault_bump = ctx.bumps.vault;
    order.bump = ctx.bumps.order;

    emit!(OrderCreated {
        order: order.key(),
        buyer: order.buyer,
        merchant: order.merchant,
        amount,
        deadline,
    });

    Ok(())
}
