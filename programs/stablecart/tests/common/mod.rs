#![allow(dead_code)]
//! Shared LiteSVM test harness for the StableCart program
use litesvm::LiteSVM;
use solana_sdk::{
    account::Account,
    clock::Clock,
    instruction::{AccountMeta, Instruction},
    native_token::LAMPORTS_PER_SOL,
    transaction::Transaction,
};
use std::str::FromStr;

// Re-exported for test files.
pub use solana_sdk::{pubkey::Pubkey, signature::Keypair, signer::Signer};

// SPL Token program (classic) and account layout sizes.
pub const TOKEN_PROGRAM_STR: &str = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const MINT_LEN: usize = 82;
const TOKEN_ACCOUNT_LEN: usize = 165;

pub const DECIMALS: u8 = 6;
pub const FEE_BPS: u16 = 50; // 0.50%
pub const AMOUNT: u64 = 1_000_000; // 1.0 token
pub const BPS_DENOMINATOR: u64 = 10_000;
pub const MAX_ESCROW_SECONDS: i64 = 60 * 60 * 24 * 90;

// Declared program id (matches declare_id! in lib.rs).
pub const PROGRAM_ID_STR: &str = "EvwjtczHNh1mDVRWebxVA2wApWCXQRkHJLZM2nuwFxaN";

// Instruction discriminators (from the generated IDL).
const D_INITIALIZE: [u8; 8] = [175, 175, 109, 31, 13, 152, 155, 237];
const D_CREATE_ORDER: [u8; 8] = [141, 54, 37, 207, 237, 210, 250, 215];
const D_CONFIRM_RELEASE: [u8; 8] = [181, 157, 89, 7, 37, 54, 72, 90];
const D_CLAIM_AFTER_DEADLINE: [u8; 8] = [55, 47, 158, 12, 61, 132, 211, 150];
const D_REFUND: [u8; 8] = [2, 96, 183, 251, 63, 208, 46, 46];
const D_OPEN_DISPUTE: [u8; 8] = [137, 25, 99, 119, 23, 223, 161, 42];
const D_RESOLVE_DISPUTE: [u8; 8] = [231, 6, 202, 6, 96, 103, 12, 230];

pub fn program_id() -> Pubkey {
    Pubkey::from_str(PROGRAM_ID_STR).unwrap()
}

pub fn token_program_id() -> Pubkey {
    Pubkey::from_str(TOKEN_PROGRAM_STR).unwrap()
}

/// System Program id (the canonical all-zeros pubkey "111…1").
pub fn system_program_id() -> Pubkey {
    Pubkey::default()
}

// ---- PDAs ----------------------------------------------------------------

pub fn config_pda() -> Pubkey {
    Pubkey::find_program_address(&[b"config"], &program_id()).0
}

pub fn treasury_pda() -> Pubkey {
    Pubkey::find_program_address(&[b"treasury", config_pda().as_ref()], &program_id()).0
}

pub fn order_pda(buyer: &Pubkey, order_id: u64) -> Pubkey {
    Pubkey::find_program_address(
        &[b"order", buyer.as_ref(), &order_id.to_le_bytes()],
        &program_id(),
    )
    .0
}

pub fn vault_pda(order: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"vault", order.as_ref()], &program_id()).0
}

// ---- SVM / token helpers -------------------------------------------------

pub fn load_svm() -> LiteSVM {
    let mut svm = LiteSVM::new();
    let so = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../target/deploy/stablecart.so"
    );
    svm.add_program_from_file(program_id(), so)
        .expect("load program .so (run `anchor build` first)");
    svm
}

pub fn keypair_funded(svm: &mut LiteSVM, sol: u64) -> Keypair {
    let kp = Keypair::new();
    svm.airdrop(&kp.pubkey(), sol * LAMPORTS_PER_SOL).unwrap();
    kp
}

/// Create an SPL mint by writing its account data directly (layout is stable).
/// Mint(82): mint_authority COption<Pubkey>(36) supply(8) decimals(1)
/// is_initialized(1) freeze_authority COption<Pubkey>(36).
pub fn create_mint(svm: &mut LiteSVM, authority: &Pubkey) -> Pubkey {
    let mint = Keypair::new().pubkey();
    let mut data = vec![0u8; MINT_LEN];
    data[0..4].copy_from_slice(&1u32.to_le_bytes()); // COption::Some
    data[4..36].copy_from_slice(authority.as_ref()); // mint_authority
    data[44] = DECIMALS; // decimals (after 8-byte supply)
    data[45] = 1; // is_initialized
                  // freeze_authority left as COption::None (zeroed tag)
    set_token_program_account(svm, &mint, data);
    mint
}

