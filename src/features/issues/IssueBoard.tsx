/** Issues as cards in columns, one column per group, like Linear's board. */
import { Link } from 'wouter'
import { Plus } from 'lucide-react'
import { PersonAvatar } from '@/components/Avatar'
import { LabelChip } from '@/components/LabelChip'
import { childProgress, type Group } from '@/data/select'
import { issueRef, useData } from '@/data/store'
import type { Issue } from '@/model/schema'
import { PriorityIcon, StatusIcon } from './icons'
import { GroupIcon } from './GroupIcon'
import { TitleText } from './TitleText'

function IssueCard({ issue, all }: { issue: Issue; all: Issue[] }) {
  const assignee = useData((s) => (issue.assignee ? s.people[issue.assignee] : undefined))
  const labels = useData((s) => s.labels)
  const kids = childProgress(issue.id, all)
  return (
    <Link
      href={`/issue/${issueRef(issue)}`}
      className="flex flex-col gap-2 rounded-lg border bg-card p-3 text-[15px] shadow-xs hover:border-ring/60 focus-visible:border-ring focus-visible:outline-none"
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
        {kids.total > 0 && (
          <span className="rounded-full border px-2 text-xs leading-5 text-muted-foreground tabular-nums">
            {kids.done}/{kids.total}
          </span>
        )}
        {issue.labels.map((id) => labels[id] && <LabelChip key={id} label={labels[id]} />)}
      </div>
    </Link>
  )
}

export function IssueBoard({ groups, all, onAdd }: { groups: Group[]; all: Issue[]; onAdd?: (group: Group) => void }) {
  return (
    <div className="flex h-full gap-4 overflow-x-auto pb-4">
      {groups.map((g) => (
        <section key={g.key} className="flex w-[21rem] shrink-0 flex-col rounded-xl bg-accent/30">
          <header className="flex h-12 items-center gap-2.5 px-4 text-[15px] font-medium">
            <GroupIcon group={g} />
            {g.title}
            <span className="font-normal text-muted-foreground tabular-nums">{g.issues.length}</span>
            {onAdd && (
              <button type="button" onClick={() => onAdd(g)} className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={`New issue in ${g.title}`}>
                <Plus className="size-4" />
              </button>
            )}
          </header>
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
            {g.issues.map((i) => (
              <IssueCard key={i.id} issue={i} all={all} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
