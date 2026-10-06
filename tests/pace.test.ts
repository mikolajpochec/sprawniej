import { describe, expect, test } from 'bun:test'
import { retryAtFrom } from '@/github/api'
import { keepRecent, QUIET_DELAY, saveDelay } from '@/sync/pace'

const now = 10_000_000
const times = (n: number, ago = 60_000) => Array.from({ length: n }, () => now - ago)

describe('save pacing', () => {
  test('a quiet hour saves quickly', () => {
    expect(saveDelay([], now)).toBe(QUIET_DELAY)
    expect(saveDelay(times(19), now)).toBe(QUIET_DELAY)
  })
  test('a busy hour saves in bigger batches', () => {
    expect(saveDelay(times(20), now)).toBe(4_000)
    expect(saveDelay(times(60), now)).toBe(10_000)
    expect(saveDelay(times(150), now)).toBe(30_000)
  })
  test('saves older than an hour do not count', () => {
    expect(saveDelay(times(150, 3_700_000), now)).toBe(QUIET_DELAY)
    expect(keepRecent([...times(3), ...times(5, 3_700_000)], now)).toHaveLength(3)
  })
})

describe('GitHub asking us to wait', () => {
  const h = (o: Record<string, string>) => new Headers(o)
  test('retry-after wins', () => {
    expect(retryAtFrom(403, h({ 'retry-after': '30' }), 'x', now)).toBe(now + 30_000)
    expect(retryAtFrom(429, h({ 'retry-after': '5' }), 'x', now)).toBe(now + 5_000)
  })
  test('the hourly limit waits for its reset', () => {
    expect(retryAtFrom(403, h({ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(now / 1000 + 120) }), 'x', now)).toBe(now + 120_000)
  })
  test('a secondary limit without headers waits a minute', () => {
    expect(retryAtFrom(403, h({}), 'You have exceeded a secondary rate limit', now)).toBe(now + 60_000)
  })
  test('other errors are not waits', () => {
    expect(retryAtFrom(403, h({}), 'Resource not accessible', now)).toBeUndefined()
    expect(retryAtFrom(500, h({ 'retry-after': '5' }), 'x', now)).toBeUndefined()
  })
})
