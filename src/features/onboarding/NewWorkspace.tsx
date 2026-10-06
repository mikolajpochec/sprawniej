/** Create a workspace: a new private repository under you or one of your organizations. */
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { createRepo, GitHubError, listMyOrgs, type Org } from '@/github/api'
import { useSession } from '@/session'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Problem, Step } from './Step'
import { rememberWorkspaceName } from './setupDraft'

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export function NewWorkspace({ onBack }: { onBack: () => void }) {
  const { token, user, open } = useSession()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [owner, setOwner] = useState(user?.login ?? '')
  const [name, setName] = useState('')
  const [repo, setRepo] = useState('')
  const [repoTouched, setRepoTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string>()

  useEffect(() => {
    listMyOrgs(token).then(setOrgs, () => {})
  }, [token])

  const repoName = repoTouched ? repo : name.trim() ? `${slug(name)}-sprawniej` : ''

  async function create() {
    if (!user || !name.trim() || !repoName) return
    setBusy(true)
    setProblem(undefined)
    try {
      await createRepo(token, owner, user.login, repoName)
      rememberWorkspaceName(name.trim())
      open({ owner, repo: repoName })
    } catch (e) {
      const msg = (e as Error).message
      setProblem(
        e instanceof GitHubError && e.status === 422
          ? `There's already a repository called ${owner}/${repoName}. Pick another name below.`
          : e instanceof GitHubError && e.status === 403
            ? `You can't create repositories in ${owner}. Ask an admin there, or choose yourself as the owner.`
            : msg,
      )
      setRepoTouched(true)
      setRepo(repoName)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Step
      title="Create a new workspace"
      footer={
        <>
          <Button size="lg" disabled={busy || !name.trim() || !repoName} onClick={() => void create()}>
            {busy && <Loader2 className="animate-spin" />} Create workspace
          </Button>
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault()
          void create()
        }}
      >
        <div>
          <label htmlFor="ws-name" className="mb-1.5 block text-sm font-medium">
            Workspace name
          </label>
          <Input id="ws-name" className="h-10" autoFocus placeholder="Software Mansion" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="ws-owner" className="mb-1.5 block text-sm font-medium">
            Who owns it on GitHub
          </label>
          <select id="ws-owner" value={owner} onChange={(e) => setOwner(e.target.value)} className="h-10 w-full rounded-md border bg-input/30 px-3 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
            {user && <option value={user.login}>You (@{user.login})</option>}
            {orgs.map((o) => (
              <option key={o.login} value={o.login}>
                {o.login}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ws-repo" className="mb-1.5 block text-sm font-medium">
            Repository name
          </label>
          <Input
            id="ws-repo"
            className="h-10 font-mono"
            value={repoName}
            onChange={(e) => {
              setRepoTouched(true)
              setRepo(slug(e.target.value) || e.target.value)
            }}
          />
          <p className="mt-1.5 text-sm text-muted-foreground">A new private repository where the workspace is stored. Only people you invite can see it.</p>
        </div>
        <Problem>{problem}</Problem>
        <button type="submit" hidden />
      </form>
    </Step>
  )
}
