/**
 * Three-way merge of one file: what it was when we last synced (base), our unsaved version (ours) and what a
 * teammate saved (theirs). Rules, from docs/architecture.md:
 *  - different fields both survive; the same field changed on both sides → ours (we're the later save)
 *  - lists of ids (labels, members…) merge as sets: additions and removals from both sides apply
 *  - descriptions merge line by line; overlapping lines → ours
 *  - an edit beats a delete
 * `null` = the file doesn't exist (deleted, or never was).
 */
import { diff3Merge } from 'node-diff3'
import { classify, joinFrontMatter, splitFrontMatter } from '@/data/files'

export interface MergeResult {
  text: string | null
  /** both sides changed the same thing and ours was kept */
  conflict: boolean
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const isPrimList = (v: unknown): v is (string | number | null)[] => Array.isArray(v) && v.every((x) => x === null || typeof x !== 'object')

interface Ctx {
  conflicts: number
}

export function mergeValue(base: unknown, ours: unknown, theirs: unknown, ctx: Ctx = { conflicts: 0 }): unknown {
  if (same(ours, theirs)) return ours
  if (base !== undefined && same(ours, base)) return theirs
  if (base !== undefined && same(theirs, base)) return ours
  if (isObj(ours) && isObj(theirs) && (base === undefined || isObj(base))) {
    const b = (base ?? {}) as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const k of new Set([...Object.keys(ours), ...Object.keys(theirs)])) {
      const v = mergeValue(b[k], ours[k], theirs[k], ctx)
      if (v !== undefined) out[k] = v
    }
    return out
  }
  if (isPrimList(ours) && isPrimList(theirs) && (base === undefined || isPrimList(base))) {
    const b = new Set(base ?? [])
    const t = new Set(theirs)
    const out = ours.filter((x) => !(b.has(x) && !t.has(x))) // theirs removed it
    for (const x of theirs) if (!b.has(x) && !out.includes(x)) out.push(x) // theirs added it
    return out
  }
  if (base === undefined && (ours === undefined || theirs === undefined)) return ours ?? theirs
  ctx.conflicts++
  return ours
}

/** line-by-line merge; overlapping changes keep our lines */
export function mergeText(base: string, ours: string, theirs: string, ctx: Ctx = { conflicts: 0 }): string {
  if (ours === theirs || theirs === base) return ours
  if (ours === base) return theirs
  const lines = (s: string) => s.split('\n')
  const out: string[] = []
  for (const region of diff3Merge(lines(ours), lines(base), lines(theirs))) {
    if (region.ok) out.push(...region.ok)
    else if (region.conflict) {
      ctx.conflicts++
      out.push(...region.conflict.a)
    }
  }
  return out.join('\n')
}

function mergeFrontMatterFile(base: string | null, ours: string, theirs: string, ctx: Ctx, isIssue: boolean): string {
  const b = base === null ? null : splitFrontMatter(base)
  const o = splitFrontMatter(ours)
  const t = splitFrontMatter(theirs)
  if (isIssue) {
    // "last touched" is the newer of the two, whoever wins the other fields; it is never a clash
    const of = o.fields as Record<string, unknown>
    const tf = t.fields as Record<string, unknown>
    const newest = [of.updatedAt, tf.updatedAt].filter((x): x is string => typeof x === 'string').sort().at(-1)
    if (newest) of.updatedAt = tf.updatedAt = newest
  }
  const fields = mergeValue(b?.fields, o.fields, t.fields, ctx) as Record<string, unknown>
  const body = b ? mergeText(b.body, o.body, t.body, ctx) : o.body === t.body ? o.body : (ctx.conflicts++, o.body)
  return joinFrontMatter(fields, body)
}

export function mergeFile(path: string, base: string | null, ours: string | null, theirs: string | null): MergeResult {
  if (ours === theirs) return { text: ours, conflict: false }
  if (ours === base) return { text: theirs, conflict: false }
  if (theirs === base) return { text: ours, conflict: false }
  // one side deleted, the other changed it: keep the changed one
  if (ours === null) return { text: theirs, conflict: false }
  if (theirs === null) return { text: ours, conflict: false }

  const ctx: Ctx = { conflicts: 0 }
  const kind = classify(path)?.kind
  try {
    if (kind === 'issue' || kind === 'comment') return { text: mergeFrontMatterFile(base, ours, theirs, ctx, kind === 'issue'), conflict: ctx.conflicts > 0 }
    if (path.endsWith('.json')) {
      const v = mergeValue(base === null ? undefined : JSON.parse(base), JSON.parse(ours), JSON.parse(theirs), ctx)
      return { text: `${JSON.stringify(v, null, 2)}\n`, conflict: ctx.conflicts > 0 }
    }
  } catch {
    /* a file we can't read: fall through to "ours wins" */
  }
  return { text: ours, conflict: true }
}
