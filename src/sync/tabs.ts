/**
 * The same workspace open in several tabs. Only one tab, the "leader", talks to GitHub: it pulls, saves and keeps the
 * browser copy. The other tabs send their changes to it and show what it tells them. When the leader tab closes,
 * the next tab in line takes over.
 *
 * The leader is whoever holds a Web Lock named after the workspace. Tabs talk over a BroadcastChannel.
 * Browsers without either just let every tab lead on its own (the way it worked before).
 */
import type { SyncStatus } from './engine'

export type TabMsg =
  /** a new tab asks the leader for everything */
  | { t: 'hello'; from: string }
  /** every file as the leader sees it; `to` = only for that tab, none = for everyone (a new leader) */
  | { t: 'all'; to?: string; files: [string, string][]; status: SyncStatus }
  /** files changed; `ack` = this includes that tab's change */
  | { t: 'files'; files: [string, string | null][]; ack?: { tab: string; seq: number } }
  /** a follower's change: each file as it was when the change started, and as it is now */
  | { t: 'write'; from: string; seq: number; files: [path: string, before: string | null, after: string | null][]; message: string }
  | { t: 'status'; status: SyncStatus }
  /** someone is looking at a follower tab: check for teammates' changes */
  | { t: 'sync' }
  /** a follower tab is being hidden or closed: save now */
  | { t: 'flush' }
  /** signed out, or a new GitHub key: every tab starts over */
  | { t: 'restart' }

export class Tabs {
  readonly id = crypto.randomUUID()
  private channel: BroadcastChannel | null = null
  private release: (() => void) | undefined
  private abort = new AbortController()
  onMessage: (m: TabMsg) => void = () => {}

  private name: string

  constructor(key: string) {
    this.name = `sprawniej-sync:${key.toLowerCase()}`
    if (typeof BroadcastChannel !== 'undefined' && typeof navigator !== 'undefined' && navigator.locks) {
      this.channel = new BroadcastChannel(this.name)
      this.channel.onmessage = (e: MessageEvent<TabMsg>) => this.onMessage(e.data)
    }
  }

  /**
   * Try to lead. Resolves true at once if this tab leads now. Otherwise false, and `onLead` runs later if this tab
   * takes over.
   */
  lead(onLead: () => void): Promise<boolean> {
    if (!this.channel) return Promise.resolve(true)
    const hold = () => new Promise<void>((r) => (this.release = r))
    return new Promise((resolve) => {
      void navigator.locks.request(this.name, { ifAvailable: true }, (lock) => {
        if (lock) {
          resolve(true)
          return hold()
        }
        resolve(false)
        navigator.locks
          .request(this.name, { signal: this.abort.signal }, () => {
            onLead()
            return hold()
          })
          .catch(() => {}) // closed while waiting in line
        return undefined
      })
    })
  }

  post(m: TabMsg) {
    this.channel?.postMessage(m)
  }

  close() {
    this.abort.abort()
    this.release?.()
    this.channel?.close()
    this.channel = null
  }
}
