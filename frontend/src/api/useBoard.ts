import { useCallback, useEffect, useRef, useState } from 'react';
import { createSequence } from '../lib/sequence';
import { ApiError, getBoard } from './client';
import type { Board } from './types';

export interface BoardState {
  board: Board | null;
  /** First load in flight with nothing to show yet. */
  loading: boolean;
  /** Last failure. When `board` is also set, it is the last good board, kept on screen (F-2). */
  error: ApiError | null;
  retry: () => void;
  /** Run a mutation that returns the new Board; on failure the board is left as it was and the error rethrown. */
  apply: (request: () => Promise<Board>) => Promise<Board>;
  /** Replace the board with one returned inside another payload (decisions). */
  set: (b: Board) => void;
}

const toApiError = (e: unknown) =>
  e instanceof ApiError ? e : new ApiError(0, 'internal_error', e instanceof Error ? e.message : 'Unexpected error.');

export function useBoard(): BoardState {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  // Every response replaces the whole board, so apply one only if it is newer than the last applied.
  const seq = useRef(createSequence());

  const accept = useCallback((n: number, b: Board) => {
    if (!seq.current.accept(n)) return;
    setBoard(b);
    setError(null);
  }, []);

  const load = useCallback(async () => {
    const n = seq.current.issue();
    setLoading(true);
    try {
      accept(n, await getBoard());
    } catch (e) {
      setError(toApiError(e));
    } finally {
      setLoading(false);
    }
  }, [accept]);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = useCallback(
    async (request: () => Promise<Board>) => {
      const n = seq.current.issue();
      try {
        const b = await request();
        accept(n, b);
        return b;
      } catch (e) {
        const err = toApiError(e);
        // Server unreachable mid-session: surface it globally but keep the last good board.
        if (err.status === 0) setError(err);
        throw err;
      }
    },
    [accept],
  );

  const set = useCallback((b: Board) => accept(seq.current.issue(), b), [accept]);

  return { board, loading: loading && board === null, error, retry: () => void load(), apply, set };
}
