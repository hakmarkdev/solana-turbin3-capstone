import { useMemo } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import type { Program } from "@coral-xyz/anchor";
import { getProgram, getProvider, getReadonlyProgram } from "@/lib/program";

// Returns a StableCart `Solana Program` that can sign transactions if a wallet is connected
export function useProgram(): { program: Program; canSign: boolean } {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  return useMemo(() => {
    if (wallet) {
      const provider = getProvider(connection, wallet);
      return { program: getProgram(provider), canSign: true };
    }
    return { program: getReadonlyProgram(connection), canSign: false };
  }, [connection, wallet]);
}
