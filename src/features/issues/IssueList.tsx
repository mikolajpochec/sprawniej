/** Issues as rows, grouped (by status unless the display says otherwise), like Linear's list. */
import { useMemo, useState } from 'react'
import { Link } from 'wouter'
import { ChevronDown, Plus } from 'lucide-react'
import { PersonAvatar } from '@/components/Avatar'
import { LabelChip } from '@/components/LabelChip'
import { childProgress, nestChildren, type Group } from '@/data/select'
import { issueRef, useData } from '@/data/store'
import type { Issue } from '@/model/schema'
import { cn } from '@/lib/utils'
import { PriorityIcon, StatusIcon } from './icons'
import { GroupIcon } from './GroupIcon'
import { shortDate } from './format'
import { TitleText } from './TitleText'

export function IssueRow({ issue, depth = 0, all }: { issue: Issue; depth?: number; all: Issue[] }) {
  const assignee = useData((s) => (issue.assignee ? s.people[issue.assignee] : undefined))
  const labels = useData((s) => s.labels)
  const kids = childProgress(issue.id, all)
  const closed = issue.status === 'done' || issue.status === 'canceled' || issue.status === 'duplicate'
  return (
    <Link
      href={`/issue/${issueRef(issue)}`}
      className="group flex h-11 items-center gap-3 rounded-md px-4 text-[15px] hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none"
      style={{ paddingLeft: `${1 + depth * 2}rem` }}
    >
      <PriorityIcon priority={issue.priority} />
      <span className="w-16 shrink-0 text-muted-foreground tabular-nums">{issueRef(issue)}</span>
      <StatusIcon status={issue.status} />
      <span className={cn('min-w-0 truncate', closed && 'text-muted-foreground')}>
        <TitleText title={issue.title} />
      </span>
      {kids.total > 0 && (
        <span className="shrink-0 rounded-full border px-2 text-xs leading-5 text-muted-foreground tabular-nums">
          {kids.done}/{kids.total}
        </span>
      )}
      <span className="ml-auto flex shrink-0 items-center gap-2">
        {issue.labels.map((id) => labels[id] && <LabelChip key={id} label={labels[id]} />)}
        <PersonAvatar person={assignee} login={issue.assignee} />
        <span className="w-14 text-right text-sm text-muted-foreground">{shortDate(issue.createdAt)}</span>
      </span>
    </Link>
  )
}

function GroupSection({ group, all, onAdd }: { group: Group; all: Issue[]; onAdd?: (group: Group) => void }) {
  const [open, setOpen] = useState(true)
  const rows = useMemo(() => nestChildren(group.issues), [group.issues])
  return (
    <section>
      <div className="sticky top-0 z-10 flex h-11 items-center gap-3 rounded-lg bg-accent/70 px-4 backdrop-blur">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-3 text-[15px] font-medium" aria-expanded={open}>
          <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', !open && '-rotate-90')} />
          <GroupIcon group={group} />
          {group.title}
          <span className="font-normal text-muted-foreground tabular-nums">{group.issues.length}</span>
        </button>
        {onAdd && (
          <button type="button" onClick={() => onAdd(group)} className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={`New issue in ${group.title}`}>
            <Plus className="size-4" />
          </button>
        )}
      </div>
      {open && (
        <div className="py-1">
          {rows.map(({ issue, depth }) => (
            <IssueRow key={issue.id} issue={issue} depth={depth} all={all} />
          ))}
        </div>
      )}
    </section>
  )
}

export function IssueList({ groups, all, onAdd }: { groups: Group[]; all: Issue[]; onAdd?: (group: Group) => void }) {
  return (
    <div className="flex flex-col gap-1">
      {groups
        .filter((g) => g.issues.length > 0)
        .map((g) => (
          <GroupSection key={g.key} group={g} all={all} onAdd={onAdd} />
        ))}
    </div>
  )
}
