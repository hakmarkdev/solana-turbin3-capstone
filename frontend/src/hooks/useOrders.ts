import type { PublicKey } from "@solana/web3.js";
import { useProgram } from "./useProgram";
import { useAsync } from "./useAsync";
import type { OrderAccount } from "@/lib/program";

export interface OrderEntry {
  publicKey: PublicKey;
  account: OrderAccount;
}

// Fetches every on-chain Order
export function useOrders() {
  const { program } = useProgram();
  const { data, loading, error, refresh } = useAsync<OrderEntry[]>(async () => {
    const all = await (program.account as any).order.all();
    return (all as any[])
      .map((o) => ({
        publicKey: o.publicKey,
        account: o.account as OrderAccount,
      }))
      .sort((a, b) => b.account.deadline.cmp(a.account.deadline));
  }, [program]);

  return { orders: data ?? [], loading, error, refresh };
}

// Fetches a single Order by its PDA
export function useOrder(pubkey: PublicKey | null) {
  const { program } = useProgram();
  const { data, loading, error, refresh } = useAsync<OrderAccount | null>(
    () =>
      pubkey
        ? (program.account as any).order.fetchNullable(pubkey)
        : Promise.resolve(null),
    [program, pubkey?.toBase58()]
  );

  return { order: data, loading, error, refresh };
}