/// Create an SPL token account holding `amount`, owned by `owner`.
/// Account(165): mint(32) owner(32) amount(8) delegate COption(36) state(1)
/// is_native COption(12) delegated_amount(8) close_authority COption(36).
pub fn create_token_account(
    svm: &mut LiteSVM,
    mint: &Pubkey,
    owner: &Pubkey,
    amount: u64,
) -> Pubkey {
    let acct = Keypair::new().pubkey();
    let mut data = vec![0u8; TOKEN_ACCOUNT_LEN];
    data[0..32].copy_from_slice(mint.as_ref());
    data[32..64].copy_from_slice(owner.as_ref());
    data[64..72].copy_from_slice(&amount.to_le_bytes());
    data[108] = 1; // AccountState::Initialized
    set_token_program_account(svm, &acct, data);
    acct
}

fn set_token_program_account(svm: &mut LiteSVM, address: &Pubkey, data: Vec<u8>) {
    let rent = svm.minimum_balance_for_rent_exemption(data.len());
    svm.set_account(
        *address,
        Account {
            lamports: rent,
            data,
            owner: token_program_id(),
            executable: false,
            rent_epoch: 0,
        },
    )
    .unwrap();
}

pub fn token_balance(svm: &LiteSVM, ata: &Pubkey) -> u64 {
    let acc = svm.get_account(ata).expect("token account exists");
    u64::from_le_bytes(acc.data[64..72].try_into().unwrap())
}

// ---- Order account readers -----------------------------------------------
// Order: disc(8) buyer(32) merchant(32) arbiter(32) mint(32) amount(8)
// fee_bps(2) order_id(8) deadline(8) status(1) vault_bump(1) bump(1).

pub const STATUS_FUNDED: u8 = 0;
pub const STATUS_RELEASED: u8 = 1;
pub const STATUS_REFUNDED: u8 = 2;
pub const STATUS_DISPUTED: u8 = 3;
pub const STATUS_RESOLVED: u8 = 4;

fn order_data(svm: &LiteSVM, order: &Pubkey) -> Vec<u8> {
    svm.get_account(order).expect("order account exists").data
}

pub fn order_arbiter(svm: &LiteSVM, order: &Pubkey) -> Pubkey {
    Pubkey::new_from_array(order_data(svm, order)[72..104].try_into().unwrap())
}

pub fn order_amount(svm: &LiteSVM, order: &Pubkey) -> u64 {
    u64::from_le_bytes(order_data(svm, order)[136..144].try_into().unwrap())
}

pub fn order_fee_bps(svm: &LiteSVM, order: &Pubkey) -> u16 {
    u16::from_le_bytes(order_data(svm, order)[144..146].try_into().unwrap())
}

pub fn order_status(svm: &LiteSVM, order: &Pubkey) -> u8 {
    order_data(svm, order)[162]
}

/// True if the account is live (closed accounts are removed / zero-lamport).
pub fn account_live(svm: &LiteSVM, pk: &Pubkey) -> bool {
    svm.get_account(pk).map(|a| a.lamports > 0).unwrap_or(false)
}

// ---- clock ---------------------------------------------------------------

pub fn now(svm: &LiteSVM) -> i64 {
    svm.get_sysvar::<Clock>().unix_timestamp
}

pub fn set_unix(svm: &mut LiteSVM, ts: i64) {
    let mut clock: Clock = svm.get_sysvar();
    clock.unix_timestamp = ts;
    svm.set_sysvar(&clock);
}

// ---- tx send -------------------------------------------------------------

pub fn send(
    svm: &mut LiteSVM,
    ixs: &[Instruction],
    payer: &Keypair,
    signers: &[&Keypair],
) -> Result<(), String> {
    // Fresh blockhash each send so otherwise-identical txs aren't rejected as
    // duplicates (e.g. a failed attempt followed by a retry after a clock warp).
    svm.expire_blockhash();
    let bh = svm.latest_blockhash();
    let tx = Transaction::new_signed_with_payer(ixs, Some(&payer.pubkey()), signers, bh);
    svm.send_transaction(tx)
        .map(|_| ())
        .map_err(|e| e.meta.logs.join("\n"))
}

