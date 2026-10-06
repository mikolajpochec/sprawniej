import { BINARY_PREFIX } from '@/github/api'

const enc = new TextEncoder()

/** the id git gives a file's content, so we can tell which files differ from GitHub's without downloading them */
export async function blobSha(text: string): Promise<string> {
  const body = text.startsWith(BINARY_PREFIX) ? Uint8Array.from(atob(text.slice(BINARY_PREFIX.length)), (c) => c.charCodeAt(0)) : enc.encode(text)
  const head = enc.encode(`blob ${body.length}\0`)
  const all = new Uint8Array(head.length + body.length)
  all.set(head)
  all.set(body, head.length)
  const d = await crypto.subtle.digest('SHA-1', all)
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
