import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[]
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const runIdRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  const refresh = useCallback(async () => {
    const id = ++runIdRef.current;
    const superseded = () => !mountedRef.current || id !== runIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await run();
      if (superseded()) return;
      setData(result);
    } catch (e) {
      if (superseded()) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (!superseded()) setLoading(false);
    }
  }, [run]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
