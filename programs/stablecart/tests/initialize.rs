mod common;
use common::*;

#[test]
fn initialize_sets_config_and_creates_treasury() {
    let p = Protocol::new();
    let cfg = p.svm.get_account(&config_pda()).expect("config exists");
    let d = &cfg.data;
    let admin = Pubkey::new_from_array(d[8..40].try_into().unwrap());
    let arbiter = Pubkey::new_from_array(d[40..72].try_into().unwrap());
    let allowed_mint = Pubkey::new_from_array(d[72..104].try_into().unwrap());
    let fee_bps = u16::from_le_bytes(d[104..106].try_into().unwrap());

    assert_eq!(admin, p.admin.pubkey());
    assert_eq!(arbiter, p.arbiter.pubkey());
    assert_eq!(allowed_mint, p.mint);
    assert_eq!(fee_bps, FEE_BPS);

    // Treasury is a token account for the mint
    assert_eq!(token_balance(&p.svm, &treasury_pda()), 0);
}

#[test]
fn initialize_rejects_excessive_fee() {
    let mut svm = load_svm();
    let admin = keypair_funded(&mut svm, 100);
    let arbiter = Keypair::new();
    let mint = create_mint(&mut svm, &admin.pubkey());

    let logs = send_expect_err(
        &mut svm,
        &[ix_initialize(
            &admin.pubkey(),
            &mint,
            1001,
            &arbiter.pubkey(),
        )],
        &admin,
        &[&admin],
    );
    assert!(logs.contains("InvalidFeeBps"), "logs: {logs}");
}

#[test]
fn initialize_is_not_reinitializable() {
    let mut p = Protocol::new();
    let admin = p.admin.insecure_clone();

    let logs = send_expect_err(
        &mut p.svm,
        &[ix_initialize(
            &admin.pubkey(),
            &p.mint,
            FEE_BPS,
            &p.arbiter.pubkey(),
        )],
        &admin,
        &[&admin],
    );
    assert!(logs.contains("already in use"), "logs: {logs}");
}
