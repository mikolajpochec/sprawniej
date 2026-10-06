/**
 * How long to wait before saving. GitHub limits how many changes one person can make in an hour (each save costs
 * three), so a busy hour saves in bigger batches. A quiet hour saves 1.5 s after you stop.
 */
export const QUIET_DELAY = 1_500
const HOUR = 3_600_000

const STEPS: [saves: number, delay: number][] = [
  [120, 30_000],
  [60, 10_000],
  [20, 4_000],
]

/** `saves` = when earlier saves happened (ms); only the last hour counts */
export function saveDelay(saves: number[], now = Date.now()): number {
  const recent = saves.filter((t) => now - t < HOUR).length
  for (const [n, delay] of STEPS) if (recent >= n) return delay
  return QUIET_DELAY
}

/** forget saves older than an hour */
export const keepRecent = (saves: number[], now = Date.now()) => saves.filter((t) => now - t < HOUR)
