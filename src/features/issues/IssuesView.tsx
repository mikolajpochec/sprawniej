/** A filtered set of issues with a toolbar: optional tabs on the left, List / Board on the right. */
import { useMemo, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Columns3, List, SquareStack } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { Segmented } from '@/components/Segmented'
import { useDisplay } from '@/data/displays'
import { groupIssues, inTab, matches } from '@/data/select'
import { useData } from '@/data/store'
import type { Display, Filters } from '@/model/schema'
import type { IssueTab } from '@/model/status'
import { IssueBoard } from './IssueBoard'
import { IssueList } from './IssueList'
import { openComposer } from './composer'
import type { Group } from '@/data/select'
import type { NewIssue } from '@/data/actions'

interface Props {
  /** key for remembering List/Board and other display choices */
  page: string
  filters: Filters
  tab?: IssueTab
  baseDisplay?: Partial<Display>
  left?: ReactNode
  empty?: ReactNode
}

export function IssuesView({ page, filters, tab = 'all', baseDisplay, left, empty }: Props) {
  const [display, setDisplay] = useDisplay(page, baseDisplay)
  const all = useData(useShallow((s) => Object.values(s.issues)))
  const people = useData((s) => s.people)
  const projects = useData((s) => s.projects)
  const shown = useMemo(() => all.filter((i) => matches(i, filters) && inTab(i, tab)), [all, filters, tab])
  const groups = useMemo(() => groupIssues(shown, display, { people, projects }, tab), [shown, display, people, projects, tab])

  /** "+" on a group: a new issue that already belongs in that group (and on this page) */
  const addTo = (g: Group) => {
    const preset: Partial<NewIssue> = {}
    if (filters.teams?.length === 1) preset.team = filters.teams[0]
    if (filters.projects?.length === 1 && filters.projects[0]) preset.project = filters.projects[0]
    if (filters.labels?.length) preset.labels = filters.labels
    if (display.grouping === 'status' && typeof g.value === 'string') preset.status = g.value as NewIssue['status']
    if (display.grouping === 'priority' && typeof g.value === 'number') preset.priority = g.value as NewIssue['priority']
    if (display.grouping === 'assignee') preset.assignee = g.value as string | null
    if (display.grouping === 'project') preset.project = g.value as string | null
    openComposer(preset)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 px-8 pt-6">
      <div className="flex items-center gap-3">
        {left}
        <div className="ml-auto">
          <Segmented
            label="Layout"
            value={display.layout}
            onChange={(layout) => setDisplay({ layout })}
            options={[
              { value: 'list', label: <><List /> List</> },
              { value: 'board', label: <><Columns3 /> Board</> },
            ]}
          />
        </div>
      </div>
      {shown.length === 0 ? (
        (empty ?? (
          <EmptyState icon={<SquareStack />} title="Nothing here">
            No issues match this page right now.
          </EmptyState>
        ))
      ) : display.layout === 'list' ? (
        <div className="min-h-0 flex-1 overflow-y-auto pb-8">
          <IssueList groups={groups} onAdd={addTo} />
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <IssueBoard groups={groups} onAdd={addTo} />
        </div>
      )}
    </div>
  )
}
