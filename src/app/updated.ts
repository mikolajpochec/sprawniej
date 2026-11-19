/**
 * "Sprawniej was updated": a short toast the first time you open the app on a new version, with a way to read what
 * changed. Which version you last saw is remembered in this browser.
 */
import { toast } from 'sonner'
import { APP_VERSION, CHANGELOG } from '@/version'
import { tourDone } from './tourState'

const SEEN = 'sprawniej:version-seen'

export function announceUpdate(go: (to: string) => void) {
  let last: string | null
  try {
    last = localStorage.getItem(SEEN)
    localStorage.setItem(SEEN, APP_VERSION)
  } catch {
    return
  }
  if (last === APP_VERSION) return
  // versions before this toast didn't remember: someone past the first-visit tour has used an older one
  if (last === null && !tourDone()) return
  const now = CHANGELOG.findIndex((r) => r.version === APP_VERSION)
  const before = CHANGELOG.findIndex((r) => r.version === last)
  if (now < 0 || (before >= 0 && before <= now)) return // not newer (an older tab, or going back a version)
  toast(`Sprawniej was updated: ${CHANGELOG[now].title}`, {
    duration: 10_000,
    closeButton: true,
    action: { label: 'What’s changed?', onClick: () => go('/whats-new') },
  })
}
