/**
 * Pictures pasted into descriptions and comments live in the workspace as `assets/<hash>.<ext>` and are written as
 * `![name](/assets/<hash>.png)` in the Markdown (GitHub shows them too). A private workspace's pictures can't be
 * loaded from GitHub by address, so the app shows them from its own copy of the files.
 */
import { BINARY_PREFIX } from '@/github/api'
import { workspace } from '@/sync/engine'

const TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }
const urls = new Map<string, string>()

export const assetPath = (src: string) => (/^\/?assets\/[\w-]+\.(png|jpg|gif|webp)$/.test(src) ? src.replace(/^\//, '') : null)

/** what an <img> should load for `src`: our own copy for workspace pictures, the address itself for others */
export function assetUrl(src: string | null | undefined): string | undefined {
  if (!src) return undefined
  const path = assetPath(src)
  if (!path) return src
  const known = urls.get(path)
  if (known) return known
  const text = workspace()?.read(path)
  if (!text?.startsWith(BINARY_PREFIX)) return undefined
  const bytes = Uint8Array.from(atob(text.slice(BINARY_PREFIX.length)), (c) => c.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: TYPES[path.split('.').pop()!] }))
  urls.set(path, url)
  return url
}
