/**
 * An issue's history, read from the workspace's own saved versions on GitHub: every save is a commit, so comparing
 * one version of the issue file with the next tells who changed what, and when. Nothing extra is stored, and nothing
 * is loaded until someone opens the issue. Pure, so it's unit-tested (tests/history.test.ts).
 */
import type { Issue } from '@/model/schema'
import type { Priority, StatusId } from '@/model/status'
import { parseFile } from './files'

export type Change =
  | { kind: 'status'; from: StatusId; to: StatusId }
  | { kind: 'priority'; from: Priority; to: Priority }
  | { kind: 'assignee'; from: string | null; to: string | null }
  | { kind: 'labels'; added: string[]; removed: string[] }
  | { kind: 'project'; from: string | null; to: string | null }
  | { kind: 'parent'; from: string | null; to: string | null }
  | { kind: 'title'; from: string; to: string }
  | { kind: 'description' }
  | { kind: 'dueDate'; from: string | null; to: string | null }
  | { kind: 'estimate'; from: number | null; to: number | null }
  /** another team: a new key and number */
  | { kind: 'team'; from: string; to: string }
  /** the file went away (archived, or deleted and then brought back by an edit); `message` = the whole save message */
  | { kind: 'removed'; message: string }
  | { kind: 'restored' }

export interface HistoryEvent {
  at: string
  /** a GitHub login when GitHub knows who saved it, else the name on the save */
  by: string
  change: Change
}

/** one saved version of an issue file (github/api.ts, fileHistory) and where it was */
export interface Version {
  oid: string
  at: string
  message: string
  login: string | null
  name: string
  path: string
  text: string | null
}

function parse(v: Version): Issue | null {
  if (v.text === null) return null
  try {
    const p = parseFile(v.path, v.text)
    return p?.kind === 'issue' ? p.value : null
  } catch {
    return null
  }
}

const ref = (i: Issue) => `${i.team}-${i.number}`

/** what changed from one version of an issue to the next, in the order the issue page lists properties */
export function diffIssue(a: Issue, b: Issue): Change[] {
  const out: Change[] = []
  if (ref(a) !== ref(b)) out.push({ kind: 'team', from: ref(a), to: ref(b) })
  if (a.title !== b.title) out.push({ kind: 'title', from: a.title, to: b.title })
  if (a.status !== b.status) out.push({ kind: 'status', from: a.status, to: b.status })
  if (a.priority !== b.priority) out.push({ kind: 'priority', from: a.priority, to: b.priority })
  if (a.assignee !== b.assignee) out.push({ kind: 'assignee', from: a.assignee, to: b.assignee })
  const added = b.labels.filter((l) => !a.labels.includes(l))
  const removed = a.labels.filter((l) => !b.labels.includes(l))
  if (added.length || removed.length) out.push({ kind: 'labels', added, removed })
  if (a.project !== b.project) out.push({ kind: 'project', from: a.project, to: b.project })
  if (a.parent !== b.parent) out.push({ kind: 'parent', from: a.parent, to: b.parent })
  if ((a.dueDate ?? null) !== (b.dueDate ?? null)) out.push({ kind: 'dueDate', from: a.dueDate ?? null, to: b.dueDate ?? null })
  if ((a.estimate ?? null) !== (b.estimate ?? null)) out.push({ kind: 'estimate', from: a.estimate ?? null, to: b.estimate ?? null })
  if (a.description.trim() !== b.description.trim()) out.push({ kind: 'description' })
  return out
}

/** changes this close together, by the same person, read as one: typing saves a title several times, and a status
 * clicked twice in a row is one decision */
const together = (kind: Change['kind']) => (kind === 'title' || kind === 'description' ? 15 : 2) * 60_000

function combine(a: Change, b: Change): Change | null | undefined {
  if (a.kind !== b.kind) return undefined
  switch (a.kind) {
    case 'labels': {
      const bb = b as typeof a
      const added = [...new Set([...a.added.filter((l) => !bb.removed.includes(l)), ...bb.added.filter((l) => !a.removed.includes(l))])]
      const removed = [...new Set([...a.removed.filter((l) => !bb.added.includes(l)), ...bb.removed.filter((l) => !a.added.includes(l))])]
      return added.length || removed.length ? { kind: 'labels', added, removed } : null
    }
    case 'description':
      return a
    case 'removed':
    case 'restored':
      return undefined
    default: {
      const merged = { ...a, to: (b as typeof a).to } as Change
      // there and back again: nothing happened
      return 'from' in merged && merged.from === merged.to ? null : merged
    }
  }
}

/**
 * Versions of an issue file, oldest first in the order they were saved (possibly from several paths when it moved
 * between teams: the older path's versions first) → what happened, oldest first. Save times come from each person's
 * own clock, so they don't decide the order. The first version is the issue being created, which the page shows from
 * the issue's own fields.
 */
export function issueEvents(versions: Version[]): HistoryEvent[] {
  // one state per save: a move removes the old file and writes the new one in the same commit
  const byCommit = new Map<string, { at: string; by: string; issue: Issue | null; message: string }>()
  for (const v of versions) {
    const issue = parse(v)
    if (v.text !== null && !issue) continue // a version that can't be read (edited by hand) is skipped
    const seen = byCommit.get(v.oid)
    if (seen) seen.issue ??= issue
    else byCommit.set(v.oid, { at: v.at, by: v.login ?? v.name, issue, message: v.message })
  }
  const out: HistoryEvent[] = []
  let prev: Issue | null | undefined
  for (const step of byCommit.values()) {
    const changes: Change[] = []
    if (prev === undefined) {
      prev = step.issue
      continue
    }
    if (prev && !step.issue) changes.push({ kind: 'removed', message: step.message })
    else if (!prev && step.issue) changes.push({ kind: 'restored' })
    else if (prev && step.issue) changes.push(...diffIssue(prev, step.issue))
    if (step.issue) prev = step.issue
    else if (prev) prev = null
    for (const change of changes) {
      // fold into the same person's last change of this kind, if it was moments ago and nothing else came between
      const last = [...out].reverse().find((e) => e.change.kind === change.kind)
      const between = last ? out.slice(out.indexOf(last) + 1).some((e) => e.by !== step.by) : true
      const merged = last && !between && last.by === step.by && Math.abs(Date.parse(step.at) - Date.parse(last.at)) < together(change.kind) ? combine(last.change, change) : undefined
      if (merged === undefined) out.push({ at: step.at, by: step.by, change })
      else if (merged === null) out.splice(out.indexOf(last!), 1)
      else Object.assign(last!, { at: step.at, change: merged })
    }
  }
  return out
}
