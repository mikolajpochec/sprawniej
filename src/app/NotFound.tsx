import { Link } from 'wouter'
import { SearchX } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/ui/button'

export function NotFound() {
  return (
    <EmptyState
      icon={<SearchX />}
      title="We couldn't find this page"
      action={
        <Button asChild variant="outline">
          <Link href="/">Go to your issues</Link>
        </Button>
      }
    >
      It may have been moved or deleted, or the link has a typo.
    </EmptyState>
  )
}
