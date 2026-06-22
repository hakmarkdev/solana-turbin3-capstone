mod common;
use common::*;

fn create_order_ix(
    p: &Protocol,
    merchant: &Pubkey,
    mint: &Pubkey,
    buyer_ata: &Pubkey,
    amount: u64,
    deadline: i64,
) -> solana_sdk::instruction::Instruction {
    ix_create_order(
        &p.buyer.pubkey(),
        merchant,
        mint,
        buyer_ata,
        1,
        amount,
        deadline,
    )
}

#[test]
fn rejects_zero_amount() {
    let mut p = Protocol::new();
    let buyer = p.buyer.insecure_clone();
    let ix = create_order_ix(
        &p,
        &p.merchant.pubkey(),
        &p.mint,
        &p.buyer_ata,
        0,
        p.far_deadline(),
    );
    let logs = send_expect_err(&mut p.svm, &[ix], &buyer, &[&buyer]);
    assert!(logs.contains("InvalidAmount"), "logs: {logs}");
}

#[test]
fn rejects_self_dealing() {
    let mut p = Protocol::new();
    let buyer = p.buyer.insecure_clone();
    let ix = create_order_ix(
        &p,
        &buyer.pubkey(),
        &p.mint,
        &p.buyer_ata,
        AMOUNT,
        p.far_deadline(),
    );
    let logs = send_expect_err(&mut p.svm, &[ix], &buyer, &[&buyer]);
    assert!(logs.contains("SelfDealing"), "logs: {logs}");
}

#[test]
fn rejects_wrong_mint() {
    let mut p = Protocol::new();
    let other = create_mint(&mut p.svm, &p.admin.pubkey());
    let buyer_other = create_token_account(&mut p.svm, &other, &p.buyer.pubkey(), 10 * AMOUNT);
    let buyer = p.buyer.insecure_clone();
    let ix = create_order_ix(
        &p,
        &p.merchant.pubkey(),
        &other,
        &buyer_other,
        AMOUNT,
        p.far_deadline(),
    );
    let logs = send_expect_err(&mut p.svm, &[ix], &buyer, &[&buyer]);
    assert!(logs.contains("InvalidMint"), "logs: {logs}");
}

#[test]
fn rejects_deadline_beyond_horizon() {
    let mut p = Protocol::new();
    let buyer = p.buyer.insecure_clone();
    let deadline = now(&p.svm) + MAX_ESCROW_SECONDS + 60;
    let ix = create_order_ix(
        &p,
        &p.merchant.pubkey(),
        &p.mint,
        &p.buyer_ata,
        AMOUNT,
        deadline,
    );
    let logs = send_expect_err(&mut p.svm, &[ix], &buyer, &[&buyer]);
    assert!(logs.contains("InvalidDeadline"), "logs: {logs}");
}

#[test]
fn rejects_past_deadline() {
    let mut p = Protocol::new();
    let buyer = p.buyer.insecure_clone();
    let deadline = now(&p.svm) - 10;
    let ix = create_order_ix(
        &p,
        &p.merchant.pubkey(),
        &p.mint,
        &p.buyer_ata,
        AMOUNT,
        deadline,
    );
    let logs = send_expect_err(&mut p.svm, &[ix], &buyer, &[&buyer]);
    assert!(logs.contains("InvalidDeadline"), "logs: {logs}");
}

#[test]
fn double_release_fails_after_close() {
    let mut p = Protocol::new();
    let deadline = p.far_deadline();
    let order = p.create_order(1, AMOUNT, deadline);
    let buyer = p.buyer.insecure_clone();

    let release = |p: &mut Protocol| {
        send(
            &mut p.svm,
            &[ix_confirm_release(
                &buyer.pubkey(),
                &buyer.pubkey(),
                &p.merchant.pubkey(),
                &p.mint,
                &order,
                &p.merchant_ata,
            )],
            &buyer,
            &[&buyer],
        )
    };

    release(&mut p).unwrap();
    let logs = release(&mut p).unwrap_err();
    assert!(logs.contains("AccountNotInitialized"), "logs: {logs}");
}

#[test]
fn rejects_foreign_payout_ata() {
    let mut p = Protocol::new();
    let deadline = p.far_deadline();
    let order = p.create_order(1, AMOUNT, deadline);
    let buyer = p.buyer.insecure_clone();

    // ATA is owned by the buyer
    let logs = send_expect_err(
        &mut p.svm,
        &[ix_confirm_release(
            &buyer.pubkey(),
            &buyer.pubkey(),
            &p.merchant.pubkey(),
            &p.mint,
            &order,
            &p.buyer_ata,
        )],
        &buyer,
        &[&buyer],
    );
    assert!(logs.contains("ConstraintTokenOwner"), "logs: {logs}");
}
