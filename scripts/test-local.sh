#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

RPC="http://127.0.0.1:8899"
WALLET="${ANCHOR_WALLET:-$HOME/.config/solana/id.json}"
PROGRAM_SO="target/deploy/stablecart.so"
PROGRAM_KP="target/deploy/stablecart-keypair.json"

cleanup() {
  if [[ -n "${VALIDATOR_PID:-}" ]]; then
    kill -9 "$VALIDATOR_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "Building program"
anchor build

echo "Starting standalone validator"
pkill -9 -f solana-test-validator 2>/dev/null || true
sleep 2
rm -rf test-ledger
solana-test-validator --reset --quiet >/tmp/stablecart-validator.log 2>&1 &
VALIDATOR_PID=$!

echo "Waiting for validator RPC endpoint"
for _ in $(seq 1 30); do
  if solana cluster-version --url "$RPC" >/dev/null 2>&1; then break; fi
  sleep 1
done

echo "Funding wallet and deploying program"
solana airdrop 100 "$(solana address -k "$WALLET")" --url "$RPC" >/dev/null
solana program deploy "$PROGRAM_SO" --program-id "$PROGRAM_KP" --keypair "$WALLET" --url "$RPC"

echo "Running tests"
anchor test --skip-local-validator --skip-deploy --provider.cluster "$RPC"
