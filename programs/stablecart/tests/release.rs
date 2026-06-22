mod common;
use common::*;

#[test]
fn confirm_release_pays_merchant_and_fee_then_closes() {
    let mut p = Protocol::new();
    let deadline = p.far_deadline();
    let order = p.create_order(1, AMOUNT, deadline);
    let vault = vault_pda(&order);

    let fee = AMOUNT * FEE_BPS as u64 / BPS_DENOMINATOR;
    let merchant_amount = AMOUNT - fee;
    let m_before = token_balance(&p.svm, &p.merchant_ata);
    let t_before = token_balance(&p.svm, &treasury_pda());

    let buyer = p.buyer.insecure_clone();
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
    .unwrap();

    assert_eq!(
        token_balance(&p.svm, &p.merchant_ata),
        m_before + merchant_amount
    );
    assert_eq!(token_balance(&p.svm, &treasury_pda()), t_before + fee);
    assert!(!account_live(&p.svm, &vault), "vault should be closed");
    assert!(!account_live(&p.svm, &order), "order should be closed");
}

#[test]
fn confirm_release_only_by_buyer() {
    let mut p = Protocol::new();
    let deadline = p.far_deadline();
    let order = p.create_order(1, AMOUNT, deadline);

    // Merchant cannot confirm it
    let merchant = p.merchant.insecure_clone();
    let logs = send_expect_err(
        &mut p.svm,
        &[ix_confirm_release(
            &merchant.pubkey(),
            &p.buyer.pubkey(),
            &merchant.pubkey(),
            &p.mint,
            &order,
            &p.merchant_ata,
        )],
        &merchant,
        &[&merchant],
    );
    assert!(logs.contains("Unauthorized"), "logs: {logs}");
}

#[test]
fn claim_after_deadline_blocked_before_then_allowed_after() {
    let mut p = Protocol::new();
    let deadline = now(&p.svm) + 1000;
    let order = p.create_order(1, AMOUNT, deadline);
    let vault = vault_pda(&order);
    let merchant = p.merchant.insecure_clone();

    let claim = |p: &mut Protocol| {
        send(
            &mut p.svm,
            &[ix_claim_after_deadline(
                &merchant.pubkey(),
                &p.buyer.pubkey(),
                &merchant.pubkey(),
                &p.mint,
                &order,
                &p.merchant_ata,
            )],
            &merchant,
            &[&merchant],
        )
    };

    let logs = claim(&mut p).unwrap_err();
    assert!(logs.contains("DeadlineNotReached"), "logs: {logs}");

    set_unix(&mut p.svm, deadline + 1);
    let fee = AMOUNT * FEE_BPS as u64 / BPS_DENOMINATOR;
    let m_before = token_balance(&p.svm, &p.merchant_ata);
    claim(&mut p).unwrap();
    assert_eq!(
        token_balance(&p.svm, &p.merchant_ata),
        m_before + (AMOUNT - fee)
    );
    assert!(!account_live(&p.svm, &vault), "vault should be closed");
    assert!(!account_live(&p.svm, &order), "order should be closed");
}

#[test]
fn claim_after_deadline_only_by_merchant() {
    let mut p = Protocol::new();
    let deadline = now(&p.svm) + 1000;
    let order = p.create_order(1, AMOUNT, deadline);
    set_unix(&mut p.svm, deadline + 1);

    let buyer = p.buyer.insecure_clone();
    let logs = send_expect_err(
        &mut p.svm,
        &[ix_claim_after_deadline(
            &buyer.pubkey(),
            &buyer.pubkey(),
            &p.merchant.pubkey(),
            &p.mint,
            &order,
            &p.merchant_ata,
        )],
        &buyer,
        &[&buyer],
    );
    assert!(logs.contains("Unauthorized"), "logs: {logs}");
}
