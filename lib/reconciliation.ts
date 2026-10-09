export function reconciliationDelayMinutes(attempts: number): number {
  return Math.min(360, Math.max(1, 2 ** Math.min(attempts, 9)));
}
