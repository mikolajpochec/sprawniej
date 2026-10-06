/**
 * Issues as cards in columns, one column per group. Cards can be dragged within and between columns. Columns you
 * hid, empty ones, and statuses this page leaves out (Done on the Active tab) wait under "Hidden columns" at the
 * end; drop a card on one to move it there.
 */
import { useState, type CSSProperties, type HTMLAttributes, type Ref } from 'react'
import { Link } from 'wouter'
import { ChevronDown, Eye, EyeOff, Plus } from 'lucide-react'
import { DndContext, DragOverlay, useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { PersonAvatar } from '@/components/Avatar'
import { LabelChip } from '@/components/LabelChip'
import { isClosed, type Group } from '@/data/select'
import { issueRef, useData } from '@/data/store'
import type { Display, Issue } from '@/model/schema'
import { cn } from '@/lib/utils'
import { DueChip, EstimateChip } from './DueDate'
import { PriorityIcon, StatusIcon } from './icons'
import { GroupIcon } from './GroupIcon'
import { SubIssueCount } from './SubIssueCount'
import { TitleText } from './TitleText'
import { dragAnnouncements } from './dragText'
import { CarryCount } from './CarryCount'
import { selectionClick, useSelection } from './selection'
import { AUTO_SCROLL, groupDropId, useIssueDrag } from './useIssueDrag'

interface CardProps {
  issue: Issue
  dragRef?: Ref<HTMLAnchorElement>
  dragProps?: HTMLAttributes<HTMLElement>
  style?: CSSProperties
  ghost?: boolean
  lifted?: boolean
}

function IssueCard({ issue, dragRef, dragProps, style, ghost, lifted }: CardProps) {
  const assignee = useData((s) => (issue.assignee ? s.people[issue.assignee] : undefined))
  const labels = useData((s) => s.labels)
  const picked = useSelection((s) => s.ids.includes(issue.id))
  const carried = useSelection((s) => s.draggingMany) && picked && !lifted
  return (
    <Link
      ref={dragRef}
      {...dragProps}
      href={`/issue/${issueRef(issue)}`}
      data-issue-id={lifted ? undefined : issue.id}
      data-picked={picked || undefined}
      aria-selected={picked || undefined}
      // capture: the link itself leaves ⌘/Shift-clicks to the browser (new tab), before an onClick would run
      onClickCapture={(e) => selectionClick(e, issue.id)}
      style={style}
      className={cn(
        'flex flex-col gap-2 rounded-lg border bg-card p-3 text-[15px] shadow-xs hover:border-ring/60 focus-visible:border-ring focus-visible:outline-none touch-manipulation select-none [-webkit-touch-callout:none]',
        (ghost || carried) && 'opacity-30',
        picked && !lifted && 'bg-accent ring-1 ring-inset ring-ring/50',
        lifted && 'cursor-grabbing rotate-1 shadow-lg',
      )}
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="tabular-nums">{issueRef(issue)}</span>
        <span className="ml-auto">
          <PersonAvatar person={assignee} login={issue.assignee} />
        </span>
      </div>
      <div className="flex items-start gap-2">
        <StatusIcon status={issue.status} className="mt-1" />
        <span className="line-clamp-3">
          <TitleText title={issue.title} />
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-6 items-center rounded-md border px-1.5">
          <PriorityIcon priority={issue.priority} />
        </span>
        {issue.dueDate && <DueChip day={issue.dueDate} closed={isClosed(issue)} />}
        {issue.estimate != null && <EstimateChip points={issue.estimate} />}
        <SubIssueCount id={issue.id} />
        {issue.labels.map((id) => labels[id] && <LabelChip key={id} label={labels[id]} />)}
      </div>
    </Link>
  )
}

function SortableCard({ issue }: { issue: Issue }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: issue.id })
  return (
    <IssueCard
      issue={issue}
      dragRef={setNodeRef}
      dragProps={{ ...attributes, role: undefined, ...listeners }}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      ghost={isDragging}
    />
  )
}

const iconButton = 'rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground'

