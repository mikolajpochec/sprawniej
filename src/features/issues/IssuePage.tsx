/**
 * One issue: title, description, sub-issues and comments on the left, properties on the right.
 * Everything saves by itself; there is no Save button anywhere (CLAUDE.md, golden rules).
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'wouter'
import { useShallow } from 'zustand/react/shallow'
import { Link2, MoreHorizontal, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCrumbs } from '@/app/chrome'
import { NotFound } from '@/app/NotFound'
import { PersonAvatar } from '@/components/Avatar'
import { LabelChip } from '@/components/LabelChip'
import { Picker } from '@/components/Picker'
import { createLabel, deleteIssue, markRead, moveIssueToTeam, updateIssue } from '@/data/actions'
import { isClosed, isUnread } from '@/data/select'
import { findByRef, issueRef, useData } from '@/data/store'
import { Editor } from '@/editor/LazyEditor'
import { useMedia } from '@/lib/useNarrow'
import { cn } from '@/lib/utils'
import { PRIORITY_NAMES, statusOf } from '@/model/status'
import { Button } from '@/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/ui/dropdown-menu'
import { PriorityIcon, StatusIcon } from './icons'
import { Comments } from './Comments'
import { DueChip, DueDatePicker, EstimateIcon, estimateItems, estimateName } from './DueDate'
import { shortDate } from './format'
import { SubIssues } from './SubIssues'
import { TitleField } from './TitleField'
import { priorityItems, statusItems, useLabelItems, useParentItems, usePeopleItems, useProjectItems } from './pickers'

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-9 items-center gap-3">
      <span className="w-24 shrink-0 text-sm text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

const pick =
  'flex min-h-8 w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[15px] hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=open]:bg-accent/60'

export function IssuePage() {
  const { ref = '' } = useParams<{ ref: string }>()
  const [, navigate] = useLocation()
  const issue = useData((s) => findByRef(s.issues, ref))
  const team = useData((s) => (issue ? s.teams[issue.team] : undefined))
  const teams = useData(useShallow((s) => Object.values(s.teams)))
  const people = useData((s) => s.people)
  const labels = useData((s) => s.labels)
  const project = useData((s) => (issue?.project ? s.projects[issue.project] : undefined))
  const parent = useData((s) => (issue?.parent ? s.issues[issue.parent] : undefined))
  // opening an issue reads its notes in your inbox
  const unread = useData(useShallow((s) => (issue ? s.inbox.filter((n) => n.issue === issue.id && isUnread(n, s.readState)).map((n) => n.id) : [])))
  useEffect(() => {
    if (unread.length) markRead(unread)
  }, [unread])
  const peopleItems = usePeopleItems()
  const labelItems = useLabelItems()
  const projectItems = useProjectItems(issue?.team)
  const parentItems = useParentItems(issue)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // under 1024 px the properties sit under the title instead of in a column of their own
  const stacked = useMedia('(max-width: 1023px)')
  useCrumbs(issue && team ? [{ label: `${team.emoji} ${team.name}`, href: `/team/${team.key}/issues` }, { label: issueRef(issue) }] : [])
  if (!issue) return <NotFound />
  const assignee = issue.assignee ? people[issue.assignee] : undefined

  const properties = (
    <>
    <div className="flex flex-col gap-1">
      <Property label="Status">
        <Picker placeholder="Change status…" items={statusItems} value={issue.status} onSelect={(status) => updateIssue(issue.id, { status })}>
          <button type="button" className={pick}>
            <StatusIcon status={issue.status} /> {statusOf(issue.status).name}
          </button>
        </Picker>
      </Property>
      <Property label="Priority">
        <Picker placeholder="Change priority…" items={priorityItems} value={issue.priority} onSelect={(priority) => updateIssue(issue.id, { priority })}>
          <button type="button" className={pick}>
            <PriorityIcon priority={issue.priority} /> {PRIORITY_NAMES[issue.priority]}
          </button>
        </Picker>
      </Property>
      <Property label="Assignee">
        <Picker placeholder="Assign to…" items={peopleItems} value={issue.assignee} onSelect={(assignee) => updateIssue(issue.id, { assignee })}>
          <button type="button" className={pick}>
            <PersonAvatar person={assignee} login={issue.assignee} />
            {issue.assignee ? (assignee?.name ?? issue.assignee) : <span className="text-muted-foreground">No one</span>}
          </button>
        </Picker>
      </Property>
      <Property label="Labels">
        <Picker
          multiple
          placeholder="Labels…"
          items={labelItems}
          value={issue.labels}
          onSelect={(ids) => updateIssue(issue.id, { labels: ids })}
          onCreate={(name) => updateIssue(issue.id, { labels: [...issue.labels, createLabel(name).id] })}
          createLabel={(name) => `Create label “${name}”`}
        >
          <button type="button" className={`${pick} flex-wrap`}>
            {issue.labels.filter((id) => labels[id]).length ? (
              issue.labels.map((id) => labels[id] && <LabelChip key={id} label={labels[id]} />)
            ) : (
              <span className="text-muted-foreground">Add labels</span>
            )}
          </button>
        </Picker>
      </Property>
      <Property label="Project">
        <Picker placeholder="Move to project…" items={projectItems} value={issue.project} onSelect={(p) => updateIssue(issue.id, { project: p })}>
          <button type="button" className={pick}>
            {project ? (
              <>
                <span className="w-4 text-center leading-none">{project.emoji}</span> {project.name}
              </>
            ) : (
              <span className="text-muted-foreground">No project</span>
            )}
          </button>
        </Picker>
      </Property>
      <Property label="Parent">
        <Picker placeholder="Make a sub-issue of…" items={parentItems} value={issue.parent} onSelect={(p) => updateIssue(issue.id, { parent: p })}>
          <button type="button" className={pick}>
            {parent ? (
              <span className="truncate">
                <span className="text-muted-foreground">{issueRef(parent)}</span> {parent.title}
              </span>
            ) : (
              <span className="text-muted-foreground">None</span>
            )}
          </button>
        </Picker>
      </Property>
      <Property label="Due date">
        <DueDatePicker value={issue.dueDate} onChange={(dueDate) => updateIssue(issue.id, { dueDate })}>
          <button type="button" className={pick}>
            {issue.dueDate ? (
              <DueChip day={issue.dueDate} closed={isClosed(issue)} className="border-0 px-0 text-[15px]" />
            ) : (
              <span className="text-muted-foreground">None</span>
            )}
          </button>
        </DueDatePicker>
      </Property>
      <Property label="Estimate">
        <Picker placeholder="Estimate…" items={estimateItems(issue.estimate)} value={issue.estimate ?? null} onSelect={(estimate) => updateIssue(issue.id, { estimate })}>
          <button type="button" className={pick}>
            {issue.estimate != null ? (
              <>
                <EstimateIcon /> {estimateName(issue.estimate)}
              </>
            ) : (
              <span className="text-muted-foreground">None</span>
            )}
          </button>
        </Picker>
      </Property>
      {teams.length > 1 && (
        <Property label="Team">
          <Picker
            placeholder="Move to team…"
            items={teams.map((t) => ({ value: t.key, label: t.name, icon: <span className="w-4 text-center leading-none">{t.emoji}</span> }))}
            value={issue.team}
            onSelect={(key) => {
              const moved = moveIssueToTeam(issue.id, key)
              if (moved && moved.team !== issue.team) navigate(`/issue/${issueRef(moved)}`, { replace: true })
            }}
          >
            <button type="button" className={pick}>
              <span className="w-4 text-center leading-none">{team?.emoji}</span> {team?.name}
            </button>
          </Picker>
        </Property>
      )}
    </div>
    <p className={cn('px-2 text-xs text-muted-foreground', stacked ? 'mt-3' : 'mt-8')}>
      Created {shortDate(issue.createdAt)} by {people[issue.createdBy]?.name ?? issue.createdBy}
      <br />
      Last changed {shortDate(issue.updatedAt)}
    </p>
    </>
  )

  return (
    <div className="flex min-h-0 flex-1">
      <article className="min-w-0 flex-1 overflow-y-auto px-4 py-6 lg:px-12 lg:py-10">
        <div className="mx-auto max-w-3xl">
          {parent && (
            <Link href={`/issue/${issueRef(parent)}`} className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <StatusIcon status={parent.status} /> Sub-issue of {issueRef(parent)} {parent.title}
            </Link>
          )}
          <div className="flex items-start gap-2">
            <TitleField key={issue.id} id={issue.id} value={issue.title} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => {
                    void navigator.clipboard.writeText(`${location.origin}${location.pathname}#/issue/${issueRef(issue)}`).then(() => toast('Link copied'))
                  }}
                >
                  <Link2 /> Copy link
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
                  <Trash2 /> Delete issue
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {stacked && <div className="mt-4 rounded-lg border px-2 py-2">{properties}</div>}
          <Editor key={issue.id} value={issue.description} onChange={(description) => updateIssue(issue.id, { description })} className="mt-4" />

          <SubIssues issue={issue} />
          <Comments issue={issue.id} />
        </div>
      </article>

      {!stacked && <aside className="w-80 shrink-0 overflow-y-auto border-l px-5 py-8">{properties}</aside>}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogTitle>Delete {issueRef(issue)}?</DialogTitle>
          <DialogDescription>“{issue.title}” and its comments will be removed for everyone. Its sub-issues stay.</DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                const back = `/team/${issue.team}/issues`
                deleteIssue(issue.id)
                setConfirmDelete(false)
                navigate(back, { replace: true })
                toast(`Deleted ${issueRef(issue)}`)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
