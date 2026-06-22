mod common;
use common::*;

#[test]
fn open_dispute_by_buyer_sets_disputed_and_blocks_non_party() {
    let mut p = Protocol::new();
    let deadline = p.far_deadline();
    let order = p.create_order(1, AMOUNT, deadline);

    let outsider = p.outsider.insecure_clone();
    let logs = send_expect_err(
        &mut p.svm,
        &[ix_open_dispute(&outsider.pubkey(), &order)],
        &outsider,
        &[&outsider],
    );
    assert!(logs.contains("Unauthorized"), "logs: {logs}");

    // Buyer opens the dispute
    let buyer = p.buyer.insecure_clone();
    send(
        &mut p.svm,
        &[ix_open_dispute(&buyer.pubkey(), &order)],
        &buyer,
        &[&buyer],
    )
    .unwrap();
    assert_eq!(order_status(&p.svm, &order), STATUS_DISPUTED);
}

#[test]
fn open_dispute_rejected_after_deadline() {
    let mut p = Protocol::new();
    let deadline = now(&p.svm) + 1000;
    let order = p.create_order(1, AMOUNT, deadline);

    set_unix(&mut p.svm, deadline + 1);
    let buyer = p.buyer.insecure_clone();
    let logs = send_expect_err(
        &mut p.svm,
        &[ix_open_dispute(&buyer.pubkey(), &order)],
        &buyer,
        &[&buyer],
    );
    assert!(logs.contains("DeadlinePassed"), "logs: {logs}");
}

#[test]
fn dispute_blocks_claim_after_deadline() {
    let mut p = Protocol::new();
    let deadline = now(&p.svm) + 1000;
    let order = p.create_order(1, AMOUNT, deadline);

    // Dispute while still in the loop
    let buyer = p.buyer.insecure_clone();
    send(
        &mut p.svm,
        &[ix_open_dispute(&buyer.pubkey(), &order)],
        &buyer,
        &[&buyer],
    )
    .unwrap();

    // After the deadline window the merchant claim is blocked
    set_unix(&mut p.svm, deadline + 1);
    let merchant = p.merchant.insecure_clone();
    let logs = send_expect_err(
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
    );
    assert!(logs.contains("InvalidStatus"), "logs: {logs}");
}

#[test]
fn resolve_dispute_splits_with_fee_on_merchant_share() {
    let mut p = Protocol::new();
    let deadline = p.far_deadline();
    let order = p.create_order(1, AMOUNT, deadline);
    let vault = vault_pda(&order);

    let buyer = p.buyer.insecure_clone();
    send(
        &mut p.svm,
        &[ix_open_dispute(&buyer.pubkey(), &order)],
        &buyer,
        &[&buyer],
    )
    .unwrap();

    let arbiter = p.arbiter.insecure_clone();
    let outsider = p.outsider.insecure_clone();
    let resolve = |arb: &Keypair, bps: u16| {
        ix_resolve_dispute(
            &arb.pubkey(),
            &p.buyer.pubkey(),
            &p.merchant.pubkey(),
            &p.mint,
            &order,
            &p.buyer_ata,
            &p.merchant_ata,
            bps,
        )
    };

    // Non arbiter signer rejected has_one = arbiter
    let logs = send_expect_err(
        &mut p.svm,
        &[resolve(&outsider, 5000)],
        &outsider,
        &[&outsider],
    );
    assert!(logs.contains("HasOne"), "logs: {logs}");

    // Split rejected
    let logs = send_expect_err(
        &mut p.svm,
        &[resolve(&arbiter, 10001)],
        &arbiter,
        &[&arbiter],
    );
    assert!(logs.contains("InvalidSplit"), "logs: {logs}");

    // Half split with fee on merchant share
    let buyer_share = AMOUNT * 5000 / BPS_DENOMINATOR; // 500_000
    let remaining = AMOUNT - buyer_share; // 500_000
    let fee = remaining * FEE_BPS as u64 / BPS_DENOMINATOR; // 2_500
    let merchant_share = remaining - fee; // 497_500

    let b_before = token_balance(&p.svm, &p.buyer_ata);
    let m_before = token_balance(&p.svm, &p.merchant_ata);
    let t_before = token_balance(&p.svm, &treasury_pda());

    send(
        &mut p.svm,
        &[resolve(&arbiter, 5000)],
        &arbiter,
        &[&arbiter],
    )
    .unwrap();

    assert_eq!(token_balance(&p.svm, &p.buyer_ata), b_before + buyer_share);
    assert_eq!(
        token_balance(&p.svm, &p.merchant_ata),
        m_before + merchant_share
    );
    assert_eq!(token_balance(&p.svm, &treasury_pda()), t_before + fee);
    assert!(!account_live(&p.svm, &vault));
    assert!(!account_live(&p.svm, &order));
}

#[test]
fn resolve_dispute_rejected_when_not_disputed() {
    let mut p = Protocol::new();
    let deadline = p.far_deadline();
    // Funded, but never disputed
    let order = p.create_order(1, AMOUNT, deadline);

    let arbiter = p.arbiter.insecure_clone();
    let logs = send_expect_err(
        &mut p.svm,
        &[ix_resolve_dispute(
            &arbiter.pubkey(),
            &p.buyer.pubkey(),
            &p.merchant.pubkey(),
            &p.mint,
            &order,
            &p.buyer_ata,
            &p.merchant_ata,
            5000,
        )],
        &arbiter,
        &[&arbiter],
    );
    assert!(logs.contains("InvalidStatus"), "logs: {logs}");
}