function Column({ group, ids, issueOf, onAdd, onHide }: { group: Group; ids: string[]; issueOf: (id: string) => Issue | undefined; onAdd?: (group: Group) => void; onHide?: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: groupDropId(group.key) })
  return (
    <section ref={setNodeRef} className={cn('group/column flex w-[21rem] shrink-0 flex-col rounded-xl bg-accent/30 transition-colors', isOver && 'bg-accent/50')}>
      <header className="flex h-12 items-center gap-2.5 px-4 text-[15px] font-medium">
        <GroupIcon group={group} />
        {group.title}
        <span className="font-normal text-muted-foreground tabular-nums">{ids.length}</span>
        <span className="ml-auto flex items-center gap-0.5">
          {onHide && (
            <button
              type="button"
              onClick={onHide}
              className={cn(iconButton, 'opacity-0 group-hover/column:opacity-100 focus-visible:opacity-100')}
              aria-label={`Hide the ${group.title} column`}
              title="Hide column"
            >
              <EyeOff className="size-4" />
            </button>
          )}
          {onAdd && (
            <button type="button" onClick={() => onAdd(group)} className={iconButton} aria-label={`New issue in ${group.title}`}>
              <Plus className="size-4" />
            </button>
          )}
        </span>
      </header>
      <SortableContext id={group.key} items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
          {ids.map((id) => {
            const issue = issueOf(id)
            return issue && <SortableCard key={id} issue={issue} />
          })}
        </div>
      </SortableContext>
    </section>
  )
}

/** a parked group: somewhere to drop a card. Columns you hid can be shown again from here. */
function HiddenColumn({ group, hidden, onAdd, onShow }: { group: Group; hidden: boolean; onAdd?: (group: Group) => void; onShow?: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: groupDropId(group.key) })
  return (
    <div
      ref={setNodeRef}
      className={cn('group flex h-12 items-center gap-2.5 rounded-lg border bg-card/60 px-4 text-[15px] transition-colors', isOver && 'border-ring bg-accent')}
    >
      <GroupIcon group={group} />
      <span className="truncate">{group.title}</span>
      <span className="ml-auto flex items-center gap-0.5">
        {hidden && onShow && (
          <button type="button" onClick={onShow} className={cn(iconButton, 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100')} aria-label={`Show the ${group.title} column`} title="Show column">
            <Eye className="size-4" />
          </button>
        )}
        {onAdd && !group.outside && (
          <button type="button" onClick={() => onAdd(group)} className={cn(iconButton, 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100')} aria-label={`New issue in ${group.title}`}>
            <Plus className="size-4" />
          </button>
        )}
      </span>
      {/* a status this page leaves out has issues elsewhere, not here: no count */}
      {!group.outside && <span className="w-5 text-right text-muted-foreground tabular-nums">{group.issues.length}</span>}
    </div>
  )
}

function HiddenColumns({ groups, hidden, onAdd, onHide }: { groups: Group[]; hidden: string[]; onAdd?: (group: Group) => void; onHide?: (key: string, hide: boolean) => void }) {
  const [open, setOpen] = useState(true)
  return (
    <section className="flex w-72 shrink-0 flex-col gap-2 overflow-y-auto pb-2" aria-label="Hidden columns">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex h-12 shrink-0 items-center gap-2 px-2 text-[15px] text-muted-foreground hover:text-foreground" aria-expanded={open}>
        <ChevronDown className={cn('size-4 transition-transform', !open && '-rotate-90')} />
        Hidden columns
        {!open && <span className="tabular-nums">{groups.length}</span>}
      </button>
      {open &&
        groups.map((g) => (
          <HiddenColumn key={g.key} group={g} hidden={hidden.includes(g.key)} onAdd={onAdd} onShow={onHide && (() => onHide(g.key, false))} />
        ))}
    </section>
  )
}

export function IssueBoard({ groups, display, onAdd, onHide }: { groups: Group[]; display: Display; onAdd?: (group: Group) => void; onHide?: (key: string, hide: boolean) => void }) {
  const drag = useIssueDrag(groups, display, { park: true })
  const active = drag.activeId ? drag.issue(drag.activeId) : undefined
  const issues = useData((s) => s.issues)
  const hidden = display.hiddenColumns ?? []
  // columns you hid first, then empty ones, then what this page leaves out
  const parked = groups.filter((g) => drag.parked.has(g.key))
  const rank = (g: Group) => (hidden.includes(g.key) ? 0 : g.outside ? 2 : 1)
  parked.sort((a, b) => rank(a) - rank(b))
  return (
    <DndContext {...drag.dnd} autoScroll={AUTO_SCROLL} accessibility={{ announcements: dragAnnouncements(issues, groups, drag.order) }}>
      <div className="flex h-full gap-4 overflow-x-auto pb-4" onClickCapture={(e) => drag.justDropped() && e.preventDefault()}>
        {groups
          .filter((g) => !drag.parked.has(g.key))
          .map((g) => (
            <Column key={g.key} group={g} ids={drag.order[g.key] ?? []} issueOf={drag.issue} onAdd={onAdd} onHide={onHide && (() => onHide(g.key, true))} />
          ))}
        {parked.length > 0 && <HiddenColumns groups={parked} hidden={hidden} onAdd={onAdd} onHide={onHide} />}
      </div>
      <DragOverlay>
        {active && (
          <div className="relative">
            <IssueCard issue={active} lifted />
            <CarryCount />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
