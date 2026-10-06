/** Join links: #/join/<owner>/<repo>?ws=<workspace name>&by=<who invited you> */
import { publicAppUrl } from '@/config'
import type { RepoRef } from '@/github/api'

/** null while the app runs on this computer (see config.ts) */
export function joinLink(repo: RepoRef, workspaceName?: string, by?: string): string | null {
  const base = publicAppUrl()
  if (!base) return null
  const q = new URLSearchParams()
  if (workspaceName) q.set('ws', workspaceName)
  if (by) q.set('by', by)
  const query = q.toString()
  return `${base}#/join/${repo.owner}/${repo.repo}${query ? `?${query}` : ''}`
}

/** the message the owner sends along with the link */
export function inviteMessage(link: string, workspaceName: string): string {
  return `Hi! We keep track of our work in Sprawniej. Open this link to join ${workspaceName}; it walks you through everything in a few minutes:\n${link}`
}

export function readJoinLink(hash: string): { repo: RepoRef; ws?: string; by?: string } | null {
  const m = /^#?\/join\/([\w.-]+)\/([\w.-]+)(?:\?(.*))?$/.exec(hash)
  if (!m) return null
  const q = new URLSearchParams(m[3] ?? '')
  return { repo: { owner: m[1], repo: m[2] }, ws: q.get('ws') ?? undefined, by: q.get('by') ?? undefined }
}
