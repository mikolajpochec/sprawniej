/** Join links: #/join/<owner>/<repo>?ws=<workspace name>&by=<who invited you>&for=<who was invited> */
import { publicAppUrl } from '@/config'
import type { RepoRef } from '@/github/api'

export interface JoinLink {
  repo: RepoRef
  /** the workspace's name */
  ws?: string
  /** who sent the invitation */
  by?: string
  /** the GitHub username that was invited */
  for?: string
}

/** null while the app runs on this computer (see config.ts) */
export function joinLink({ repo, ...rest }: JoinLink): string | null {
  const base = publicAppUrl()
  if (!base) return null
  const q = new URLSearchParams()
  for (const k of ['ws', 'by', 'for'] as const) if (rest[k]) q.set(k, rest[k])
  const query = q.toString()
  return `${base}#/join/${repo.owner}/${repo.repo}${query ? `?${query}` : ''}`
}

/** the message the owner sends along with the link */
export function inviteMessage(link: string, workspaceName: string): string {
  return `Hi! We keep track of our work in Sprawniej. Open this link to join ${workspaceName}; it walks you through everything in a few minutes:\n${link}`
}

export function readJoinLink(hash: string): JoinLink | null {
  const m = /^#?\/join\/([\w.-]+)\/([\w.-]+)(?:\?(.*))?$/.exec(hash)
  if (!m) return null
  const q = new URLSearchParams(m[3] ?? '')
  const get = (k: string) => q.get(k) || undefined
  return { repo: { owner: m[1], repo: m[2] }, ws: get('ws'), by: get('by'), for: get('for') }
}

/** true when the link was made for someone else than the signed-in person */
export function linkIsForSomeoneElse(link: JoinLink, login: string | undefined): boolean {
  return !!link.for && !!login && link.for.toLowerCase() !== login.toLowerCase()
}
