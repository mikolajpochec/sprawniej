/**
 * Pure helpers that turn the store into what a list or board shows: filter, sort, group. No React, no store
 * access, so they are easy to test (tests/select.test.ts).
 */
import type { Display, Filters, Issue, Ordering, Person, Project } from '@/model/schema'
import { PRIORITY_NAMES, PRIORITY_ORDER, STATUSES, TAB_GROUPS, statusOf, type IssueTab, type Priority } from '@/model/status'

export function matches(issue: Issue, f: Filters): boolean {
  if (f.teams?.length && !f.teams.includes(issue.team)) return false
  if (f.statuses?.length && !f.statuses.includes(issue.status)) return false
  if (f.assignees?.length && !f.assignees.includes(issue.assignee)) return false
  if (f.priorities?.length && !f.priorities.includes(issue.priority)) return false
  if (f.labels?.length && !issue.labels.some((l) => f.labels!.includes(l))) return false
  if (f.projects?.length && !f.projects.includes(issue.project)) return false
  return true
}

export function inTab(issue: Issue, tab: IssueTab): boolean {
  return TAB_GROUPS[tab].includes(statusOf(issue.status).group)
}

/** "completed" and "canceled" issues are hidden unless the display asks for them */
export const isClosed = (issue: Issue) => {
  const g = statusOf(issue.status).group
  return g === 'completed' || g === 'canceled'
}

const PRIORITY_RANK = new Map(PRIORITY_ORDER.map((p, i) => [p, i]))

export function compareIssues(ordering: Ordering): (a: Issue, b: Issue) => number {
  switch (ordering) {
    case 'priority':
      return (a, b) => PRIORITY_RANK.get(a.priority)! - PRIORITY_RANK.get(b.priority)! || byOrder(a, b)
    case 'updated':
      return (a, b) => b.updatedAt.localeCompare(a.updatedAt)
    case 'created':
      return (a, b) => b.createdAt.localeCompare(a.createdAt)
    case 'manual':
      return byOrder
  }
}

/** sortOrder keys compare as plain strings (not localeCompare: fractional-indexing relies on byte order) */
function byOrder(a: Issue, b: Issue): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder < b.sortOrder ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export interface Group {
  /** what an issue dropped into this group gets: a status id, a login, a priority, a project id, or null */
  key: string
  value: string | number | null
  title: string
  issues: Issue[]
}

interface GroupCtx {
  people: Record<string, Person>
  projects: Record<string, Project>
}

/**
 * Split issues into groups in display order. Grouping by status always shows every status the tab covers,
 * even empty ones, so there is somewhere to drop an issue.
 */
export function groupIssues(issues: Issue[], display: Display, ctx: GroupCtx, tab: IssueTab = 'all'): Group[] {
  const sorted = issues.filter((i) => display.showCompleted || !isClosed(i)).sort(compareIssues(display.ordering))
  switch (display.grouping) {
    case 'none':
      return [{ key: 'all', value: null, title: 'All issues', issues: sorted }]
    case 'status': {
      const groups = TAB_GROUPS[tab]
      return STATUSES.filter((s) => groups.includes(s.group))
        .filter((s) => display.showCompleted || (s.group !== 'completed' && s.group !== 'canceled'))
        .map((s) => ({ key: s.id, value: s.id, title: s.name, issues: sorted.filter((i) => i.status === s.id) }))
    }
    case 'priority':
      return PRIORITY_ORDER.map((p: Priority) => ({
        key: `p${p}`,
        value: p,
        title: PRIORITY_NAMES[p],
        issues: sorted.filter((i) => i.priority === p),
      }))
    case 'assignee': {
      const logins = [...new Set(sorted.map((i) => i.assignee).filter((l): l is string => !!l))].sort((a, b) =>
        (ctx.people[a]?.name ?? a).localeCompare(ctx.people[b]?.name ?? b),
      )
      const out: Group[] = logins.map((l) => ({ key: l, value: l, title: ctx.people[l]?.name ?? l, issues: sorted.filter((i) => i.assignee === l) }))
      out.push({ key: 'nobody', value: null, title: 'No assignee', issues: sorted.filter((i) => !i.assignee) })
      return out
    }
    case 'project': {
      const ids = [...new Set(sorted.map((i) => i.project).filter((p): p is string => !!p))]
      const out: Group[] = ids.map((id) => ({ key: id, value: id, title: ctx.projects[id]?.name ?? 'Unknown project', issues: sorted.filter((i) => i.project === id) }))
      out.push({ key: 'none', value: null, title: 'No project', issues: sorted.filter((i) => !i.project) })
      return out
    }
  }
}

/**
 * Put each sub-issue right under its parent when both are in the same group, like Linear's list.
 * Sub-issues whose parent is elsewhere stay where they are, at depth 0.
 */
export function nestChildren(issues: Issue[]): { issue: Issue; depth: number }[] {
  const here = new Set(issues.map((i) => i.id))
  const kids = new Map<string, Issue[]>()
  for (const i of issues) if (i.parent && here.has(i.parent)) kids.set(i.parent, [...(kids.get(i.parent) ?? []), i])
  const out: { issue: Issue; depth: number }[] = []
  const seen = new Set<string>()
  const visit = (i: Issue, depth: number) => {
    if (seen.has(i.id)) return // a parent loop in hand-edited files must not hang the app
    seen.add(i.id)
    out.push({ issue: i, depth })
    for (const k of kids.get(i.id) ?? []) visit(k, depth + 1)
  }
  for (const i of issues) if (!(i.parent && here.has(i.parent))) visit(i, 0)
  for (const i of issues) if (!seen.has(i.id)) visit(i, 0) // only reachable through a loop
  return out
}

/** sub-issue counter for a row: how many children are done, out of how many */
export function childProgress(parentId: string, issues: Issue[]): { done: number; total: number } {
  const kids = issues.filter((i) => i.parent === parentId)
  return { done: kids.filter((k) => statusOf(k.status).group === 'completed').length, total: kids.length }
}

/** share of a project's issues that are done, 0..1 (canceled ones don't count either way) */
export function projectProgress(projectId: string, issues: Issue[]): { done: number; total: number } {
  const mine = issues.filter((i) => i.project === projectId && statusOf(i.status).group !== 'canceled')
  return { done: mine.filter((i) => statusOf(i.status).group === 'completed').length, total: mine.length }
}
