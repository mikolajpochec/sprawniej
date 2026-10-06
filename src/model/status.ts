/**
 * Issue statuses and priorities. Fixed on purpose: they match Linear's defaults, so people coming from Linear
 * feel at home and imports map one to one. Each status belongs to one of Linear's groups; the groups decide
 * which issues the Active, Backlog and All tabs show.
 */

export type StatusGroup = 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled'

export const STATUS_IDS = ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'canceled', 'duplicate'] as const
export type StatusId = (typeof STATUS_IDS)[number]

export interface Status {
  id: StatusId
  name: string
  group: StatusGroup
  /** CSS colour (a theme variable) */
  color: string
}

export const STATUSES: Status[] = [
  { id: 'backlog', name: 'Backlog', group: 'backlog', color: 'var(--status-backlog)' },
  { id: 'todo', name: 'Todo', group: 'unstarted', color: 'var(--status-todo)' },
  { id: 'in_progress', name: 'In Progress', group: 'started', color: 'var(--status-progress)' },
  { id: 'in_review', name: 'In Review', group: 'started', color: 'var(--status-review)' },
  { id: 'done', name: 'Done', group: 'completed', color: 'var(--status-done)' },
  { id: 'canceled', name: 'Canceled', group: 'canceled', color: 'var(--status-canceled)' },
  { id: 'duplicate', name: 'Duplicate', group: 'canceled', color: 'var(--status-canceled)' },
]

const byId = new Map(STATUSES.map((s) => [s.id, s]))
export const statusOf = (id: StatusId): Status => byId.get(id)!

/** The tabs on a team's Issues page. */
export type IssueTab = 'active' | 'backlog' | 'all'

export const TAB_GROUPS: Record<IssueTab, StatusGroup[]> = {
  active: ['unstarted', 'started'],
  backlog: ['backlog'],
  all: ['backlog', 'unstarted', 'started', 'completed', 'canceled'],
}

/** Linear's numbers: 0 = no priority, 1 = urgent … 4 = low. */
export const PRIORITY_IDS = [0, 1, 2, 3, 4] as const
export type Priority = (typeof PRIORITY_IDS)[number]

export const PRIORITY_NAMES: Record<Priority, string> = {
  0: 'No priority',
  1: 'Urgent',
  2: 'High',
  3: 'Medium',
  4: 'Low',
}

/** Display order for grouping by priority: urgent first, "no priority" last. */
export const PRIORITY_ORDER: Priority[] = [1, 2, 3, 4, 0]
