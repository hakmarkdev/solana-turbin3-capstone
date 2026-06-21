use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked};

use crate::constants::*;
use crate::error::StableCartError;
use crate::events::OrderRefunded;
use crate::state::{Order, OrderStatus};
use crate::util::close_vault;

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(mut)]
    pub merchant: Signer<'info>,

    #[account(
        mut,
        close = buyer,
        seeds = [ORDER_SEED, order.buyer.as_ref(), &order.order_id.to_le_bytes()],
        bump = order.bump,
        has_one = mint,
        has_one = buyer,
        has_one = merchant,
    )]
    pub order: Box<Account<'info, Order>>,

    /// CHECK: rent destination + has_one target on Order
    #[account(mut)]
    pub buyer: UncheckedAccount<'info>,

    pub mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        seeds = [VAULT_SEED, order.key().as_ref()],
        bump = order.vault_bump,
    )]
    pub vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = buyer,
    )]
    pub buyer_ata: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

pub(crate) fn refund(ctx: Context<Refund>) -> Result<()> {
    require!(
        ctx.accounts.order.status == OrderStatus::Funded,
        StableCartError::InvalidStatus
    );

    let amount = ctx.accounts.order.amount;
    let order_key = ctx.accounts.order.key();
    let decimals = ctx.accounts.mint.decimals;

    let buyer = ctx.accounts.order.buyer;
    let order_id_bytes = ctx.accounts.order.order_id.to_le_bytes();
    let bump = [ctx.accounts.order.bump];
    let seeds: &[&[u8]] = &[ORDER_SEED, buyer.as_ref(), order_id_bytes.as_ref(), &bump];
    let signer_seeds: &[&[&[u8]]] = &[seeds];

    let token_program = ctx.accounts.token_program.key();

    // Full refund from vault to buyer without fees
    transfer_checked(
        CpiContext::new_with_signer(
            token_program,
            TransferChecked {
                from: ctx.accounts.vault.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.buyer_ata.to_account_info(),
                authority: ctx.accounts.order.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
        decimals,
    )?;

    close_vault(
        token_program,
        ctx.accounts.vault.to_account_info(),
        ctx.accounts.buyer.to_account_info(),
        ctx.accounts.order.to_account_info(),
        signer_seeds,
    )?;

    // Order closed by close = buyer
    ctx.accounts.order.status = OrderStatus::Refunded;
    emit!(OrderRefunded {
        order: order_key,
        amount,
    });
    Ok(())
}
