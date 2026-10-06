import { useParams } from 'wouter'
import { useCrumbs } from '@/app/chrome'
import { NotFound } from '@/app/NotFound'
import { IssuesView } from '@/features/issues/IssuesView'
import { useData } from '@/data/store'

export function ProjectPage() {
  const { id = '' } = useParams<{ id: string }>()
  const project = useData((s) => s.projects[id])
  useCrumbs(project ? [{ label: 'Projects', href: '/projects' }, { label: `${project.emoji} ${project.name}` }] : [])
  if (!project) return <NotFound />
  return (
    <IssuesView
      page={`project:${project.id}`}
      filters={{ projects: [project.id] }}
      left={project.description ? <p className="text-[15px] text-muted-foreground">{project.description}</p> : undefined}
    />
  )
}
