import { useProgram } from "./useProgram";
import { useAsync } from "./useAsync";
import { configPda } from "@/lib/pdas";
import type { ConfigAccount } from "@/lib/program";

interface ConfigState {
  config: ConfigAccount | null;
  initialized: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useConfig(): ConfigState {
  const { program } = useProgram();
  const { data, loading, error, refresh } = useAsync<ConfigAccount | null>(
    () => (program.account as any).config.fetchNullable(configPda()),
    [program]
  );

  return { config: data, initialized: data !== null, loading, error, refresh };
}
