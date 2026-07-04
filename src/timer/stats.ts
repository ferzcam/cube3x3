// Pure solve-statistics logic (WCA averaging rules), kept separate from the
// timer UI so it can be unit-tested.

export type Penalty = 'none' | 'plus2' | 'dnf'

export type Solve = {
  ms: number // raw solve time in milliseconds
  scramble: string
  date: number // epoch ms
  penalty: Penalty
}

/** Effective time including penalties; null means DNF. */
export function effectiveMs(s: Solve): number | null {
  if (s.penalty === 'dnf') return null
  return s.penalty === 'plus2' ? s.ms + 2000 : s.ms
}

/** WCA average of the last `n` solves: drop the best and worst, mean the rest.
 *  A single DNF is the worst (dropped); two or more DNFs make the average DNF.
 *  Returns null if there are fewer than `n` solves or the average is DNF. */
export function average(solves: Solve[], n: number): number | null {
  if (solves.length < n) return null
  const window = solves.slice(-n)
  const times = window.map(effectiveMs)
  const dnfCount = times.filter((t) => t === null).length
  if (dnfCount >= 2) return null
  const vals = times.map((t) => (t === null ? Infinity : t))
  const sorted = [...vals].sort((a, b) => a - b)
  const trimmed = sorted.slice(1, sorted.length - 1) // drop best & worst
  const sum = trimmed.reduce((a, b) => a + b, 0)
  return sum / trimmed.length
}

/** Best (fastest) non-DNF single. */
export function best(solves: Solve[]): number | null {
  const times = solves.map(effectiveMs).filter((t): t is number => t !== null)
  return times.length ? Math.min(...times) : null
}

/** Mean of all non-DNF solves in the session. */
export function sessionMean(solves: Solve[]): number | null {
  const times = solves.map(effectiveMs).filter((t): t is number => t !== null)
  return times.length ? times.reduce((a, b) => a + b, 0) / times.length : null
}

/** Format milliseconds as m:ss.cc / ss.cc, or "DNF" for null. */
export function formatMs(ms: number | null): string {
  if (ms === null) return 'DNF'
  const total = Math.round(ms)
  const cs = Math.floor((total % 1000) / 10)
  const s = Math.floor(total / 1000) % 60
  const m = Math.floor(total / 60000)
  const pad = (x: number) => String(x).padStart(2, '0')
  return m > 0 ? `${m}:${pad(s)}.${pad(cs)}` : `${s}.${pad(cs)}`
}
