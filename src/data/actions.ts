/**
 * The ONLY place that changes workspace data. Every action:
 *   1. updates the store (the screen changes at once),
 *   2. writes the changed file to the local repo (survives a crash),
 *   3. queues a save, which commits and pushes a moment later.
 * Steps 2 and 3 arrive with sign-in and syncing (milestone 1); for now actions change the store only.
 */
import { generateKeyBetween } from 'fractional-indexing'
import { ulid } from 'ulid'
import type { Issue } from '@/model/schema'
import { statusOf } from '@/model/status'
import { useData } from './store'

const now = () => new Date().toISOString()

/** fields a person can change (Pick, not Omit: Omit drops named keys on passthrough schemas) */
export type IssuePatch = Partial<
  Pick<Issue, 'title' | 'description' | 'status' | 'priority' | 'assignee' | 'labels' | 'project' | 'parent' | 'sortOrder' | 'duplicateOf'>
>

export function updateIssue(id: string, patch: IssuePatch): void {
  useData.setState((s) => {
    const old = s.issues[id]
    if (!old) return s
    const next: Issue = { ...old, ...patch, updatedAt: now() }
    if (patch.status && patch.status !== old.status) {
      next.completedAt = statusOf(patch.status).group === 'completed' ? now() : null
    }
    return { issues: { ...s.issues, [id]: next } }
  })
}

export interface NewIssue {
  team: string
  title: string
  description?: string
  status?: Issue['status']
  priority?: Issue['priority']
  assignee?: string | null
  labels?: string[]
  project?: string | null
  parent?: string | null
}

/** Creates an issue at the top of its status and returns it. */
export function createIssue(input: NewIssue): Issue {
  const s = useData.getState()
  const me = s.me?.login ?? 'unknown'
  const inTeam = Object.values(s.issues).filter((i) => i.team === input.team)
  const number = inTeam.reduce((max, i) => Math.max(max, i.number), 0) + 1
  const first = inTeam.reduce<string | null>((min, i) => (min === null || i.sortOrder < min ? i.sortOrder : min), null)
  const issue: Issue = {
    id: ulid(),
    team: input.team,
    number,
    title: input.title.trim(),
    description: input.description ?? '',
    status: input.status ?? 'todo',
    priority: input.priority ?? 0,
    assignee: input.assignee ?? null,
    labels: input.labels ?? [],
    project: input.project ?? null,
    parent: input.parent ?? null,
    sortOrder: generateKeyBetween(null, first),
    createdBy: me,
    createdAt: now(),
    updatedAt: now(),
    completedAt: null,
  }
  useData.setState((st) => ({ issues: { ...st.issues, [issue.id]: issue } }))
  return issue
}
