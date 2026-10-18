"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "./api";

type Settled<T> = { key: string; data: T | null; error: ApiError | null };

/** Runs an API call on mount (and when deps change) with loading, error and retry states. */
export function useApi<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([...deps, attempt]);
  const [settled, setSettled] = useState<Settled<T>>({ key: "", data: null, error: null });

  useEffect(() => {
    let alive = true;
    fn()
      .then((data) => alive && setSettled({ key, data, error: null }))
      .catch((err) =>
        alive &&
        setSettled({
          key,
          data: null,
          error: err instanceof ApiError ? err : new ApiError(0, "Something went wrong."),
        }),
      );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loading = settled.key !== key;
  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return {
    data: loading ? null : settled.data,
    error: loading ? null : settled.error,
    loading,
    retry,
  };
}
