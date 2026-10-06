/**
 * One issue: title, description, sub-issues and comments on the left, properties on the right.
 * Everything saves by itself; there is no Save button anywhere (CLAUDE.md, golden rules).
 * The rich description editor arrives in milestone 2; until then the description is shown read-only.
 */
import Markdown from 'react-markdown'
import { useParams } from 'wouter'
import { useShallow } from 'zustand/react/shallow'
import { useCrumbs } from '@/app/chrome'
import { NotFound } from '@/app/NotFound'
import { PersonAvatar } from '@/components/Avatar'
import { LabelChip } from '@/components/LabelChip'
import { updateIssue } from '@/data/actions'
import { findByRef, issueRef, useData } from '@/data/store'
import { PRIORITY_IDS, PRIORITY_NAMES, STATUSES, statusOf } from '@/model/status'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/ui/dropdown-menu'
import { PriorityIcon, StatusIcon } from './icons'
import { IssueRow } from './IssueList'
import { shortDate } from './format'
import type { ReactNode } from 'react'

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-9 items-center gap-3">
      <span className="w-24 shrink-0 text-sm text-muted-foreground">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

const pick = 'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[15px] hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

export function IssuePage() {
  const { ref = '' } = useParams<{ ref: string }>()
  const issue = useData((s) => findByRef(s.issues, ref))
  const team = useData((s) => (issue ? s.teams[issue.team] : undefined))
  const people = useData((s) => s.people)
  const labels = useData((s) => s.labels)
  const project = useData((s) => (issue?.project ? s.projects[issue.project] : undefined))
  const parent = useData((s) => (issue?.parent ? s.issues[issue.parent] : undefined))
  const all = useData(useShallow((s) => Object.values(s.issues)))
  const comments = useData((s) => (issue ? s.comments[issue.id] : undefined))
  useCrumbs(issue && team ? [{ label: `${team.emoji} ${team.name}`, href: `/team/${team.key}/issues` }, { label: issueRef(issue) }] : [])
  if (!issue) return <NotFound />
  const children = all.filter((i) => i.parent === issue.id).sort((a, b) => (a.sortOrder < b.sortOrder ? -1 : 1))

  return (
    <div className="flex min-h-0 flex-1">
      <article className="min-w-0 flex-1 overflow-y-auto px-12 py-10">
        <div className="mx-auto max-w-3xl">
          {parent && (
            <p className="mb-3 text-sm text-muted-foreground">
              Sub-issue of {issueRef(parent)} {parent.title}
            </p>
          )}
          <textarea
            value={issue.title}
            onChange={(e) => updateIssue(issue.id, { title: e.target.value.replace(/\n/g, ' ') })}
            rows={1}
            className="field-sizing-content w-full resize-none bg-transparent text-2xl font-semibold leading-snug outline-none"
            aria-label="Title"
          />
          <div className="prose-sprawniej mt-4">
            {issue.description ? <Markdown>{issue.description}</Markdown> : <p className="text-muted-foreground">Add a description…</p>}
          </div>

          {children.length > 0 && (
            <section className="mt-10">
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">Sub-issues</h2>
              <div className="rounded-lg border py-1">
                {children.map((c) => (
                  <IssueRow key={c.id} issue={c} all={all} />
                ))}
              </div>
            </section>
          )}

          <section className="mt-10">
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Comments</h2>
            {comments?.length ? (
              <ol className="flex flex-col gap-4">
                {comments.map((c) => (
                  <li key={c.id} className="rounded-lg border p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm">
                      <PersonAvatar person={people[c.author]} login={c.author} />
                      <span className="font-medium">{people[c.author]?.name ?? c.author}</span>
                      <span className="text-muted-foreground">{shortDate(c.createdAt)}</span>
                    </div>
                    <div className="prose-sprawniej [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
                      <Markdown>{c.body}</Markdown>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">No comments yet.</p>
            )}
          </section>
        </div>
      </article>

      <aside className="w-80 shrink-0 overflow-y-auto border-l px-5 py-8">
        <div className="flex flex-col gap-1">
          <Property label="Status">
            <DropdownMenu>
              <DropdownMenuTrigger className={pick}>
                <StatusIcon status={issue.status} />
                {statusOf(issue.status).name}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {STATUSES.map((s) => (
                  <DropdownMenuItem key={s.id} onSelect={() => updateIssue(issue.id, { status: s.id })}>
                    <StatusIcon status={s.id} />
                    {s.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </Property>
          <Property label="Priority">
            <DropdownMenu>
              <DropdownMenuTrigger className={pick}>
                <PriorityIcon priority={issue.priority} />
                {PRIORITY_NAMES[issue.priority]}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {PRIORITY_IDS.map((p) => (
                  <DropdownMenuItem key={p} onSelect={() => updateIssue(issue.id, { priority: p })}>
                    <PriorityIcon priority={p} />
                    {PRIORITY_NAMES[p]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </Property>
          <Property label="Assignee">
            <DropdownMenu>
              <DropdownMenuTrigger className={pick}>
                <PersonAvatar person={issue.assignee ? people[issue.assignee] : undefined} login={issue.assignee} />
                {issue.assignee ? (people[issue.assignee]?.name ?? issue.assignee) : <span className="text-muted-foreground">No one</span>}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => updateIssue(issue.id, { assignee: null })}>
                  <PersonAvatar login={null} /> No one
                </DropdownMenuItem>
                {Object.values(people).map((p) => (
                  <DropdownMenuItem key={p.login} onSelect={() => updateIssue(issue.id, { assignee: p.login })}>
                    <PersonAvatar person={p} /> {p.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </Property>
          <Property label="Labels">
            <div className="flex flex-wrap gap-1.5 px-2">
              {issue.labels.length ? issue.labels.map((id) => labels[id] && <LabelChip key={id} label={labels[id]} />) : <span className="text-[15px] text-muted-foreground">None</span>}
            </div>
          </Property>
          <Property label="Project">
            <span className="px-2 text-[15px]">{project ? `${project.emoji} ${project.name}` : <span className="text-muted-foreground">None</span>}</span>
          </Property>
        </div>
        <p className="mt-8 px-2 text-xs text-muted-foreground">
          Created {shortDate(issue.createdAt)} by {people[issue.createdBy]?.name ?? issue.createdBy}
        </p>
      </aside>
    </div>
  )
}
