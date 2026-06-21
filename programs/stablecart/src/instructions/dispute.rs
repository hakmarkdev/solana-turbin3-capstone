use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked};

use crate::constants::*;
use crate::error::StableCartError;
use crate::events::{OrderDisputed, OrderResolved};
use crate::state::{Config, Order, OrderStatus};
use crate::util::{bps_of, close_vault};

#[derive(Accounts)]
pub struct OpenDispute<'info> {
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [ORDER_SEED, order.buyer.as_ref(), &order.order_id.to_le_bytes()],
        bump = order.bump,
    )]
    pub order: Account<'info, Order>,
}

pub(crate) fn open_dispute(ctx: Context<OpenDispute>) -> Result<()> {
    let order = &mut ctx.accounts.order;
    require!(
        order.status == OrderStatus::Funded,
        StableCartError::InvalidStatus
    );

    let signer = ctx.accounts.signer.key();
    require!(
        signer == order.buyer || signer == order.merchant,
        StableCartError::Unauthorized
    );
    require!(
        Clock::get()?.unix_timestamp <= order.deadline,
        StableCartError::DeadlinePassed
    );

    order.status = OrderStatus::Disputed;

    emit!(OrderDisputed {
        order: order.key(),
        opened_by: signer,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    // Protocol arbiter must match the snapshotted order.arbiter value
    #[account(mut)]
    pub arbiter: Signer<'info>,

    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,

    #[account(
        mut,
        close = buyer,
        seeds = [ORDER_SEED, order.buyer.as_ref(), &order.order_id.to_le_bytes()],
        bump = order.bump,
        has_one = mint,
        has_one = buyer,
        has_one = merchant,
        has_one = arbiter,
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

    #[account(mut, token::mint = mint, token::authority = buyer)]
    pub buyer_ata: Box<Account<'info, TokenAccount>>,

    #[account(mut, token::mint = mint, token::authority = merchant)]
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

pub(crate) fn resolve_dispute(ctx: Context<ResolveDispute>, buyer_bps: u16) -> Result<()> {
    require!(
        ctx.accounts.order.status == OrderStatus::Disputed,
        StableCartError::InvalidStatus
    );
    require!(
        buyer_bps as u64 <= BPS_DENOMINATOR,
        StableCartError::InvalidSplit
    );

    let amount = ctx.accounts.order.amount;
    let fee_bps = ctx.accounts.order.fee_bps;
    let order_key = ctx.accounts.order.key();
    let decimals = ctx.accounts.mint.decimals;

    // Remainder split so rounding never use dust
    let buyer_share = bps_of(amount, buyer_bps)?;
    let remaining = amount
        .checked_sub(buyer_share)
        .ok_or(StableCartError::Overflow)?;
    let fee = bps_of(remaining, fee_bps)?;
    let merchant_share = remaining
        .checked_sub(fee)
        .ok_or(StableCartError::Overflow)?;

    let buyer = ctx.accounts.order.buyer;
    let order_id_bytes = ctx.accounts.order.order_id.to_le_bytes();
    let bump = [ctx.accounts.order.bump];
    let seeds: &[&[u8]] = &[ORDER_SEED, buyer.as_ref(), order_id_bytes.as_ref(), &bump];
    let signer_seeds: &[&[&[u8]]] = &[seeds];
    let token_program = ctx.accounts.token_program.key();

    if buyer_share > 0 {
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
            buyer_share,
            decimals,
        )?;
    }

    if merchant_share > 0 {
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
            merchant_share,
            decimals,
        )?;
    }

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

    close_vault(
        token_program,
        ctx.accounts.vault.to_account_info(),
        ctx.accounts.buyer.to_account_info(),
        ctx.accounts.order.to_account_info(),
        signer_seeds,
    )?;

    // Order auto closed by close = buyer at exit
    ctx.accounts.order.status = OrderStatus::Resolved;
    emit!(OrderResolved {
        order: order_key,
        buyer_share,
        merchant_share,
        fee,
    });
    Ok(())
}
