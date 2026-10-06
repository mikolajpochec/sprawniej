import type { Project } from '@/model/schema'

export const PROJECT_STATUS_NAMES: Record<Project['status'], string> = {
  backlog: 'Backlog',
  planned: 'Planned',
  in_progress: 'In progress',
  paused: 'Paused',
  completed: 'Completed',
  canceled: 'Canceled',
}

/** a dot of the matching issue status colour */
export const PROJECT_STATUS_COLORS: Record<Project['status'], string> = {
  backlog: 'var(--status-backlog)',
  planned: 'var(--status-todo)',
  in_progress: 'var(--status-progress)',
  paused: 'var(--status-canceled)',
  completed: 'var(--status-done)',
  canceled: 'var(--status-canceled)',
}
