/** Things that happened to you: assigned, mentioned, a comment on your issue. */
import { Link } from 'wouter'
import { Inbox } from 'lucide-react'
import { useCrumbs } from '@/app/chrome'
import { PersonAvatar } from '@/components/Avatar'
import { EmptyState } from '@/components/EmptyState'
import { issueRef, useData } from '@/data/store'
import { shortDate } from '@/features/issues/format'
import type { InboxItem } from '@/model/schema'

const WHAT: Record<InboxItem['type'], string> = {
  assigned: 'assigned you',
  mentioned: 'mentioned you',
  commented: 'commented',
  status: 'changed the status',
}

export function InboxPage() {
  const inbox = useData((s) => s.inbox)
  const issues = useData((s) => s.issues)
  const people = useData((s) => s.people)
  const read = useData((s) => s.readState)
  useCrumbs([{ label: 'Inbox' }])
  if (!inbox.length) {
    return (
      <EmptyState icon={<Inbox />} title="You're all caught up">
        When someone assigns you an issue, mentions you, or comments on your issue, you'll see it here.
      </EmptyState>
    )
  }
  return (
    <div className="flex-1 overflow-y-auto px-8 pt-6">
      {inbox.map((n) => {
        const issue = issues[n.issue]
        const unread = !read.read.includes(n.id) && (!read.readUntil || n.at > read.readUntil)
        return (
          <Link key={n.id} href={issue ? `/issue/${issueRef(issue)}` : '/inbox'} className="flex items-center gap-4 rounded-md px-4 py-3 hover:bg-accent/60">
            <span className={`size-2 shrink-0 rounded-full ${unread ? 'bg-status-done' : ''}`} aria-label={unread ? 'Unread' : undefined} />
            <PersonAvatar person={people[n.actor]} login={n.actor} className="size-8 text-xs" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px]">{issue ? `${issueRef(issue)} ${issue.title}` : 'A deleted issue'}</span>
              <span className="block text-sm text-muted-foreground">
                {people[n.actor]?.name ?? n.actor} {WHAT[n.type]}
              </span>
            </span>
            <span className="text-sm text-muted-foreground">{shortDate(n.at)}</span>
          </Link>
        )
      })}
    </div>
  )
}
