/**
 * A set of issues with a toolbar: optional tabs on the left; Filter, Display and List / Board on the right; the
 * active filters below. The page decides the fixed part (`filters`, e.g. this team). What a person filters on top
 * stays on this page until they leave, or, on a saved view, is saved into the view.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Columns3, Layers, List, SearchX, SquareStack } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { Segmented } from '@/components/Segmented'
import { useDisplay } from '@/data/displays'
import { groupIssues, inTab, matches } from '@/data/select'
import { useData } from '@/data/store'
import type { Display, Filters } from '@/model/schema'
import type { IssueTab } from '@/model/status'
import { Button } from '@/ui/button'
import { NewViewDialog } from '@/features/views/NewViewDialog'
import { DisplayOptions } from './DisplayOptions'
import { FilterButton, FilterChips } from './FilterBar'
import { activeFilters, type FilterKey } from './filters'
import { IssueBoard } from './IssueBoard'
import { IssueList } from './IssueList'
import { openComposer } from './composer'
import type { Group } from '@/data/select'
import type { NewIssue } from '@/data/actions'

interface Props {
  /** key for remembering List/Board and other display choices */
  page: string
  /** what the page always shows (this team, this project) */
  filters: Filters
  tab?: IssueTab
  baseDisplay?: Partial<Display>
  left?: ReactNode
  /** above the toolbar (a view's or project's name and details) */
  header?: ReactNode
  empty?: ReactNode
  /** filter kinds the page decides already */
  hideFilters?: FilterKey[]
  /** a saved view: its filters and display live in the view, for everyone */
  saved?: { filters: Filters; display: Display; onFilters: (f: Filters) => void; onDisplay: (patch: Partial<Display>) => void }
  /** where "Save as view" puts a new view (null = the whole workspace); leave out to not offer it */
  viewScope?: string | null
}

export function IssuesView({ page, filters, tab = 'all', baseDisplay, left, header, empty, hideFilters, saved, viewScope }: Props) {
  const mine = useDisplay(page, baseDisplay)
  const display = saved?.display ?? mine.display
  const setDisplay = saved?.onDisplay ?? mine.setDisplay
  const [ownFilters, setOwnFilters] = useState<Filters>({})
  const extra = saved?.filters ?? ownFilters
  const setExtra = saved?.onFilters ?? setOwnFilters
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null)
  const [saving, setSaving] = useState(false)

  const all = useData(useShallow((s) => Object.values(s.issues)))
  const people = useData((s) => s.people)
  const projects = useData((s) => s.projects)
  const shown = useMemo(() => all.filter((i) => matches(i, filters) && matches(i, extra) && inTab(i, tab)), [all, filters, extra, tab])
  const groups = useMemo(() => groupIssues(shown, display, { people, projects }, tab), [shown, display, people, projects, tab])
  const filtering = activeFilters(extra) > 0

  /** "+" on a group: a new issue that already belongs in that group (and on this page) */
  const addTo = (g: Group) => {
    const preset: Partial<NewIssue> = {}
    const both = { ...extra, ...filters }
    if (both.teams?.length === 1) preset.team = both.teams[0]
    if (both.projects?.length === 1 && both.projects[0]) preset.project = both.projects[0]
    if (both.labels?.length) preset.labels = both.labels
    if (both.assignees?.length === 1) preset.assignee = both.assignees[0]
    if (display.grouping === 'status' && typeof g.value === 'string') preset.status = g.value as NewIssue['status']
    if (display.grouping === 'priority' && typeof g.value === 'number') preset.priority = g.value as NewIssue['priority']
    if (display.grouping === 'assignee') preset.assignee = g.value as string | null
    if (display.grouping === 'project') preset.project = g.value as string | null
    openComposer(preset)
  }

  const saveAsView =
    viewScope !== undefined && !saved && filtering ? (
      <Button variant="outline" size="sm" onClick={() => setSaving(true)}>
        <Layers /> Save as view
      </Button>
    ) : undefined

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 md:px-8 pt-6">
      {header}
      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        {left}
        <div className="ml-auto flex items-center gap-2">
          <FilterButton hide={hideFilters} onPick={setOpenFilter} />
          <DisplayOptions display={display} onChange={setDisplay} onReset={saved ? undefined : mine.resetDisplay} tab={tab} />
          <Segmented
            label="Layout"
            value={display.layout}
            onChange={(layout) => setDisplay({ layout })}
            options={[
              { value: 'list', name: 'List', label: <><List /> <span className="hidden sm:inline">List</span></> },
              { value: 'board', name: 'Board', label: <><Columns3 /> <span className="hidden sm:inline">Board</span></> },
            ]}
          />
        </div>
      </div>
      <FilterChips filters={extra} onChange={setExtra} hide={hideFilters} open={openFilter} setOpen={setOpenFilter} extra={saveAsView} />
      {shown.length === 0 ? (
        filtering ? (
          <EmptyState
            icon={<SearchX />}
            title="No issues match these filters"
            action={
              <Button variant="outline" onClick={() => setExtra({})}>
                Clear filters
              </Button>
            }
          />
        ) : (
          (empty ?? (
            <EmptyState icon={<SquareStack />} title="Nothing here">
              No issues match this page right now.
            </EmptyState>
          ))
        )
      ) : display.layout === 'list' ? (
        <div className="min-h-0 flex-1 overflow-y-auto pb-8">
          <IssueList groups={groups} display={display} onAdd={addTo} />
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <IssueBoard groups={groups} display={display} onAdd={addTo} />
        </div>
      )}
      {saving && (
        <NewViewDialog
          open
          onOpenChange={(o) => !o && setSaving(false)}
          preset={{ team: viewScope ?? null, filters: { ...filters, teams: undefined, ...extra }, display }}
          onCreated={() => setOwnFilters({})}
        />
      )}
    </div>
  )
}
