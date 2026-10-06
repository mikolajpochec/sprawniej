/**
 * What to show before the app itself: the join wizard, sign-in, choosing a workspace, downloading it, or setting
 * it up. Once a workspace is open, the app (children) takes over.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'wouter'
import { Loader2 } from 'lucide-react'
import { GitHubError, isOffline, listPeople, repoKey } from '@/github/api'
import { introduceMe, tidyInbox } from '@/data/actions'
import { setCollaborators } from '@/data/project'
import { useData } from '@/data/store'
import { JoinWizard } from '@/features/onboarding/JoinWizard'
import { KeyStep } from '@/features/onboarding/KeyStep'
import { PickWorkspace } from '@/features/onboarding/PickWorkspace'
import { SetupWorkspace } from '@/features/onboarding/SetupWorkspace'
import { Problem, Step } from '@/features/onboarding/Step'
import { Welcome } from '@/features/onboarding/Welcome'
import { setWorkspace, useSync, workspace, Workspace } from '@/sync/engine'
import { useSession } from '@/session'
import { Button } from '@/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/ui/dialog'

type Load = { state: 'loading' } | { state: 'ready' } | { state: 'failed'; message: string; noAccess?: boolean }

function OpenWorkspace({ children }: { children: ReactNode }) {
  const repo = useSession((s) => s.workspace)
  const user = useSession((s) => s.user)
  // a fresh component per workspace and person, so nothing from the last one lingers
  return (
    <Loader key={`${repo ? repoKey(repo) : ''}:${user?.login ?? ''}`}>{children}</Loader>
  )
}

function Loader({ children }: { children: ReactNode }) {
  const { token, user, workspace: repo, close } = useSession()
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const progress = useSync((s) => s.progress)
  const hasWorkspaceFile = useData((s) => !!s.workspace)
  useEffect(() => {
    if (!repo || !user) return
    let stop = false
    Workspace.open(repo, token, user).then(
      (ws) => {
        if (stop) return ws.close()
        setWorkspace(ws)
        setLoad({ state: 'ready' })
        listPeople(token, repo).then(
          (list) => setCollaborators(list.map((c) => ({ login: c.login, githubId: c.id, name: c.login, avatarUrl: c.avatar_url }))),
          () => {},
        )
      },
      (e: unknown) => {
        if (stop) return
        if (e instanceof GitHubError && e.status === 404) setLoad({ state: 'failed', noAccess: true, message: `You don't have access to ${repoKey(repo)}, or it doesn't exist.` })
        else if (isOffline(e)) setLoad({ state: 'failed', message: 'You seem to be offline, and this workspace hasn’t been opened on this device before.' })
        else setLoad({ state: 'failed', message: (e as Error).message })
      },
    )
    return () => {
      stop = true
      setWorkspace(null)
    }
  }, [repo, token, user])

  // keep your people/ file in step with your GitHub profile, and old inbox notes from piling up
  useEffect(() => {
    if (load.state !== 'ready' || !hasWorkspaceFile || !user) return
    introduceMe(user)
    tidyInbox()
  }, [load.state, hasWorkspaceFile, user])

  if (load.state === 'loading') {
    return (
      <Step title="Opening your workspace…">
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> {progress ?? 'Just a moment.'}
        </p>
      </Step>
    )
  }
  if (load.state === 'failed') {
    return (
      <Step title="We couldn't open this workspace" footer={<Button onClick={close}>Choose another workspace</Button>}>
        <Problem>{load.message}</Problem>
        {load.noAccess && <p className="mt-4 text-muted-foreground">If someone invited you, open the join link they sent you.</p>}
      </Step>
    )
  }
  if (!hasWorkspaceFile) return <SetupWorkspace hasOtherFiles={(workspace()?.paths().length ?? 0) > 0} />
  return (
    <>
      {children}
      <BadKeyDialog />
    </>
  )
}

/** the key was revoked or expired: ask for a new one without leaving the page (nothing unsaved is lost) */
function BadKeyDialog() {
  const bad = useSync((s) => s.state === 'bad-key')
  const signIn = useSession((s) => s.signIn)
  return (
    <Dialog open={bad}>
      <DialogContent className="sm:max-w-2xl" showCloseButton={false}>
        <DialogTitle>Your GitHub key stopped working</DialogTitle>
        <DialogDescription>Keys expire after a while. Make a new one and paste it below. Your changes are safe on this device and will be saved once you do.</DialogDescription>
        <KeyStep
          intro={<></>}
          onDone={(token, me) => {
            signIn(token, me)
            workspace()?.restartOtherTabs() // they pick up the new key too
            location.reload()
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

export function Gate({ children }: { children: ReactNode }) {
  const [loc] = useLocation()
  const { token, user, workspace: repo } = useSession()
  if (loc.startsWith('/join/')) return <JoinWizard />
  if (!token || !user) return <Welcome />
  if (!repo) return <PickWorkspace />
  return <OpenWorkspace>{children}</OpenWorkspace>
}
