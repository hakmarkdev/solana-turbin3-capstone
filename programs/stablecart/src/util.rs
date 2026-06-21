use anchor_lang::prelude::*;
use anchor_spl::token::{close_account, CloseAccount};

use crate::constants::BPS_DENOMINATOR;
use crate::error::StableCartError;

pub fn bps_of(amount: u64, bps: u16) -> Result<u64> {
    let value = (amount as u128)
        .checked_mul(bps as u128)
        .ok_or(StableCartError::Overflow)?
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or(StableCartError::Overflow)?;
    Ok(value as u64)
}

pub fn close_vault<'info>(
    token_program: Pubkey,
    vault: AccountInfo<'info>,
    buyer: AccountInfo<'info>,
    order: AccountInfo<'info>,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    close_account(CpiContext::new_with_signer(
        token_program,
        CloseAccount {
            account: vault,
            destination: buyer,
            authority: order,
        },
        signer_seeds,
    ))
}
