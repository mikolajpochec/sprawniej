/**
 * Signed in, but no workspace open: invitations waiting for you, workspaces you opened before, any repository you
 * can save to, or a brand-new workspace.
 */
import { useEffect, useMemo, useState } from 'react'
import { Clock, Lock, Mail, Plus, Search } from 'lucide-react'
import { acceptInvitation, listMyInvitations, listMyRepos, repoKey, type MyInvitation, type RepoInfo, type RepoRef } from '@/github/api'
import { useSession } from '@/session'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { NewWorkspace } from './NewWorkspace'
import { Problem, Step } from './Step'

function Row({ title, sub, onClick, icon }: { title: string; sub?: string; onClick: () => void; icon?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none">
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{title}</span>
        {sub && <span className="block truncate text-sm text-muted-foreground">{sub}</span>}
      </span>
    </button>
  )
}

export function PickWorkspace() {
  const { token, user, recent, open, signOut } = useSession()
  const [repos, setRepos] = useState<RepoInfo[] | null>(null)
  const [invites, setInvites] = useState<MyInvitation[]>([])
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [problem, setProblem] = useState<string>()

  useEffect(() => {
    listMyRepos(token).then(setRepos, (e: Error) => setProblem(e.message))
    listMyInvitations(token).then(setInvites, () => {})
  }, [token])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (repos ?? []).filter((r) => !q || r.full_name.toLowerCase().includes(q)).slice(0, 30)
  }, [repos, query])

  async function join(inv: MyInvitation) {
    const ref: RepoRef = { owner: inv.repository.owner.login, repo: inv.repository.name }
    try {
      await acceptInvitation(token, ref)
      open(ref)
    } catch (e) {
      setProblem((e as Error).message)
    }
  }

  if (creating) return <NewWorkspace onBack={() => setCreating(false)} />

  return (
    <Step
      wide
      title="Choose a workspace"
      footer={
        <>
          <Button size="lg" onClick={() => setCreating(true)}>
            <Plus /> Create a new workspace
          </Button>
          <span className="ml-auto text-sm text-muted-foreground">
            Signed in as @{user?.login} ·{' '}
            <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={signOut}>
              sign out
            </button>
          </span>
        </>
      }
    >
      <Problem>{problem}</Problem>
      {invites.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-1 text-sm font-medium text-muted-foreground">Invitations for you</h2>
          {invites.map((i) => (
            <Row key={i.id} icon={<Mail className="size-5 text-status-review" />} title={i.repository.full_name} sub={i.inviter ? `From @${i.inviter.login}` : undefined} onClick={() => void join(i)} />
          ))}
        </section>
      )}
      {recent.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-1 text-sm font-medium text-muted-foreground">Opened before</h2>
          {recent.map((r) => (
            <Row key={repoKey(r)} icon={<Clock className="size-5 text-muted-foreground" />} title={repoKey(r)} onClick={() => open(r)} />
          ))}
        </section>
      )}
      <section>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Open a workspace you were given access to</h2>
        <div className="relative mb-2">
          <Search className="absolute top-3 left-3 size-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name" className="h-10 pl-9" />
        </div>
        <div className="max-h-64 overflow-y-auto">
          {repos === null && !problem && <p className="px-3 py-2 text-sm text-muted-foreground">Loading…</p>}
          {repos && !shown.length && <p className="px-3 py-2 text-sm text-muted-foreground">Nothing found.</p>}
          {shown.map((r) => (
            <Row
              key={r.full_name}
              icon={r.private ? <Lock className="size-4 text-muted-foreground" /> : <span className="size-4" />}
              title={r.full_name}
              onClick={() => open({ owner: r.owner.login, repo: r.name })}
            />
          ))}
        </div>
      </section>
    </Step>
  )
}
