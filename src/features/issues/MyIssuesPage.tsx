import { CircleUser } from 'lucide-react'
import { useCrumbs } from '@/app/chrome'
import { EmptyState } from '@/components/EmptyState'
import { IssuesView } from '@/features/issues/IssuesView'
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
        <EmptyState icon={<CircleUser />} title="Nothing assigned to you">
          When someone gives you an issue, or you take one, it shows up here.
        </EmptyState>
      }
    />
  )
}
