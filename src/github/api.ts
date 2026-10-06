/**
 * Everything Sprawniej asks GitHub, in one place. GitHub's REST and GraphQL APIs allow calls from a web page,
 * so there is no proxy. Error messages are written for people, because some of them reach the screen.
 */

const API = 'https://api.github.com'
const VERSION = '2022-11-28'

export class GitHubError extends Error {
  status: number
  /** GitHub asked us to wait: don't call again before this time (ms since 1970) */
  retryAt?: number
  constructor(status: number, message: string, retryAt?: number) {
    super(message)
    this.name = 'GitHubError'
    this.status = status
    this.retryAt = retryAt
  }
}

/** When GitHub says "too many requests", when may we call again? undefined = it isn't that kind of error. */
export function retryAtFrom(status: number, headers: Headers, message: string, now = Date.now()): number | undefined {
  if (status !== 403 && status !== 429) return undefined
  const after = Number(headers.get('retry-after'))
  if (after > 0) return now + after * 1000
  if (headers.get('x-ratelimit-remaining') === '0') {
    const reset = Number(headers.get('x-ratelimit-reset'))
    return reset > 0 ? Math.max(reset * 1000, now + 1000) : now + 60_000
  }
  // the "secondary" limit (too many saves in a short time) sometimes comes without headers: wait a minute
  if (/rate limit/i.test(message)) return now + 60_000
  return undefined
}

/** GitHub refused the key: it was revoked, expired or mistyped */
export const isBadKey = (e: unknown) => e instanceof GitHubError && e.status === 401
/** no network (fetch itself failed) */
export const isOffline = (e: unknown) => e instanceof TypeError || (typeof navigator !== 'undefined' && !navigator.onLine)

interface ReqOpts {
  body?: unknown
  /** extra headers, e.g. If-None-Match */
  headers?: Record<string, string>
}

