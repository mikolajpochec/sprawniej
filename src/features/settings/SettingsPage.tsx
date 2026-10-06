/** Settings: the workspace's name, the people in it (and inviting more), and your account. */
import { useEffect, useState, type ReactNode } from 'react'
import { Copy, ExternalLink, Loader2, LogOut, Repeat, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { useCrumbs } from '@/app/chrome'
import { signOutEverywhere } from '@/app/signOut'
import { PersonAvatar } from '@/components/Avatar'
import { renameWorkspace } from '@/data/actions'
import { useData } from '@/data/store'
import { inviteMessage, joinLink } from '@/features/onboarding/joinLink'
import { Problem } from '@/features/onboarding/Step'
import { getRepo, GitHubError, invite, listSentInvitations, repoKey, type SentInvitation } from '@/github/api'
import { useSession } from '@/session'
import { workspace } from '@/sync/engine'
import { Button } from '@/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/ui/dialog'
import { Input } from '@/ui/input'

function Section({ title, children, description }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="border-b py-8 last:border-0">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1 text-[15px] text-muted-foreground">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

function WorkspaceName() {
  const name = useData((s) => s.workspace?.name ?? '')
  // remount when a teammate renames it, so the field shows the new name
  return <NameField key={name} name={name} />
}

function NameField({ name }: { name: string }) {
  const [draft, setDraft] = useState(name)
  const commit = () => {
    if (draft.trim() && draft.trim() !== name) renameWorkspace(draft)
    else setDraft(name)
  }
  return (
    <Input
      aria-label="Workspace name"
      className="h-10 max-w-sm"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
}

function copy(text: string, what: string) {
  void navigator.clipboard.writeText(text).then(() => toast(`${what} copied`))
}

function People() {
  const { token, workspace: repo, user } = useSession()
  const people = useData(useShallow((s) => Object.values(s.people).sort((a, b) => a.name.localeCompare(b.name))))
  const wsName = useData((s) => s.workspace?.name ?? '')
  const [admin, setAdmin] = useState(false)
  const [sent, setSent] = useState<SentInvitation[]>([])
  const [login, setLogin] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string>()

  useEffect(() => {
    if (!repo) return
    getRepo(token, repo).then((r) => {
      const isAdmin = !!r.permissions?.admin
      setAdmin(isAdmin)
      if (isAdmin) listSentInvitations(token, repo).then(setSent, () => {})
    }, () => {})
  }, [token, repo])

  if (!repo) return null
  const link = joinLink(repo, wsName, user?.login)

  async function send() {
    const who = login.trim().replace(/^@/, '')
    if (!who || !repo) return
    setBusy(true)
    setProblem(undefined)
    try {
      const r = await invite(token, repo, who)
      setLogin('')
      if (r === 'member') toast(`@${who} already has access`)
      else {
        toast(`Invited @${who}`, { description: 'Now send them the join link below.' })
        listSentInvitations(token, repo).then(setSent, () => {})
      }
    } catch (e) {
      setProblem(
        e instanceof GitHubError && e.status === 404
          ? `There's no GitHub account called @${who}. Check the spelling with them.`
          : e instanceof GitHubError && e.status === 403
            ? 'You can’t invite people to this workspace. Ask its owner to do it, or to make you an admin on GitHub.'
            : (e as Error).message,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <ul className="flex flex-col gap-1">
        {people.map((p) => (
          <li key={p.login} className="flex items-center gap-3 py-1.5">
            <PersonAvatar person={p} className="size-8 text-xs" />
            <span className="font-medium">{p.name}</span>
            <span className="text-muted-foreground">@{p.login}</span>
          </li>
        ))}
        {sent.map((i) => (
          <li key={i.id} className="flex items-center gap-3 py-1.5 text-muted-foreground">
            <PersonAvatar login={i.invitee?.login ?? '?'} className="size-8 text-xs opacity-60" />
            <span>@{i.invitee?.login}</span>
            <span className="rounded-full border px-2 text-xs leading-5">Invited, hasn't joined yet</span>
          </li>
        ))}
      </ul>

      {admin ? (
        <div>
          <h3 className="mb-1 font-medium">Invite someone</h3>
          <p className="mb-3 text-sm text-muted-foreground">Type their GitHub username. No account yet? Send them the join link anyway; it helps them make one, then invite them here.</p>
          <form
            className="flex max-w-md gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void send()
            }}
          >
            <Input className="h-10" placeholder="GitHub username" value={login} onChange={(e) => setLogin(e.target.value)} aria-label="GitHub username" />
            <Button type="submit" size="lg" variant="outline" disabled={busy || !login.trim()}>
              {busy ? <Loader2 className="animate-spin" /> : <UserPlus />} Invite
            </Button>
          </form>
          <Problem>{problem}</Problem>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Only the workspace's admins can invite people. Ask one of them, then share the join link below.</p>
      )}

      <div>
        <h3 className="mb-1 font-medium">Join link</h3>
        {link ? (
          <>
            <p className="mb-3 text-sm text-muted-foreground">Send this to the people you invited. It walks them through getting in, step by step.</p>
            <div className="flex max-w-2xl gap-2">
              <Input readOnly value={link} className="h-10 font-mono text-sm" onFocus={(e) => e.target.select()} aria-label="Join link" />
              <Button variant="outline" size="lg" onClick={() => copy(link, 'Link')}>
                <Copy /> Copy link
              </Button>
            </div>
            <Button variant="link" className="mt-1 px-0" onClick={() => copy(inviteMessage(link, wsName), 'Message')}>
              Copy a ready-to-send message instead
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Sprawniej is running on this computer only, so there's no link to share. Join links appear here in the published app.</p>
        )}
      </div>
    </div>
  )
}

function Account() {
  const user = useSession((s) => s.user)
  const close = useSession((s) => s.close)
  const [unsaved, setUnsaved] = useState(false)
  const [busy, setBusy] = useState(false)

  async function signOut(force = false) {
    setBusy(true)
    const ws = workspace()
    if (ws?.hasUnsaved && !force) {
      await ws.flush()
      if (ws.hasUnsaved) {
        setBusy(false)
        setUnsaved(true)
        return
      }
    }
    await signOutEverywhere()
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <PersonAvatar person={user ?? undefined} className="size-12 text-base" />
        <div>
          <div className="font-semibold">{user?.name}</div>
          <div className="text-muted-foreground">@{user?.login}</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="lg" onClick={close}>
          <Repeat /> Switch workspace
        </Button>
        <Button variant="outline" size="lg" disabled={busy} onClick={() => void signOut()}>
          {busy ? <Loader2 className="animate-spin" /> : <LogOut />} Sign out
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">Signing out removes your GitHub key and the workspace copy from this browser. Do it on shared computers.</p>
      <Dialog open={unsaved} onOpenChange={setUnsaved}>
        <DialogContent>
          <DialogTitle>Some changes haven't been saved to GitHub yet</DialogTitle>
          <DialogDescription>You seem to be offline. If you sign out now, those changes are lost. Connect to the internet and wait for "Saved" first.</DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnsaved(false)}>
              Stay signed in
            </Button>
            <Button variant="destructive" onClick={() => void signOut(true)}>
              Sign out anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function SettingsPage() {
  const repo = useSession((s) => s.workspace)
  useCrumbs([{ label: 'Settings' }])
  return (
    <div className="flex-1 overflow-y-auto px-8">
      <div className="mx-auto max-w-3xl py-4">
        <Section title="Workspace">
          <WorkspaceName />
          {repo && (
            <a href={`https://github.com/${repoKey(repo)}`} target="_blank" rel="noreferrer" className="mt-3 flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              Stored on GitHub in {repoKey(repo)} <ExternalLink className="size-3.5" />
            </a>
          )}
        </Section>
        <Section title="People" description="Everyone here can see and change every issue in the workspace.">
          <People />
        </Section>
        <Section title="Your account">
          <Account />
        </Section>
      </div>
    </div>
  )
}
