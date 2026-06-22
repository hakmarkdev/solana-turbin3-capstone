/**
 * Devnet smoke test
 * Run:  anchor test --provider.cluster devnet --skip-deploy
 */
import * as anchor from "@anchor-lang/core";
import { Program, BN, web3 } from "@anchor-lang/core";
import { Stablecart } from "../target/types/stablecart";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccountIdempotent,
  getAssociatedTokenAddressSync,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { assert } from "chai";

const { PublicKey, Keypair, LAMPORTS_PER_SOL } = web3;

describe("stablecart (devnet smoke)", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.stablecart as Program<Stablecart>;
  const connection = provider.connection;
  const admin = (provider.wallet as anchor.Wallet).payer;
  const programId = program.programId;

  const DECIMALS = 6;
  const FEE_BPS = 50; // 0.50%
  const BPS_DENOMINATOR = 10_000;
  const AMOUNT = 1_000_000; // 1.0 token

  const seed = (s: string) => {
    const b = Buffer.alloc(32);
    Buffer.from(s).copy(b);
    return Uint8Array.from(b);
  };
  const buyer = Keypair.fromSeed(seed("stablecart-devnet-buyer"));
  const merchant = Keypair.fromSeed(seed("stablecart-devnet-merchant"));
  const arbiter = Keypair.fromSeed(Uint8Array.from(Array(32).fill(11)));

  let mint: web3.PublicKey;
  let buyerAta: web3.PublicKey;
  let merchantAta: web3.PublicKey;

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  );
  const [treasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("treasury"), configPda.toBuffer()],
    programId
  );

  const orderId = new BN(Date.now());
  const orderIdBuf = orderId.toArrayLike(Buffer, "le", 8);
  const [orderPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("order"), buyer.publicKey.toBuffer(), orderIdBuf],
    programId
  );
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), orderPda.toBuffer()],
    programId
  );

  const bal = async (ata: web3.PublicKey): Promise<number> =>
    Number((await getAccount(connection, ata)).amount);

  before(async () => {
    const ensureFunded = async (
      pk: web3.PublicKey,
      minSol: number,
      topUpSol: number
    ) => {
      if ((await connection.getBalance(pk)) >= minSol * LAMPORTS_PER_SOL)
        return;
      const tx = new web3.Transaction().add(
        web3.SystemProgram.transfer({
          fromPubkey: admin.publicKey,
          toPubkey: pk,
          lamports: Math.floor(topUpSol * LAMPORTS_PER_SOL),
        })
      );
      await provider.sendAndConfirm(tx);
    };
    await ensureFunded(buyer.publicKey, 0.01, 0.02);
    await ensureFunded(merchant.publicKey, 0.005, 0.01);

    // Reuse config.allowed_mint on re-runs
    const cfgInfo = await connection.getAccountInfo(configPda);
    if (cfgInfo) {
      mint = (await program.account.config.fetch(configPda)).allowedMint;
    } else {
      mint = await createMint(
        connection,
        admin,
        admin.publicKey,
        null,
        DECIMALS
      );
      await program.methods
        .initialize(FEE_BPS, arbiter.publicKey)
        .accounts({
          admin: admin.publicKey,
          mint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
    }

    await createAssociatedTokenAccountIdempotent(
      connection,
      buyer,
      mint,
      buyer.publicKey
    );
    await createAssociatedTokenAccountIdempotent(
      connection,
      merchant,
      mint,
      merchant.publicKey
    );
    buyerAta = getAssociatedTokenAddressSync(mint, buyer.publicKey);
    merchantAta = getAssociatedTokenAddressSync(mint, merchant.publicKey);
    await mintTo(connection, admin, mint, buyerAta, admin, AMOUNT);
  });

  it("initialize: config holds the protocol arbiter/mint/fee", async () => {
    const config = await program.account.config.fetch(configPda);
    assert.ok(config.arbiter.equals(arbiter.publicKey));
    assert.ok(config.allowedMint.equals(mint));
    assert.equal(config.feeBps, FEE_BPS);
  });

  it("create_order: buyer locks USDC in the vault", async () => {
    const deadline = new BN(Math.floor(Date.now() / 1000) + 3600);
    await program.methods
      .createOrder(orderId, new BN(AMOUNT), deadline)
      .accounts({
        buyer: buyer.publicKey,
        merchant: merchant.publicKey,
        config: configPda,
        mint,
        buyerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([buyer])
      .rpc();

    assert.equal(await bal(vaultPda), AMOUNT);
    const order = await program.account.order.fetch(orderPda);
    assert.deepEqual(order.status, { funded: {} });
  });

  it("confirm_release: merchant paid (amount-fee), fee to treasury, accounts closed", async () => {
    const fee = (AMOUNT * FEE_BPS) / BPS_DENOMINATOR;
    const mBefore = await bal(merchantAta);
    const tBefore = await bal(treasuryPda);

    await program.methods
      .confirmRelease()
      .accounts({
        signer: buyer.publicKey,
        config: configPda,
        order: orderPda,
        buyer: buyer.publicKey,
        merchant: merchant.publicKey,
        mint,
        merchantAta,
        treasury: treasuryPda,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([buyer])
      .rpc();

    assert.equal(await bal(merchantAta), mBefore + (AMOUNT - fee));
    assert.equal(await bal(treasuryPda), tBefore + fee);
    assert.isNull(await connection.getAccountInfo(vaultPda));
    assert.isNull(await connection.getAccountInfo(orderPda));
  });
});