/// Send expecting failure; returns the joined program logs for assertion.
pub fn send_expect_err(
    svm: &mut LiteSVM,
    ixs: &[Instruction],
    payer: &Keypair,
    signers: &[&Keypair],
) -> String {
    match send(svm, ixs, payer, signers) {
        Ok(()) => panic!("expected transaction to fail, but it succeeded"),
        Err(logs) => logs,
    }
}

// ---- instruction builders ------------------------------------------------

fn data(disc: [u8; 8], rest: &[u8]) -> Vec<u8> {
    let mut d = disc.to_vec();
    d.extend_from_slice(rest);
    d
}

pub fn ix_initialize(admin: &Pubkey, mint: &Pubkey, fee_bps: u16, arbiter: &Pubkey) -> Instruction {
    let mut args = fee_bps.to_le_bytes().to_vec();
    args.extend_from_slice(arbiter.as_ref());
    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(*admin, true),
            AccountMeta::new(config_pda(), false),
            AccountMeta::new_readonly(*mint, false),
            AccountMeta::new(treasury_pda(), false),
            AccountMeta::new_readonly(token_program_id(), false),
            AccountMeta::new_readonly(system_program_id(), false),
        ],
        data: data(D_INITIALIZE, &args),
    }
}

pub fn ix_create_order(
    buyer: &Pubkey,
    merchant: &Pubkey,
    mint: &Pubkey,
    buyer_ata: &Pubkey,
    order_id: u64,
    amount: u64,
    deadline: i64,
) -> Instruction {
    let order = order_pda(buyer, order_id);
    let mut args = order_id.to_le_bytes().to_vec();
    args.extend_from_slice(&amount.to_le_bytes());
    args.extend_from_slice(&deadline.to_le_bytes());
    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(*buyer, true),
            AccountMeta::new_readonly(*merchant, false),
            AccountMeta::new_readonly(config_pda(), false),
            AccountMeta::new_readonly(*mint, false),
            AccountMeta::new(order, false),
            AccountMeta::new(vault_pda(&order), false),
            AccountMeta::new(*buyer_ata, false),
            AccountMeta::new_readonly(token_program_id(), false),
            AccountMeta::new_readonly(system_program_id(), false),
        ],
        data: data(D_CREATE_ORDER, &args),
    }
}

/// Shared accounts for confirm_release / claim_after_deadline.
fn release_accounts(
    signer: &Pubkey,
    buyer: &Pubkey,
    merchant: &Pubkey,
    mint: &Pubkey,
    order: &Pubkey,
    merchant_ata: &Pubkey,
) -> Vec<AccountMeta> {
    vec![
        AccountMeta::new(*signer, true),
        AccountMeta::new_readonly(config_pda(), false),
        AccountMeta::new(*order, false),
        AccountMeta::new(*buyer, false),
        AccountMeta::new_readonly(*merchant, false),
        AccountMeta::new_readonly(*mint, false),
        AccountMeta::new(vault_pda(order), false),
        AccountMeta::new(*merchant_ata, false),
        AccountMeta::new(treasury_pda(), false),
        AccountMeta::new_readonly(token_program_id(), false),
    ]
}

pub fn ix_confirm_release(
    signer: &Pubkey,
    buyer: &Pubkey,
    merchant: &Pubkey,
    mint: &Pubkey,
    order: &Pubkey,
    merchant_ata: &Pubkey,
) -> Instruction {
    Instruction {
        program_id: program_id(),
        accounts: release_accounts(signer, buyer, merchant, mint, order, merchant_ata),
        data: data(D_CONFIRM_RELEASE, &[]),
    }
}

pub fn ix_claim_after_deadline(
    signer: &Pubkey,
    buyer: &Pubkey,
    merchant: &Pubkey,
    mint: &Pubkey,
    order: &Pubkey,
    merchant_ata: &Pubkey,
) -> Instruction {
    Instruction {
        program_id: program_id(),
        accounts: release_accounts(signer, buyer, merchant, mint, order, merchant_ata),
        data: data(D_CLAIM_AFTER_DEADLINE, &[]),
    }
}

