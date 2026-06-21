mod common;
use common::*;

#[test]
fn create_order_locks_funds_and_snapshots() {
    let mut p = Protocol::new();
    let buyer_before = token_balance(&p.svm, &p.buyer_ata);

    let deadline = p.far_deadline();
    let order = p.create_order(1, AMOUNT, deadline);
    let vault = vault_pda(&order);

    // Funds moved buyer to vault
    assert_eq!(token_balance(&p.svm, &vault), AMOUNT);
    assert_eq!(token_balance(&p.svm, &p.buyer_ata), buyer_before - AMOUNT);

    // State and snapshots
    assert_eq!(order_amount(&p.svm, &order), AMOUNT);
    assert_eq!(order_fee_bps(&p.svm, &order), FEE_BPS);
    assert_eq!(order_arbiter(&p.svm, &order), p.arbiter.pubkey());
    assert_eq!(order_status(&p.svm, &order), STATUS_FUNDED);
}
