/**
 * Issues as cards in columns, one column per group. Cards can be dragged within and between columns. Empty
 * columns wait under "Hidden columns" at the end; drop a card on one to move it there.
 */
import { useState, type CSSProperties, type HTMLAttributes, type Ref } from 'react'
import { Link } from 'wouter'
import { ChevronDown, Plus } from 'lucide-react'
import { DndContext, DragOverlay, useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { PersonAvatar } from '@/components/Avatar'
import { LabelChip } from '@/components/LabelChip'
import type { Group } from '@/data/select'
import { issueRef, useData } from '@/data/store'
import type { Display, Issue } from '@/model/schema'
import { cn } from '@/lib/utils'
import { PriorityIcon, StatusIcon } from './icons'
import { GroupIcon } from './GroupIcon'
import { SubIssueCount } from './SubIssueCount'
import { TitleText } from './TitleText'
import { dragAnnouncements } from './dragText'
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
  return (
    <Link
      ref={dragRef}
      {...dragProps}
      href={`/issue/${issueRef(issue)}`}
      style={style}
      className={cn(
        'flex flex-col gap-2 rounded-lg border bg-card p-3 text-[15px] shadow-xs hover:border-ring/60 focus-visible:border-ring focus-visible:outline-none',
        ghost && 'opacity-30',
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

function Column({ group, ids, issueOf, onAdd }: { group: Group; ids: string[]; issueOf: (id: string) => Issue | undefined; onAdd?: (group: Group) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: groupDropId(group.key) })
  return (
    <section ref={setNodeRef} className={cn('flex w-[21rem] shrink-0 flex-col rounded-xl bg-accent/30 transition-colors', isOver && 'bg-accent/50')}>
      <header className="flex h-12 items-center gap-2.5 px-4 text-[15px] font-medium">
        <GroupIcon group={group} />
        {group.title}
        <span className="font-normal text-muted-foreground tabular-nums">{ids.length}</span>
        {onAdd && (
          <button type="button" onClick={() => onAdd(group)} className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={`New issue in ${group.title}`}>
            <Plus className="size-4" />
          </button>
        )}
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

function HiddenColumn({ group, onAdd }: { group: Group; onAdd?: (group: Group) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: groupDropId(group.key) })
  return (
    <div
      ref={setNodeRef}
      className={cn('group flex h-12 items-center gap-2.5 rounded-lg border bg-card/60 px-4 text-[15px] transition-colors', isOver && 'border-ring bg-accent')}
    >
      <GroupIcon group={group} />
      <span className="truncate">{group.title}</span>
      {onAdd && (
        <button
          type="button"
          onClick={() => onAdd(group)}
          className="ml-auto rounded-md p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100"
          aria-label={`New issue in ${group.title}`}
        >
          <Plus className="size-4" />
        </button>
      )}
      <span className={cn('text-muted-foreground tabular-nums', !onAdd && 'ml-auto')}>0</span>
    </div>
  )
}

function HiddenColumns({ groups, onAdd }: { groups: Group[]; onAdd?: (group: Group) => void }) {
  const [open, setOpen] = useState(true)
  return (
    <section className="flex w-72 shrink-0 flex-col gap-2" aria-label="Hidden columns">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex h-12 items-center gap-2 px-2 text-[15px] text-muted-foreground hover:text-foreground" aria-expanded={open}>
        <ChevronDown className={cn('size-4 transition-transform', !open && '-rotate-90')} />
        Hidden columns
        {!open && <span className="tabular-nums">{groups.length}</span>}
      </button>
      {open && groups.map((g) => <HiddenColumn key={g.key} group={g} onAdd={onAdd} />)}
    </section>
  )
}

export function IssueBoard({ groups, display, onAdd }: { groups: Group[]; display: Display; onAdd?: (group: Group) => void }) {
  const drag = useIssueDrag(groups, display, { park: true })
  const active = drag.activeId ? drag.issue(drag.activeId) : undefined
  const issues = useData((s) => s.issues)
  return (
    <DndContext {...drag.dnd} autoScroll={AUTO_SCROLL} accessibility={{ announcements: dragAnnouncements(issues, groups, drag.order) }}>
      <div className="flex h-full gap-4 overflow-x-auto pb-4" onClickCapture={(e) => drag.justDropped() && e.preventDefault()}>
        {groups
          .filter((g) => !drag.parked.has(g.key))
          .map((g) => (
            <Column key={g.key} group={g} ids={drag.order[g.key] ?? []} issueOf={drag.issue} onAdd={onAdd} />
          ))}
        {drag.parked.size > 0 && <HiddenColumns groups={groups.filter((g) => drag.parked.has(g.key))} onAdd={onAdd} />}
      </div>
      <DragOverlay>{active && <IssueCard issue={active} lifted />}</DragOverlay>
    </DndContext>
  )
}
