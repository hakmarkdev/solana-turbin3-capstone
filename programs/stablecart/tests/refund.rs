mod common;
use common::*;

#[test]
fn refund_returns_full_amount_no_fee_and_closes() {
    let mut p = Protocol::new();
    let deadline = p.far_deadline();
    let order = p.create_order(1, AMOUNT, deadline);
    let vault = vault_pda(&order);

    let b_before = token_balance(&p.svm, &p.buyer_ata);
    let t_before = token_balance(&p.svm, &treasury_pda());

    let merchant = p.merchant.insecure_clone();
    send(
        &mut p.svm,
        &[ix_refund(
            &merchant.pubkey(),
            &p.buyer.pubkey(),
            &p.mint,
            &order,
            &p.buyer_ata,
        )],
        &merchant,
        &[&merchant],
    )
    .unwrap();

    assert_eq!(token_balance(&p.svm, &p.buyer_ata), b_before + AMOUNT);
    assert_eq!(token_balance(&p.svm, &treasury_pda()), t_before);
    assert!(!account_live(&p.svm, &vault));
    assert!(!account_live(&p.svm, &order));
}

#[test]
fn refund_rejected_for_non_merchant() {
    let mut p = Protocol::new();
    let deadline = p.far_deadline();
    let order = p.create_order(1, AMOUNT, deadline);

    let outsider = p.outsider.insecure_clone();
    let logs = send_expect_err(
        &mut p.svm,
        &[ix_refund(
            &outsider.pubkey(),
            &p.buyer.pubkey(),
            &p.mint,
            &order,
            &p.buyer_ata,
        )],
        &outsider,
        &[&outsider],
    );
    assert!(logs.contains("HasOne"), "logs: {logs}");
}
