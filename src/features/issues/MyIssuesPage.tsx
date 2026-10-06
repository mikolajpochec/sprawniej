import { CircleUser, Plus } from 'lucide-react'
import { useCrumbs } from '@/app/chrome'
import { EmptyState } from '@/components/EmptyState'
import { openComposer } from '@/features/issues/composer'
import { IssuesView } from '@/features/issues/IssuesView'
import { Button } from '@/ui/button'
import { useData } from '@/data/store'

export function MyIssuesPage() {
  const me = useData((s) => s.me)
  useCrumbs([{ label: 'My issues' }])
  return (
    <IssuesView
      page="my-issues"
      filters={{ assignees: [me?.login ?? ''] }}
      hideFilters={['assignees']}
      viewScope={null}
      baseDisplay={{ showCompleted: false }}
      empty={
        <EmptyState
          icon={<CircleUser />}
          title="Nothing assigned to you"
          action={
            <Button variant="outline" onClick={() => openComposer({ assignee: me?.login ?? null })}>
              <Plus /> New issue for yourself
            </Button>
          }
        >
          When someone gives you an issue, or you take one, it shows up here.
        </EmptyState>
      }
    />
  )
}
