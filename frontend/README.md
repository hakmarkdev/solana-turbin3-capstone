# StableCart Frontend v1.0.0

**StableCart** USDC escrow program on Solana.

## Stack

- **Vite + React 18 + TypeScript**
- **Tailwind CSS** + shadcn/ui components (neutral / black & white theme)
- **@coral-xyz/anchor** + **@solana/web3.js** for program interaction
- **@solana/wallet-adapter** (Phantom, Solflare) for wallet connection

## Pages

| Route             | Purpose                                                                          |
| ----------------- | -------------------------------------------------------------------------------- |
| `/`               | Landing page what StableCart does and how the escrow flow works.                 |
| `/orders`         | All on-chain orders, filtered by your role (buying / selling / arbitrate).       |
| `/orders/:address`| Order detail with role-aware actions (release, refund, claim, dispute, resolve). |
| `/create`         | Buyer funds a new escrow order (merchant, amount, deadline).                     |
| `/admin`          | View the protocol Config, or initialize it (fee, arbiter, mint).                 |

### Solana Program actions wired up

- `initialize`  admin sets fee + arbiter + allowed USDC mint
- `create_order`  buyer locks USDC into a per-order vault
- `confirm_release` buyer releases funds to the merchant
- `claim_after_deadline` merchant claims once the deadline passes
- `refund` merchant returns the full amount to the buyer
- `open_dispute` buyer or merchant disputes before the deadline
- `resolve_dispute` arbiter splits funds by basis points

## Getting started

```bash
cd frontend
npm install
npm run dev
```

URL: http://localhost:5173

### Configuration

The app talks to **devnet** by default. Override the RPC endpoint via a `.env`
file (see `.env.example`):

```
VITE_RPC_URL=https://api.devnet.solana.com
VITE_CLUSTER=devnet
```

The program ID and PDA seeds live in `src/lib/constants.ts`, and the IDL is
copied from `target/idl/stablecart.json` into `src/lib/idl/`. If the program is
rebuilt, refresh the IDL:

```bash
cp ../target/idl/stablecart.json src/lib/idl/stablecart.json
```

## Build

```bash
npm run build
npm run preview
```
