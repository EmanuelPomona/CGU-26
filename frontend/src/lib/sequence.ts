/**
 * Ordering for responses that each replace the whole board. A response is applied only if it was
 * issued after the last one applied, so a failed later request never discards an earlier success,
 * and a stale earlier response never overwrites a newer one.
 */
export function createSequence() {
  let issued = 0;
  let applied = 0;
  return {
    issue: () => ++issued,
    accept(n: number): boolean {
      if (n <= applied) return false;
      applied = n;
      return true;
    },
  };
}
