// Unit tests for the WCA solve-statistics logic.
import { average, best, sessionMean, effectiveMs, formatMs, type Solve } from '../src/timer/stats.ts'

let failures = 0
const check = (cond: boolean, msg: string) => {
  if (!cond) {
    failures++
    console.error('  ✗', msg)
  }
}
const approx = (a: number | null, b: number, msg: string) =>
  check(a !== null && Math.abs(a - b) < 1e-6, `${msg} (got ${a}, want ${b})`)

const mk = (ms: number, penalty: Solve['penalty'] = 'none'): Solve => ({
  ms,
  penalty,
  scramble: '',
  date: 0,
})

// effectiveMs
check(effectiveMs(mk(1000)) === 1000, 'effectiveMs none')
check(effectiveMs(mk(1000, 'plus2')) === 3000, 'effectiveMs +2 adds 2000')
check(effectiveMs(mk(1000, 'dnf')) === null, 'effectiveMs DNF null')

// average of 5: drop best & worst, mean middle 3
const five = [mk(10000), mk(12000), mk(11000), mk(9000), mk(13000)]
approx(average(five, 5), (10000 + 12000 + 11000) / 3, 'ao5 trims best/worst')
check(average(five.slice(0, 4), 5) === null, 'ao5 needs 5 solves')

// one DNF is dropped as worst
const oneDnf = [mk(10000), mk(12000), mk(11000), mk(9000, 'dnf'), mk(13000)]
// times: 10,12,11,DNF(worst),13 -> drop DNF & best(10) -> mean(12,11,13)
approx(average(oneDnf, 5), (12000 + 11000 + 13000) / 3, 'ao5 with one DNF')

// two DNFs -> DNF average
const twoDnf = [mk(10000), mk(12000, 'dnf'), mk(11000), mk(9000, 'dnf'), mk(13000)]
check(average(twoDnf, 5) === null, 'ao5 with two DNFs is DNF')

// +2 counts toward the average value
const withPlus2 = [mk(10000), mk(10000, 'plus2'), mk(10000), mk(10000), mk(10000)]
// values: 10,12,10,10,10 -> drop best(10) & worst(12) -> mean(10,10,10)=10000
approx(average(withPlus2, 5), 10000, 'ao5 with +2')

// best excludes DNF
check(best([mk(9000, 'dnf'), mk(10000), mk(11000)]) === 10000, 'best excludes DNF')
check(best([mk(9000, 'dnf')]) === null, 'best of all-DNF is null')

// sessionMean excludes DNF
approx(sessionMean([mk(10000), mk(20000), mk(5000, 'dnf')]), 15000, 'sessionMean excludes DNF')

// formatMs
check(formatMs(9340) === '9.34', 'formatMs sub-minute')
check(formatMs(75340) === '1:15.34', 'formatMs over a minute')
check(formatMs(null) === 'DNF', 'formatMs null is DNF')

if (failures === 0) {
  console.log('✓ stats tests passed')
  process.exit(0)
} else {
  console.error(`✗ ${failures} stats check(s) failed`)
  process.exit(1)
}
