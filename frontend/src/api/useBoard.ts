import { useCallback, useEffect, useRef, useState } from 'react';
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
  const seq = useRef(0);

  const load = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    try {
      const b = await getBoard();
      if (n !== seq.current) return;
      setBoard(b);
      setError(null);
    } catch (e) {
      if (n === seq.current) setError(toApiError(e));
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = useCallback(async (request: () => Promise<Board>) => {
    const n = ++seq.current;
    try {
      const b = await request();
      if (n === seq.current) {
        setBoard(b);
        setError(null);
      }
      return b;
    } catch (e) {
      const err = toApiError(e);
      // Server unreachable mid-session: surface it globally but keep the last good board.
      if (err.status === 0 && n === seq.current) setError(err);
      throw err;
    }
  }, []);

  const set = useCallback((b: Board) => {
    ++seq.current;
    setBoard(b);
    setError(null);
  }, []);

  return { board, loading: loading && board === null, error, retry: () => void load(), apply, set };
}
