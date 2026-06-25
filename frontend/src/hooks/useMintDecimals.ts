import { useEffect, useState } from "react";
import type { Connection, PublicKey } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import { getMint, TOKEN_PROGRAM_ID } from "@solana/spl-token";

const cache = new Map<string, number>();
const inflight = new Map<string, Promise<number>>();

function loadDecimals(
  connection: Connection,
  mint: PublicKey
): Promise<number> {
  const key = mint.toBase58();
  const cached = cache.get(key);
  if (cached !== undefined) return Promise.resolve(cached);

  let promise = inflight.get(key);
  if (!promise) {
    promise = getMint(connection, mint, "confirmed", TOKEN_PROGRAM_ID)
      .then((m) => {
        cache.set(key, m.decimals);
        return m.decimals;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, promise);
  }
  return promise;
}

export function useMintDecimals(
  mint: PublicKey | null | undefined
): number | undefined {
  const { connection } = useConnection();
  const key = mint?.toBase58();
  const [decimals, setDecimals] = useState<number | undefined>(() =>
    key ? cache.get(key) : undefined
  );

  useEffect(() => {
    if (!mint || !key) {
      setDecimals(undefined);
      return;
    }
    setDecimals(cache.get(key));
    let active = true;
    loadDecimals(connection, mint)
      .then((d) => {
        if (active) setDecimals(d);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [connection, key]);

  return decimals;
}