export async function request<T>(token: string, method: string, path: string, opts: ReqOpts = {}): Promise<{ data: T; res: Response }> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': VERSION, ...opts.headers }
  if (token) headers.Authorization = `Bearer ${token}`
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  // no-store: the browser cache would otherwise serve a ref up to 60 s old and hide teammates' changes
  const res = await fetch(path.startsWith('http') ? path : `${API}${path}`, {
    method,
    headers,
    cache: 'no-store',
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  })
  if (res.status === 304) return { data: undefined as T, res }
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`
    try {
      const j = (await res.json()) as { message?: string }
      if (j.message) msg = j.message
    } catch {
      /* no body */
    }
    if (res.status === 401) msg = 'GitHub doesn’t accept this key anymore.'
    const retryAt = retryAtFrom(res.status, res.headers, msg)
    if (retryAt) msg = 'GitHub asked us to slow down for a moment.'
    throw new GitHubError(res.status, msg, retryAt)
  }
  const data = res.status === 204 ? (undefined as T) : ((await res.json()) as T)
  return { data, res }
}

const get = async <T>(token: string, path: string) => (await request<T>(token, 'GET', path)).data

// ---------- you ----------

export interface GitHubUser {
  login: string
  id: number
  name: string | null
  avatar_url: string
}

export interface KeyCheck {
  user: GitHubUser
  /** the key has the classic `repo` scope */
  hasRepoScope: boolean
}

/** Who owns this key, and can it reach private repos? */
export async function checkKey(token: string): Promise<KeyCheck> {
  const { data, res } = await request<GitHubUser>(token, 'GET', '/user')
  const scopes = (res.headers.get('x-oauth-scopes') ?? '').split(',').map((s) => s.trim())
  return { user: data, hasRepoScope: scopes.includes('repo') }
}

export const SIGN_UP_URL = 'https://github.com/signup'
export const MAKE_KEY_URL = 'https://github.com/settings/tokens/new?scopes=repo&description=Sprawniej'

// ---------- repos ----------

export interface RepoRef {
  owner: string
  repo: string
}

export const repoKey = (r: RepoRef) => `${r.owner}/${r.repo}`

export function parseRepo(input: string): RepoRef | null {
  const m = /^(?:https?:\/\/(?:www\.)?github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i.exec(input.trim())
  return m ? { owner: m[1], repo: m[2] } : null
}

export interface RepoInfo {
  name: string
  full_name: string
  owner: { login: string; avatar_url: string }
  private: boolean
  default_branch: string
  permissions?: { admin?: boolean; push?: boolean; pull?: boolean }
  size: number
  updated_at: string
}

export const getRepo = (token: string, r: RepoRef) => get<RepoInfo>(token, `/repos/${r.owner}/${r.repo}`)

/** repos you can push to, most recently changed first */
export async function listMyRepos(token: string): Promise<RepoInfo[]> {
  const out: RepoInfo[] = []
  for (let page = 1; page <= 5; page++) {
    const batch = await get<RepoInfo[]>(token, `/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`)
    out.push(...batch.filter((r) => r.permissions?.push))
    if (batch.length < 100) break
  }
  return out
}

export interface Org {
  login: string
  avatar_url: string
}

export const listMyOrgs = (token: string) => get<Org[]>(token, '/user/orgs?per_page=100')

/** a new private, empty repo under you (owner = your login) or one of your organizations */
export async function createRepo(token: string, owner: string, me: string, name: string): Promise<RepoInfo> {
  const path = owner === me ? '/user/repos' : `/orgs/${owner}/repos`
  const body = { name, private: true, description: 'Sprawniej workspace', has_issues: false, has_wiki: false, has_projects: false, auto_init: false }
  return (await request<RepoInfo>(token, 'POST', path, { body })).data
}

// ---------- people and invitations ----------

export interface Collaborator {
  login: string
  id: number
  avatar_url: string
}

/** everyone who can be given an issue in this repo = everyone with access */
export async function listPeople(token: string, r: RepoRef): Promise<Collaborator[]> {
  const out: Collaborator[] = []
  for (let page = 1; page <= 10; page++) {
    const batch = await get<Collaborator[]>(token, `/repos/${r.owner}/${r.repo}/assignees?per_page=100&page=${page}`)
    out.push(...batch)
    if (batch.length < 100) break
  }
  return out
}

/** Invite a GitHub user (needs admin rights on the repo). 'invited' = they must accept; 'member' = they already have access. */
export async function invite(token: string, r: RepoRef, login: string): Promise<'invited' | 'member'> {
  const { res } = await request<unknown>(token, 'PUT', `/repos/${r.owner}/${r.repo}/collaborators/${encodeURIComponent(login)}`, { body: { permission: 'push' } })
  return res.status === 201 ? 'invited' : 'member'
}

export interface SentInvitation {
  id: number
  invitee: { login: string; avatar_url: string } | null
  created_at: string
}

export const listSentInvitations = (token: string, r: RepoRef) => get<SentInvitation[]>(token, `/repos/${r.owner}/${r.repo}/invitations?per_page=100`)

export interface MyInvitation {
  id: number
  repository: { full_name: string; name: string; owner: { login: string; avatar_url: string } }
  inviter: { login: string } | null
}

/** invitations to repos waiting for you to accept */
export const listMyInvitations = (token: string) => get<MyInvitation[]>(token, '/user/repository_invitations?per_page=100')

/** Accept your pending invitation to this repo, if there is one. Returns true when one was accepted. */
export async function acceptInvitation(token: string, r: RepoRef): Promise<boolean> {
  const mine = await listMyInvitations(token)
  const inv = mine.find((i) => i.repository.full_name.toLowerCase() === repoKey(r).toLowerCase())
  if (!inv) return false
  await request(token, 'PATCH', `/user/repository_invitations/${inv.id}`)
  return true
}

// ---------- git data ----------

export interface TreeItem {
  path: string
  mode: string
  type: 'blob' | 'tree' | 'commit'
  sha: string
  size?: number
}

/** sha of the branch head; null when the repo is still empty. `etag` lets "nothing new" cost no rate limit. */
export async function getHead(token: string, r: RepoRef, branch: string, etag?: string): Promise<{ sha: string | null; etag?: string; unchanged?: boolean }> {
  try {
    const { data, res } = await request<{ object: { sha: string } }>(token, 'GET', `/repos/${r.owner}/${r.repo}/git/ref/heads/${encodeURIComponent(branch)}`, {
      headers: etag ? { 'If-None-Match': etag } : undefined,
    })
    if (res.status === 304) return { sha: null, etag, unchanged: true }
    return { sha: data.object.sha, etag: res.headers.get('etag') ?? undefined }
  } catch (e) {
    if (e instanceof GitHubError && (e.status === 404 || e.status === 409)) return { sha: null }
    throw e
  }
}

export const getCommit = (token: string, r: RepoRef, sha: string) =>
  get<{ sha: string; tree: { sha: string }; parents: { sha: string }[] }>(token, `/repos/${r.owner}/${r.repo}/git/commits/${sha}`)

/** every file in a commit's tree */
export async function getFiles(token: string, r: RepoRef, treeSha: string): Promise<TreeItem[]> {
  const t = await get<{ tree: TreeItem[]; truncated: boolean }>(token, `/repos/${r.owner}/${r.repo}/git/trees/${treeSha}?recursive=1`)
  if (t.truncated) throw new Error('This workspace has too many files for GitHub to list at once.')
  return t.tree.filter((e) => e.type === 'blob')
}

export interface CompareFile {
  filename: string
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged'
  sha: string
  previous_filename?: string
}

/**
 * Files that changed from `base` to `head`. Null when GitHub can't say exactly (history was rewritten, or more
 * than 300 files changed); the caller then compares whole file lists instead.
 */
export async function compare(token: string, r: RepoRef, base: string, head: string): Promise<CompareFile[] | null> {
  const c = await get<{ status: string; files?: CompareFile[] }>(token, `/repos/${r.owner}/${r.repo}/compare/${base}...${head}?per_page=300`)
  if (c.status !== 'ahead' && c.status !== 'identical') return null
  if (!c.files || c.files.length >= 300) return null
  return c.files
}

/** Download file contents by blob sha, up to 100 per request (GraphQL). Binary files come back as base64 via REST. */
export async function getBlobs(token: string, r: RepoRef, shas: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  for (let i = 0; i < shas.length; i += 100) {
    const chunk = shas.slice(i, i + 100)
    const fields = chunk.map((sha, j) => `b${j}: object(oid: "${sha}") { ... on Blob { text isBinary isTruncated } }`).join('\n')
    const query = `query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { ${fields} } }`
    const { data } = await request<{ data?: { repository: Record<string, { text: string | null; isBinary: boolean; isTruncated: boolean } | null> }; errors?: { message: string }[] }>(
      token,
      'POST',
      '/graphql',
      { body: { query, variables: { owner: r.owner, name: r.repo } } },
    )
    if (!data.data) throw new Error(data.errors?.[0]?.message ?? 'GitHub couldn’t send the files.')
    for (const [j, sha] of chunk.entries()) {
      const b = data.data.repository[`b${j}`]
      if (b && !b.isBinary && !b.isTruncated && b.text !== null) out.set(sha, b.text)
      else out.set(sha, await getBlobBase64(token, r, sha))
    }
  }
  return out
}

/** a binary file, marked with a prefix so it is never mistaken for text */
export const BINARY_PREFIX = 'base64:'

async function getBlobBase64(token: string, r: RepoRef, sha: string): Promise<string> {
  const b = await get<{ content: string }>(token, `/repos/${r.owner}/${r.repo}/git/blobs/${sha}`)
  return BINARY_PREFIX + b.content.replace(/\s/g, '')
}

export interface NewTreeEntry {
  path: string
  /** text content, or null to delete the file */
  content: string | null
}

/** One new tree: `base` plus these changes. Binary files (BINARY_PREFIX) are uploaded first. */
export async function createTree(token: string, r: RepoRef, baseTree: string | null, entries: NewTreeEntry[]): Promise<string> {
  const tree = []
  for (const e of entries) {
    if (e.content === null) tree.push({ path: e.path, mode: '100644', type: 'blob', sha: null })
    else if (e.content.startsWith(BINARY_PREFIX)) {
      const { data } = await request<{ sha: string }>(token, 'POST', `/repos/${r.owner}/${r.repo}/git/blobs`, {
        body: { content: e.content.slice(BINARY_PREFIX.length), encoding: 'base64' },
      })
      tree.push({ path: e.path, mode: '100644', type: 'blob', sha: data.sha })
    } else tree.push({ path: e.path, mode: '100644', type: 'blob', content: e.content })
  }
  const body = baseTree ? { base_tree: baseTree, tree } : { tree }
  return (await request<{ sha: string }>(token, 'POST', `/repos/${r.owner}/${r.repo}/git/trees`, { body })).data.sha
}

export interface Author {
  name: string
  email: string
}

export async function createCommit(token: string, r: RepoRef, message: string, tree: string, parents: string[], author: Author): Promise<string> {
  const date = new Date().toISOString()
  const body = { message, tree, parents, author: { ...author, date }, committer: { ...author, date } }
  return (await request<{ sha: string }>(token, 'POST', `/repos/${r.owner}/${r.repo}/git/commits`, { body })).data.sha
}

/** someone else saved first: fetch, merge, try again */
export class NotFastForward extends Error {
  constructor() {
    super('Someone else saved first.')
    this.name = 'NotFastForward'
  }
}

/** Move the branch to `sha`. Refuses to overwrite other people's work (NotFastForward). */
export async function moveBranch(token: string, r: RepoRef, branch: string, sha: string): Promise<void> {
  try {
    await request(token, 'PATCH', `/repos/${r.owner}/${r.repo}/git/refs/heads/${encodeURIComponent(branch)}`, { body: { sha, force: false } })
  } catch (e) {
    if (e instanceof GitHubError && e.status === 422 && /fast.?forward/i.test(e.message)) throw new NotFastForward()
    throw e
  }
}

/**
 * The very first file of an empty repo. GitHub's git data API refuses to work on a repo with no commits, but the
 * contents API can create one. Returns the new commit.
 */
export async function createFirstFile(token: string, r: RepoRef, path: string, content: string, message: string, author: Author): Promise<{ commit: string; branch: string }> {
  const bytes = new TextEncoder().encode(content)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  const { data } = await request<{ commit: { sha: string } }>(token, 'PUT', `/repos/${r.owner}/${r.repo}/contents/${path}`, {
    body: { message, content: btoa(bin), author, committer: author },
  })
  const info = await getRepo(token, r)
  return { commit: data.commit.sha, branch: info.default_branch || 'main' }
}

/** the GitHub profile as a Sprawniej person */
export const toPerson = (u: GitHubUser) => ({ login: u.login, githubId: u.id, name: u.name || u.login, avatarUrl: u.avatar_url })
