use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked};

use crate::constants::*;
use crate::error::StableCartError;
use crate::events::OrderReleased;
use crate::state::{Config, Order, OrderStatus};
use crate::util::{bps_of, close_vault};

#[derive(Accounts)]
pub struct Release<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,

    #[account(
        mut,
        close = buyer,
        seeds = [ORDER_SEED, order.buyer.as_ref(), &order.order_id.to_le_bytes()],
        bump = order.bump,
        has_one = mint,
        has_one = merchant,
        has_one = buyer,
    )]
    pub order: Box<Account<'info, Order>>,

    /// CHECK: rent destination + has_one target
    #[account(mut)]
    pub buyer: UncheckedAccount<'info>,

    /// CHECK: has_one target
    pub merchant: UncheckedAccount<'info>,

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
        token::authority = merchant,
    )]
    pub merchant_ata: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [TREASURY_SEED, config.key().as_ref()],
        bump = config.treasury_bump,
        token::mint = mint,
        token::authority = config,
    )]
    pub treasury: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
}

fn settle_to_merchant(ctx: &Context<Release>, via_deadline: bool) -> Result<()> {
    require!(
        ctx.accounts.order.status == OrderStatus::Funded,
        StableCartError::InvalidStatus
    );

    let amount = ctx.accounts.order.amount;
    let fee_bps = ctx.accounts.order.fee_bps;
    let order_key = ctx.accounts.order.key();
    let decimals = ctx.accounts.mint.decimals;

    let fee = bps_of(amount, fee_bps)?;
    let merchant_amount = amount.checked_sub(fee).ok_or(StableCartError::Overflow)?;

    // Order PDA signer seeds
    let buyer = ctx.accounts.order.buyer;
    let order_id_bytes = ctx.accounts.order.order_id.to_le_bytes();
    let bump = [ctx.accounts.order.bump];
    let seeds: &[&[u8]] = &[ORDER_SEED, buyer.as_ref(), order_id_bytes.as_ref(), &bump];
    let signer_seeds: &[&[&[u8]]] = &[seeds];
    let token_program = ctx.accounts.token_program.key();

    // Vault to merchant
    transfer_checked(
        CpiContext::new_with_signer(
            token_program,
            TransferChecked {
                from: ctx.accounts.vault.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.merchant_ata.to_account_info(),
                authority: ctx.accounts.order.to_account_info(),
            },
            signer_seeds,
        ),
        merchant_amount,
        decimals,
    )?;

    // Vault to treasury (Cut / fee)
    if fee > 0 {
        transfer_checked(
            CpiContext::new_with_signer(
                token_program,
                TransferChecked {
                    from: ctx.accounts.vault.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                    authority: ctx.accounts.order.to_account_info(),
                },
                signer_seeds,
            ),
            fee,
            decimals,
        )?;
    }

    // Close empty vault and do tx between rent and buyer
    close_vault(
        token_program,
        ctx.accounts.vault.to_account_info(),
        ctx.accounts.buyer.to_account_info(),
        ctx.accounts.order.to_account_info(),
        signer_seeds,
    )?;

    // The order account is auto closed by close = buyer
    emit!(OrderReleased {
        order: order_key,
        merchant_amount,
        fee,
        via_deadline,
    });
    Ok(())
}

pub(crate) fn confirm_release(ctx: Context<Release>) -> Result<()> {
    require!(
        ctx.accounts.signer.key() == ctx.accounts.order.buyer,
        StableCartError::Unauthorized
    );
    settle_to_merchant(&ctx, false)?;
    ctx.accounts.order.status = OrderStatus::Released;
    Ok(())
}

pub(crate) fn claim_after_deadline(ctx: Context<Release>) -> Result<()> {
    require!(
        ctx.accounts.signer.key() == ctx.accounts.order.merchant,
        StableCartError::Unauthorized
    );
    require!(
        Clock::get()?.unix_timestamp > ctx.accounts.order.deadline,
        StableCartError::DeadlineNotReached
    );
    settle_to_merchant(&ctx, true)?;
    ctx.accounts.order.status = OrderStatus::Released;
    Ok(())
}
