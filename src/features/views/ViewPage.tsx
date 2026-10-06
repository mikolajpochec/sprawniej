import { useParams } from 'wouter'
import { useCrumbs } from '@/app/chrome'
import { NotFound } from '@/app/NotFound'
import { IssuesView } from '@/features/issues/IssuesView'
import { useData } from '@/data/store'

export function ViewPage() {
  const { id = '' } = useParams<{ id: string }>()
  const view = useData((s) => s.views[id])
  const team = useData((s) => (view?.team ? s.teams[view.team] : undefined))
  useCrumbs(
    view
      ? [...(team ? [{ label: `${team.emoji} ${team.name}` }] : []), { label: 'Views', href: team ? `/team/${team.key}/views` : '/views' }, { label: `${view.emoji} ${view.name}` }]
      : [],
  )
  if (!view) return <NotFound />
  return (
    <IssuesView
      page={`view:${view.id}`}
      filters={{ ...view.filters, ...(view.team ? { teams: [view.team] } : {}) }}
      baseDisplay={view.display}
      left={view.description ? <p className="text-[15px] text-muted-foreground">{view.description}</p> : undefined}
    />
  )
}
