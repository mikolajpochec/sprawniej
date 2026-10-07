/**
 * A Linear custom view's filter (its `filterData`) → Sprawniej filters. Linear's filters can say much more than
 * ours: we keep status, assignee, priority, labels, project and team with "is" and "is any of", and anything joined
 * with "and". Everything else ("is not", "or", dates, cycles, text…) is left out, and the view is reported as not
 * exact, so the import can say which views to check. Pure, tested in tests/linearImport.test.ts.
 */
import type { Filters } from '@/model/schema'
import { STATUSES, type StatusGroup, type StatusId } from '@/model/status'
import { mapStatus } from './linearMap'
import type { LState } from './linearApi'

export interface FilterContext {
  /** workflow states by id */
  states: Map<string, LState>
  /** a Linear user → a login here; null = matched to "no one"; undefined = not known */
  person: (linearUserId: string) => string | null | undefined
  /** a Linear label (by id) → label ids here */
  label: (linearLabelId: string) => string | undefined
  /** a Linear label name → label ids here (labels are matched by name too) */
  labelsNamed: (name: string) => string[]
  project: (linearProjectId: string) => string | undefined
  /** a Linear team, by id or by key → a team key here */
  team: (linearTeamIdOrKey: string) => string | undefined
}

type Key = 'statuses' | 'assignees' | 'priorities' | 'labels' | 'projects' | 'teams'

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** the values a comparator allows: { eq: x }, { in: [x, y] }, { null: true }; null when it's anything else */
function allowed(cmp: unknown): unknown[] | null {
  if (!isObj(cmp)) return null
  const keys = Object.keys(cmp)
  if (keys.length !== 1) return null
  if ('eq' in cmp) return [cmp.eq]
  if ('in' in cmp && Array.isArray(cmp.in)) return cmp.in
  if ('null' in cmp && cmp.null === true) return [null]
  return null
}

/** Linear's state types → every status here in that group */
const GROUPS: Record<string, StatusGroup> = { triage: 'backlog', backlog: 'backlog', unstarted: 'unstarted', started: 'started', completed: 'completed', canceled: 'canceled' }

export function mapViewFilter(filterData: unknown, ctx: FilterContext): { filters: Filters; exact: boolean } {
  const out = new Map<Key, unknown[]>()
  let exact = true
  const lose = () => {
    exact = false
  }
  /** values for one of our filters; a second condition on the same thing narrows it */
  const put = (key: Key, values: unknown[]) => {
    const unique = [...new Set(values)]
    const before = out.get(key)
    out.set(key, before ? before.filter((v) => unique.includes(v)) : unique)
  }
  /** turn Linear values into ours; any that can't be turned means the view isn't exact */
  const convert = <T,>(values: unknown[], one: (v: unknown) => T | T[] | undefined): T[] => {
    const res: T[] = []
    for (const v of values) {
      const r = one(v)
      if (r === undefined) lose()
      else res.push(...(Array.isArray(r) ? r : [r]))
    }
    return res
  }

  /** a field compared by one of several properties (id, name, key…); `by` turns each property's values */
  const byProperty = (f: unknown, by: Record<string, (vals: unknown[]) => unknown[] | null>, key: Key) => {
    if (!isObj(f)) return lose()
    for (const [prop, cmp] of Object.entries(f)) {
      const vals = by[prop] ? allowed(cmp) : null
      const mapped = vals && by[prop](vals)
      if (!mapped) {
        lose()
        continue
      }
      put(key, mapped)
    }
  }

  const status = (f: unknown) =>
    byProperty(
      f,
      {
        id: (vals) => convert(vals, (v) => (typeof v === 'string' && ctx.states.get(v) ? mapStatus(ctx.states.get(v)!) : undefined)),
        name: (vals) =>
          convert(vals, (v) => {
            if (typeof v !== 'string') return undefined
            const state = [...ctx.states.values()].find((s) => s.name.toLowerCase() === v.toLowerCase())
            return mapStatus(state ?? { name: v, type: '' })
          }),
        type: (vals) => convert<StatusId>(vals, (v) => (typeof v === 'string' && GROUPS[v] ? STATUSES.filter((s) => s.group === GROUPS[v]).map((s) => s.id) : undefined)),
      },
      'statuses',
    )

  const assignee = (f: unknown) => {
    // "no assignee" is { null: true } on the field itself
    const none = allowed(f)
    if (none && none.length === 1 && none[0] === null) return put('assignees', [null])
    byProperty(f, { id: (vals) => convert(vals, (v) => (typeof v === 'string' ? ctx.person(v) : undefined)) }, 'assignees')
  }

  const priority = (f: unknown) => {
    const vals = allowed(f)
    if (vals) return put('priorities', convert(vals, (v) => (typeof v === 'number' && v >= 0 && v <= 4 ? v : undefined)))
    lose()
  }

  const labels = (f: unknown) => {
    // labels: { some: { … } } (has any of), or the older labels: { id / name: … }
    const inner = isObj(f) && Object.keys(f).length === 1 && isObj(f.some) ? f.some : f
    byProperty(
      inner,
      {
        id: (vals) => convert(vals, (v) => (typeof v === 'string' ? ctx.label(v) : undefined)),
        name: (vals) => convert(vals, (v) => (typeof v === 'string' && ctx.labelsNamed(v).length ? ctx.labelsNamed(v) : undefined)),
      },
      'labels',
    )
  }

  const project = (f: unknown) => {
    const none = allowed(f)
    if (none && none.length === 1 && none[0] === null) return put('projects', [null])
    byProperty(f, { id: (vals) => convert(vals, (v) => (typeof v === 'string' ? ctx.project(v) : undefined)) }, 'projects')
  }

  const team = (f: unknown) => {
    const one = (vals: unknown[]) => convert(vals, (v) => (typeof v === 'string' ? ctx.team(v) : undefined))
    byProperty(f, { id: one, key: one }, 'teams')
  }

  const FIELDS: Record<string, (f: unknown) => void> = { state: status, assignee, priority, labels, project, team }

  const walk = (f: unknown) => {
    if (!isObj(f)) return
    for (const [k, v] of Object.entries(f)) {
      if (k === 'and' && Array.isArray(v)) v.forEach(walk)
      else if (k === 'or' && Array.isArray(v) && v.length === 1) walk(v[0])
      else if (FIELDS[k]) FIELDS[k](v)
      else lose()
    }
  }
  walk(filterData)

  const filters: Filters = {}
  for (const [k, vals] of out) {
    // nothing left would read as "no filter" here, which shows everything: leave it out and say so
    if (!vals.length) lose()
    else (filters as Record<string, unknown[]>)[k] = vals
  }
  return { filters, exact }
}
