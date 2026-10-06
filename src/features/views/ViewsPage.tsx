/** The list of saved views: emoji, name, description, owner. "New view" makes one. */
import { useState } from 'react'
import { Link, useParams } from 'wouter'
import { Layers, Plus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useCrumbs } from '@/app/chrome'
import { PersonAvatar } from '@/components/Avatar'
import { EmptyState } from '@/components/EmptyState'
import { useData } from '@/data/store'
import { Button } from '@/ui/button'
import { NewViewDialog } from './NewViewDialog'

export function ViewsPage() {
  const { key } = useParams<{ key?: string }>()
  const team = useData((s) => (key ? s.teams[key] : undefined))
  const views = useData(useShallow((s) => Object.values(s.views).filter((v) => (key ? v.team === key : true))))
  const people = useData((s) => s.people)
  useCrumbs(team ? [{ label: `${team.emoji} ${team.name}` }, { label: 'Views' }] : [{ label: 'Views' }])
  const [creating, setCreating] = useState(false)
  const sorted = [...views].sort((a, b) => a.name.localeCompare(b.name))
  const dialog = creating && <NewViewDialog open onOpenChange={setCreating} preset={{ team: key ?? null }} />
  const newButton = (
    <Button variant="outline" onClick={() => setCreating(true)}>
      <Plus /> New view
    </Button>
  )
  if (!sorted.length) {
    return (
      <>
        <EmptyState icon={<Layers />} title="No views yet" action={newButton}>
          A view is a saved filter with its own emoji, for example “🐞 Open bugs”. Make one here, or filter any list of issues and press Save as view.
        </EmptyState>
        {dialog}
      </>
    )
  }
  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 pt-6">
      <div className="mb-4 flex justify-end">{newButton}</div>
      <div className="flex h-10 items-center border-b px-4 text-sm text-muted-foreground">
        <span>Name</span>
        <span className="ml-auto w-56">Owner</span>
      </div>
      {sorted.map((v) => (
        <Link key={v.id} href={`/view/${v.id}`} className="flex items-center gap-4 rounded-md px-4 py-3 hover:bg-accent/60">
          <span className="w-6 text-center text-lg leading-none">{v.emoji}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium">{v.name}</span>
            {v.description && <span className="block truncate text-sm text-muted-foreground">{v.description}</span>}
          </span>
          <span className="flex w-56 items-center gap-2 truncate text-[15px]">
            <PersonAvatar person={people[v.owner]} login={v.owner} />
            <span className="truncate">{people[v.owner]?.name ?? v.owner}</span>
          </span>
        </Link>
      ))}
      {dialog}
    </div>
  )
}
