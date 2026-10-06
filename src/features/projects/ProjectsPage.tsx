/** Projects: name with emoji, status, lead, target date and how much is done. "New project" starts one. */
import { useState } from 'react'
import { Link, useParams } from 'wouter'
import { Box, Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useCrumbs } from '@/app/chrome'
import { PersonAvatar } from '@/components/Avatar'
import { EmptyState } from '@/components/EmptyState'
import { projectProgress } from '@/data/select'
import { useData } from '@/data/store'
import { shortDate } from '@/features/issues/format'
import { Button } from '@/ui/button'
import { NewProjectDialog } from './NewProjectDialog'
import { StatusDot } from './ProjectProperties'
import { PROJECT_STATUS_NAMES } from './status'

export function ProjectsPage() {
  const { key } = useParams<{ key?: string }>()
  const team = useData((s) => (key ? s.teams[key] : undefined))
  const projects = useData(useShallow((s) => Object.values(s.projects).filter((p) => (key ? p.teams.includes(key) : true))))
  const issues = useData(useShallow((s) => Object.values(s.issues)))
  const people = useData((s) => s.people)
  useCrumbs(team ? [{ label: `${team.emoji} ${team.name}` }, { label: 'Projects' }] : [{ label: 'Projects' }])
  const [creating, setCreating] = useState(false)
  const dialog = creating && <NewProjectDialog onOpenChange={setCreating} team={key} />
  const newButton = (
    <Button variant="outline" onClick={() => setCreating(true)}>
      <Plus /> New project
    </Button>
  )
  const sorted = [...projects].sort((a, b) => a.name.localeCompare(b.name))
  if (!sorted.length) {
    return (
      <>
        <EmptyState icon={<Box />} title="No projects yet" action={newButton}>
          A project is a bigger goal made of several issues, like “New onboarding”. It shows how much is done.
        </EmptyState>
        {dialog}
      </>
    )
  }
  return (
    <div className="flex-1 overflow-y-auto px-8 pt-6">
      <div className="mb-4 flex justify-end">{newButton}</div>
      <div className="flex h-10 items-center gap-4 border-b px-4 text-sm text-muted-foreground">
        <span className="flex-1">Name</span>
        <span className="w-32">Status</span>
        <span className="w-44">Lead</span>
        <span className="w-28">Target date</span>
        <span className="w-40">Progress</span>
      </div>
      {sorted.map((p) => {
        const { done, total } = projectProgress(p.id, issues)
        const pct = total ? Math.round((done / total) * 100) : 0
        return (
          <Link key={p.id} href={`/project/${p.id}`} className="flex items-center gap-4 rounded-md px-4 py-3 text-[15px] hover:bg-accent/60">
            <span className="flex min-w-0 flex-1 items-center gap-3">
              <span className="w-6 text-center text-lg leading-none">{p.emoji}</span>
              <span className="truncate font-medium">{p.name}</span>
            </span>
            <span className="flex w-32 items-center gap-2 text-muted-foreground">
              <StatusDot status={p.status} /> {PROJECT_STATUS_NAMES[p.status]}
            </span>
            <span className="flex w-44 items-center gap-2 truncate">
              {p.lead ? (
                <>
                  <PersonAvatar person={people[p.lead]} login={p.lead} />
                  <span className="truncate">{people[p.lead]?.name ?? p.lead}</span>
                </>
              ) : (
                <span className="text-muted-foreground">No lead</span>
              )}
            </span>
            <span className="w-28 text-muted-foreground">{p.targetDate ? shortDate(p.targetDate) : '–'}</span>
            <span className="flex w-40 items-center gap-2">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-status-done" style={{ width: `${pct}%` }} />
              </span>
              <span className="w-10 text-right text-sm text-muted-foreground tabular-nums">{pct}%</span>
            </span>
          </Link>
        )
      })}
      {dialog}
    </div>
  )
}