pub fn ix_refund(
    merchant: &Pubkey,
    buyer: &Pubkey,
    mint: &Pubkey,
    order: &Pubkey,
    buyer_ata: &Pubkey,
) -> Instruction {
    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(*merchant, true),
            AccountMeta::new(*order, false),
            AccountMeta::new(*buyer, false),
            AccountMeta::new_readonly(*mint, false),
            AccountMeta::new(vault_pda(order), false),
            AccountMeta::new(*buyer_ata, false),
            AccountMeta::new_readonly(token_program_id(), false),
        ],
        data: data(D_REFUND, &[]),
    }
}

pub fn ix_open_dispute(signer: &Pubkey, order: &Pubkey) -> Instruction {
    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new_readonly(*signer, true),
            AccountMeta::new(*order, false),
        ],
        data: data(D_OPEN_DISPUTE, &[]),
    }
}

pub fn ix_resolve_dispute(
    arbiter: &Pubkey,
    buyer: &Pubkey,
    merchant: &Pubkey,
    mint: &Pubkey,
    order: &Pubkey,
    buyer_ata: &Pubkey,
    merchant_ata: &Pubkey,
    buyer_bps: u16,
) -> Instruction {
    Instruction {
        program_id: program_id(),
        accounts: vec![
            AccountMeta::new(*arbiter, true),
            AccountMeta::new_readonly(config_pda(), false),
            AccountMeta::new(*order, false),
            AccountMeta::new(*buyer, false),
            AccountMeta::new_readonly(*merchant, false),
            AccountMeta::new_readonly(*mint, false),
            AccountMeta::new(vault_pda(order), false),
            AccountMeta::new(*buyer_ata, false),
            AccountMeta::new(*merchant_ata, false),
            AccountMeta::new(treasury_pda(), false),
            AccountMeta::new_readonly(token_program_id(), false),
        ],
        data: data(D_RESOLVE_DISPUTE, &buyer_bps.to_le_bytes()),
    }
}

// ---- high-level fixture --------------------------------------------------

/// A ready-to-use protocol: program loaded, config initialized, actors funded,
/// buyer holding 100 tokens of the allowed mint.
pub struct Protocol {
    pub svm: LiteSVM,
    pub admin: Keypair,
    pub buyer: Keypair,
    pub merchant: Keypair,
    pub arbiter: Keypair,
    pub outsider: Keypair,
    pub mint: Pubkey,
    pub buyer_ata: Pubkey,
    pub merchant_ata: Pubkey,
}

impl Protocol {
    pub fn new() -> Self {
        let mut svm = load_svm();
        let admin = keypair_funded(&mut svm, 100);
        let buyer = keypair_funded(&mut svm, 100);
        let merchant = keypair_funded(&mut svm, 100);
        let arbiter = keypair_funded(&mut svm, 100);
        let outsider = keypair_funded(&mut svm, 100);

        let mint = create_mint(&mut svm, &admin.pubkey());
        let buyer_ata = create_token_account(&mut svm, &mint, &buyer.pubkey(), 100 * AMOUNT);
        let merchant_ata = create_token_account(&mut svm, &mint, &merchant.pubkey(), 0);

        send(
            &mut svm,
            &[ix_initialize(
                &admin.pubkey(),
                &mint,
                FEE_BPS,
                &arbiter.pubkey(),
            )],
            &admin,
            &[&admin],
        )
        .expect("initialize");

        Protocol {
            svm,
            admin,
            buyer,
            merchant,
            arbiter,
            outsider,
            mint,
            buyer_ata,
            merchant_ata,
        }
    }

    /// Create a funded order from `buyer`; returns the order PDA.
    pub fn create_order(&mut self, order_id: u64, amount: u64, deadline: i64) -> Pubkey {
        let order = order_pda(&self.buyer.pubkey(), order_id);
        let buyer = self.buyer.insecure_clone();
        send(
            &mut self.svm,
            &[ix_create_order(
                &buyer.pubkey(),
                &self.merchant.pubkey(),
                &self.mint,
                &self.buyer_ata,
                order_id,
                amount,
                deadline,
            )],
            &buyer,
            &[&buyer],
        )
        .expect("create_order");
        order
    }

    pub fn far_deadline(&self) -> i64 {
        now(&self.svm) + 3600
    }
}
