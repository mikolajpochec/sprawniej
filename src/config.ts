/**
 * Where Sprawniej is published. Join links point here. Set VITE_PUBLIC_URL when building to use your own domain
 * (e.g. VITE_PUBLIC_URL=https://sprawniej.example.com bun run build); otherwise the address the app is served from.
 */
const PUBLIC_URL = (import.meta.env.VITE_PUBLIC_URL as string | undefined)?.trim()

const isLocal = (host: string) => host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.local')

/** The app's public address, ending in "/". Null while running on this computer: such links wouldn't work for anyone else. */
export function publicAppUrl(): string | null {
  if (isLocal(location.hostname)) return null
  if (PUBLIC_URL) return PUBLIC_URL.endsWith('/') ? PUBLIC_URL : `${PUBLIC_URL}/`
  return `${location.origin}${location.pathname}`
}
