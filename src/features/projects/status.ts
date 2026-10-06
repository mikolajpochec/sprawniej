import type { Project } from '@/model/schema'

export const PROJECT_STATUS_NAMES: Record<Project['status'], string> = {
  backlog: 'Backlog',
  planned: 'Planned',
  in_progress: 'In progress',
  paused: 'Paused',
  completed: 'Completed',
  canceled: 'Canceled',
}
