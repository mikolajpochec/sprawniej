/**
 * Who hears about a change (their Inbox). Pure rules, so they're unit-tested (tests/notify.test.ts):
 * - assigned: the new assignee
 * - mentioned: anyone newly @mentioned in a description or comment
 * - commented: the issue's creator, its assignee and earlier commenters
 * - status: the creator and the assignee, when the issue is done or canceled
 * Nobody hears about their own changes, and only people in the workspace get notes.
 */
import type { Comment, InboxItem, Issue, Person } from '@/model/schema'
import { statusOf, type StatusId } from '@/model/status'
import { mentionedLogins, newMentions } from './mentions'

export interface Note {
  to: string
  type: InboxItem['type']
  comment?: string
  status?: StatusId
}

function keep(notes: Note[], actor: string, people: Record<string, Person>): Note[] {
  const seen = new Set<string>()
  return notes.filter((n) => {
    const key = `${n.to}:${n.type}`
    if (n.to === actor || !people[n.to] || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** notes for a new issue (`before` = null) or a change to one */
export function issueNotes(before: Issue | null, after: Issue, actor: string, people: Record<string, Person>): Note[] {
  const notes: Note[] = []
  if (after.assignee && after.assignee !== before?.assignee) notes.push({ to: after.assignee, type: 'assigned' })
  if (after.description !== before?.description) {
    for (const to of newMentions(before?.description ?? '', after.description, people)) notes.push({ to, type: 'mentioned' })
  }
  if (before && before.status !== after.status && ['completed', 'canceled'].includes(statusOf(after.status).group)) {
    for (const to of [after.createdBy, after.assignee]) if (to) notes.push({ to, type: 'status', status: after.status })
  }
  return keep(notes, actor, people)
}

/**
 * notes for a new comment (`before` = null) or an edited one (`before` = its old text; only new mentions count).
 * `earlier` = the comments already on the issue.
 */
export function commentNotes(issue: Issue, comment: Comment, before: string | null, earlier: Comment[], actor: string, people: Record<string, Person>): Note[] {
  const mentioned = before === null ? mentionedLogins(comment.body, people) : newMentions(before, comment.body, people)
  const notes: Note[] = mentioned.map((to) => ({ to, type: 'mentioned', comment: comment.id }))
  if (before === null) {
    const told = new Set(mentioned)
    for (const to of [issue.createdBy, issue.assignee, ...earlier.map((c) => c.author)]) {
      if (to && !told.has(to)) notes.push({ to, type: 'commented', comment: comment.id })
    }
  }
  return keep(notes, actor, people)
}
