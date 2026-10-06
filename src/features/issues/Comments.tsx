/**
 * The comment thread under an issue. Write with the same editor as descriptions (@ mentions people, who then hear
 * about it in their Inbox). Your own comments can be edited (saved as you type) or deleted. A comment you haven't
 * sent yet stays in this browser, so leaving the page doesn't lose it.
 */
import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { PersonAvatar } from '@/components/Avatar'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Markdown } from '@/components/Markdown'
import { createComment, deleteComment, updateComment } from '@/data/actions'
import { useData } from '@/data/store'
import { Editor } from '@/editor/LazyEditor'
import type { Comment } from '@/model/schema'
import { Button } from '@/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/ui/dropdown-menu'
import { shortDate } from './format'
import { takeJump } from './jumpTo'

const draftKey = (issue: string) => `sprawniej:comment-draft:${issue}`

function CommentItem({ comment, mine }: { comment: Comment; mine: boolean }) {
  const author = useData((s) => s.people[comment.author])
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState(false)
  return (
    <li className="group rounded-lg border p-4" id={`comment-${comment.id}`}>
      <div className="mb-2 flex items-center gap-2 text-sm">
        <PersonAvatar person={author} login={comment.author} />
        <span className="font-medium">{author?.name ?? comment.author}</span>
        <span className="text-muted-foreground" title={new Date(comment.createdAt).toLocaleString()}>
          {shortDate(comment.createdAt)}
          {comment.editedAt && ' (edited)'}
        </span>
        {mine && !editing && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="ml-auto opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100" aria-label="Comment actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {editing ? (
        <div
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !e.defaultPrevented) setEditing(false)
          }}
        >
          <Editor value={comment.body} onChange={(body) => updateComment(comment.issue, comment.id, body)} onSubmit={() => setEditing(false)} autoFocus label="Comment" className="min-h-12" />
          <div className="mt-2 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <div className="prose-sprawniej [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
          <Markdown references>{comment.body}</Markdown>
        </div>
      )}
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Delete this comment?" confirm="Delete" onConfirm={() => deleteComment(comment.issue, comment.id)}>
        It will be removed for everyone.
      </ConfirmDialog>
    </li>
  )
}

function NewComment({ issue }: { issue: string }) {
  const [saved] = useState(() => localStorage.getItem(draftKey(issue)) ?? '')
  const draft = useRef(saved)
  // a new key empties the editor after sending
  const [round, setRound] = useState(0)

  function change(md: string) {
    draft.current = md
    if (md.trim()) localStorage.setItem(draftKey(issue), md)
    else localStorage.removeItem(draftKey(issue))
  }
  function send(md = draft.current) {
    if (!md.trim()) return
    createComment(issue, md)
    change('')
    setRound((r) => r + 1)
  }

  return (
    <div className="mt-4 rounded-lg border px-4 pt-3 pb-2 focus-within:border-ring">
      <Editor key={round} value={round ? '' : saved} onChange={change} onSubmit={send} placeholder="Leave a comment…" label="New comment" className="min-h-12" />
      <div className="flex items-center justify-end gap-3">
        <span className="text-xs text-muted-foreground">⌘ Enter</span>
        {/* the editor saves its text when it loses focus, which happens before this click */}
        <Button size="sm" variant="outline" onClick={() => send()}>
          Comment
        </Button>
      </div>
    </div>
  )
}

export function Comments({ issue }: { issue: string }) {
  const comments = useData((s) => s.comments[issue])
  const me = useData((s) => s.me?.login)
  useEffect(() => {
    const id = takeJump()
    const el = id && document.getElementById(`comment-${id}`)
    if (!el) return
    el.scrollIntoView({ block: 'center' })
    el.classList.add('ring-2', 'ring-ring/60')
    setTimeout(() => el.classList.remove('ring-2', 'ring-ring/60'), 1600)
  }, [issue])
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">Comments</h2>
      {!!comments?.length && (
        <ol className="flex flex-col gap-4">
          {comments.map((c) => (
            <CommentItem key={c.id} comment={c} mine={c.author === me} />
          ))}
        </ol>
      )}
      <NewComment key={issue} issue={issue} />
    </section>
  )
}
