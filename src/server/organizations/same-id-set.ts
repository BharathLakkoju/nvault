/**
 * Compares two ID lists for set equality. Rejects duplicate IDs in either
 * list — a duplicate in the client payload must not stand in for a missing
 * project/member during org key rotation.
 */
export function sameIdSet(a: string[], b: string[]): boolean {
  if (new Set(a).size !== a.length || new Set(b).size !== b.length) return false;
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((x, index) => x === right[index]);
}
