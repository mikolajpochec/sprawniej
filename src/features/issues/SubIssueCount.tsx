/** The "2/5" chip on a row or card: done sub-issues out of all of them. Hidden when there are none. */
import { childIndex } from '@/data/select'
import { useData } from '@/data/store'
import { cn } from '@/lib/utils'

export function SubIssueCount({ id, className }: { id: string; className?: string }) {
  // a string, so the row only re-renders when its own counter changes
  const text = useData((s) => {
    const c = childIndex(s.issues).get(id)
    return c ? `${c.done}/${c.total}` : ''
  })
  if (!text) return null
  return <span className={cn('rounded-full border px-2 text-xs leading-5 text-muted-foreground tabular-nums', className)}>{text}</span>
}
