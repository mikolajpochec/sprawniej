/**
 * Keeps this browser's copy of a workspace and GitHub in step. See docs/architecture.md for the full story.
 *
 *   write()  → pending (IndexedDB) → store → save soon
 *   save     → one tree on top of GitHub's latest, one commit, move the branch; if someone saved first: pull, retry
 *   pull     → "anything new?" (free when nothing is) → changed files only → merge with pending → store
 *
 * Only one save or pull runs at a time (`lock`).
 */
import { toast } from 'sonner'
import { create } from 'zustand'
import {
  compare,
  createCommit,
  createFirstFile,
  createTree,
  getBlobs,
  getCommit,
  getFiles,
  getHead,
  getRepo,
  isBadKey,
  isOffline,
  moveBranch,
  NotFastForward,
  type Author,
  type RepoRef,
} from '@/github/api'
import { classify, WORKSPACE_FILE } from '@/data/files'
import { applyFiles, resetProjection } from '@/data/project'
import { EMPTY, issueRef, useData } from '@/data/store'
import type { Person } from '@/model/schema'
import { LocalCopy, type Meta } from './local'
import { mergeFile } from './merge'
import { renumber } from './renumber'
import { blobSha } from './sha'

export type SyncState = 'loading' | 'saved' | 'saving' | 'offline' | 'error' | 'bad-key'

interface SyncStatus {
  state: SyncState
  /** what went wrong, in plain words */
  detail?: string
  /** changes not on GitHub yet */
  pending: number
  /** first download of a workspace: how far along */
  progress?: string
}

export const useSync = create<SyncStatus>()(() => ({ state: 'loading', pending: 0 }))

const SAVE_DELAY = 1500
const PULL_EVERY = 30_000

export class Workspace {
  private local: LocalCopy
  private meta!: Meta
  private base = new Map<string, string>()
  private pending = new Map<string, string | null>()
  private messages: string[] = []
  private etag: string | undefined
  private chain: Promise<unknown> = Promise.resolve()
  private saveTimer: ReturnType<typeof setTimeout> | undefined
  private retryTimer: ReturnType<typeof setTimeout> | undefined
  private retryDelay = 5_000
  private pollTimer: ReturnType<typeof setInterval> | undefined
  private closed = false

  readonly repo: RepoRef
  readonly me: Person
  private token: string

  private constructor(repo: RepoRef, token: string, me: Person) {
    this.repo = repo
    this.token = token
    this.me = me
    this.local = new LocalCopy(repo)
  }

  private get author(): Author {
    return { name: this.me.name || this.me.login, email: `${this.me.githubId}+${this.me.login}@users.noreply.github.com` }
  }

  /** Open a workspace: show the local copy at once, download it first if this browser has none. */
  static async open(repo: RepoRef, token: string, me: Person): Promise<Workspace> {
    const ws = new Workspace(repo, token, me)
    resetProjection()
    useData.setState({ ...EMPTY, me })
    useSync.setState({ state: 'loading', pending: 0, detail: undefined, progress: undefined })
    const snap = await ws.local.load()
    ws.base = snap.base
    ws.pending = snap.pending
    ws.messages = snap.messages
    if (snap.meta) ws.meta = snap.meta
    else await ws.lock(() => ws.download())
    ws.showAll()
    ws.startPolling()
    useSync.setState({ state: ws.pending.size ? 'saving' : 'saved', pending: ws.pending.size, progress: undefined })
    void ws.syncNow()
    return ws
  }

  close() {
    this.closed = true
    clearTimeout(this.saveTimer)
    clearTimeout(this.retryTimer)
    clearInterval(this.pollTimer)
    window.removeEventListener('online', this.onWake)
    window.removeEventListener('focus', this.onWake)
    document.removeEventListener('visibilitychange', this.onVisibility)
  }

  // ---------- reading ----------

  /** the file as you see it: your unsaved version if there is one, else GitHub's */
  read(path: string): string | null {
    if (this.pending.has(path)) return this.pending.get(path) ?? null
    return this.base.get(path) ?? null
  }

  /** every path that currently exists */
  paths(): string[] {
    const all = new Set([...this.base.keys(), ...this.pending.keys()])
    return [...all].filter((p) => this.read(p) !== null)
  }

  get hasUnsaved() {
    return this.pending.size > 0
  }

  private showAll() {
    const files = new Map<string, string | null>()
    for (const p of this.paths()) files.set(p, this.read(p))
    applyFiles(files, this.me.login)
  }

  // ---------- writing ----------

  /** Change files (null = delete). The store updates at once; GitHub gets it about 1.5 s later. */
  write(files: Map<string, string | null>, message: string) {
    for (const [path, text] of files) {
      this.pending.set(path, text)
      void this.local.putPending(path, text)
    }
    if (message && this.messages.at(-1) !== message) {
      this.messages.push(message)
      void this.local.setMessages(this.messages)
    }
    applyFiles(files, this.me.login)
    useSync.setState({ state: navigator.onLine ? 'saving' : 'offline', pending: this.pending.size, detail: undefined })
    this.scheduleSave()
  }

  private scheduleSave(delay = SAVE_DELAY) {
    clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => void this.syncNow(), delay)
  }

  /** save right away (leaving the page, hiding the tab) */
  flush() {
    clearTimeout(this.saveTimer)
    return this.syncNow()
  }

  // ---------- the loop ----------

  private lock<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.chain.then(fn)
    this.chain = run.catch(() => {})
    return run
  }

  /** pull, then save what's pending; reports the outcome in the save chip */
  syncNow(): Promise<void> {
    return this.lock(async () => {
      if (this.closed) return
      clearTimeout(this.retryTimer)
      try {
        if (!navigator.onLine) throw new TypeError('offline')
        await this.pull()
        await this.save()
        this.retryDelay = 5_000
        useSync.setState({ state: this.pending.size ? 'saving' : 'saved', pending: this.pending.size, detail: undefined })
        if (this.pending.size) this.scheduleSave()
      } catch (e) {
        this.report(e)
      }
    })
  }

  private report(e: unknown) {
    if (isBadKey(e)) {
      useSync.setState({ state: 'bad-key', detail: 'Your GitHub key stopped working.' })
      return
    }
    if (isOffline(e)) {
      useSync.setState({ state: 'offline', pending: this.pending.size, detail: undefined })
      return // the 'online' event wakes us up
    }
    console.error('Sprawniej sync', e)
    useSync.setState({ state: 'error', pending: this.pending.size, detail: (e as Error).message })
    this.retryTimer = setTimeout(() => void this.syncNow(), this.retryDelay)
    this.retryDelay = Math.min(this.retryDelay * 2, 120_000)
  }

  private onWake = () => void this.syncNow()
  private onVisibility = () => {
    if (document.visibilityState === 'hidden') void this.flush()
    else void this.syncNow()
  }

  private startPolling() {
    this.pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') void this.syncNow()
    }, PULL_EVERY)
    window.addEventListener('online', this.onWake)
    window.addEventListener('focus', this.onWake)
    document.addEventListener('visibilitychange', this.onVisibility)
  }

  // ---------- download, pull, save ----------

  /** first visit: fetch every file */
  private async download() {
    useSync.setState({ progress: 'Looking up your workspace…' })
    const info = await getRepo(this.token, this.repo)
    const branch = info.default_branch || 'main'
    const head = await getHead(this.token, this.repo, branch)
    this.meta = { branch, head: null, tree: null }
    if (head.sha) {
      const commit = await getCommit(this.token, this.repo, head.sha)
      const files = (await getFiles(this.token, this.repo, commit.tree.sha)).filter((f) => isOurs(f.path))
      useSync.setState({ progress: `Downloading ${files.length} files…` })
      const blobs = await getBlobs(this.token, this.repo, [...new Set(files.map((f) => f.sha))])
      const put = new Map<string, string | null>()
      for (const f of files) {
        this.base.set(f.path, blobs.get(f.sha)!)
        put.set(f.path, blobs.get(f.sha)!)
      }
      await this.local.putBase(put)
      this.meta = { branch, head: head.sha, tree: commit.tree.sha }
      this.etag = head.etag
    }
    await this.local.setMeta(this.meta)
  }

  /** bring in what teammates saved since our base */
  private async pull() {
    const head = await getHead(this.token, this.repo, this.meta.branch, this.etag)
    if (head.unchanged) return
    this.etag = head.etag
    if (!head.sha || head.sha === this.meta.head) return

    const commit = await getCommit(this.token, this.repo, head.sha)
    // which files changed, and their new blob ids (null = removed)
    const changed = new Map<string, string | null>()
    const listed = this.meta.head ? await compare(this.token, this.repo, this.meta.head, head.sha) : null
    if (listed) {
      for (const f of listed) {
        if (f.status === 'renamed' && f.previous_filename) changed.set(f.previous_filename, null)
        changed.set(f.filename, f.status === 'removed' ? null : f.sha)
      }
    } else {
      const remote = new Map((await getFiles(this.token, this.repo, commit.tree.sha)).map((f) => [f.path, f.sha]))
      for (const [p, sha] of remote) if (!this.base.has(p) || (await blobSha(this.base.get(p)!)) !== sha) changed.set(p, sha)
      for (const p of this.base.keys()) if (!remote.has(p)) changed.set(p, null)
    }
    for (const p of [...changed.keys()]) if (!isOurs(p)) changed.delete(p)

    const shas = [...new Set([...changed.values()].filter((s): s is string => !!s))]
    const blobs = shas.length ? await getBlobs(this.token, this.repo, shas) : new Map<string, string>()

    const shown = new Map<string, string | null>()
    const baseUpdate = new Map<string, string | null>()
    const clashes: string[] = []
    for (const [path, sha] of changed) {
      const theirs = sha ? blobs.get(sha)! : null
      const base = this.base.get(path) ?? null
      baseUpdate.set(path, theirs)
      if (this.pending.has(path)) {
        const ours = this.pending.get(path)!
        const m = mergeFile(path, base, ours, theirs)
        if (m.conflict) clashes.push(path)
        if (m.text === theirs) {
          this.pending.delete(path)
          void this.local.dropPending([path])
        } else {
          this.pending.set(path, m.text)
          void this.local.putPending(path, m.text)
        }
        shown.set(path, m.text)
      } else shown.set(path, theirs)
    }
    for (const [p, t] of baseUpdate) {
      if (t === null) this.base.delete(p)
      else this.base.set(p, t)
    }
    this.meta = { ...this.meta, head: head.sha, tree: commit.tree.sha }

    // two new issues with the same number: ours (not on GitHub yet) moves up
    for (const r of renumber(this.base, this.pending)) {
      this.pending.set(r.path, r.text)
      void this.local.putPending(r.path, r.text)
      shown.set(r.path, r.text)
      toast(`${r.team}-${r.from} is now ${r.team}-${r.to}`, { description: 'A teammate created an issue with the same number at the same time.' })
    }

    // show the merged result before anything else can run, so your next edit starts from it
    applyFiles(shown, this.me.login)
    await this.local.putBase(baseUpdate)
    await this.local.setMeta(this.meta)
    if (clashes.length) this.tellAboutClashes(clashes)
  }

  private tellAboutClashes(paths: string[]) {
    const issues = useData.getState().issues
    const names = paths
      .map((p) => {
        const c = classify(p)
        return c?.kind === 'issue' && issues[c.parts[1]] ? issueRef(issues[c.parts[1]]) : null
      })
      .filter(Boolean)
    toast(names.length ? `${names.join(', ')} changed by a teammate at the same time` : 'A teammate changed the same thing at the same time', {
      description: 'Both sets of changes are kept where they don’t overlap. Where they do, yours is kept.',
    })
  }

  /** send pending changes as one commit; retry after a pull when someone saved first */
  private async save() {
    for (let attempt = 0; attempt < 4; attempt++) {
      // drop changes that ended up equal to GitHub's version
      for (const [p, t] of [...this.pending]) {
        if (t === (this.base.get(p) ?? null)) {
          this.pending.delete(p)
          void this.local.dropPending([p])
        }
      }
      if (!this.pending.size) {
        if (this.messages.length) {
          this.messages = []
          void this.local.setMessages([])
        }
        return
      }
      const sent = new Map(this.pending)
      const msgCount = this.messages.length
      const message = commitMessage(this.messages)

      if (!this.meta.head) {
        await this.startRepo(sent)
        continue
      }
      const entries = [...sent].filter(([p, t]) => t !== null || this.base.has(p)).map(([path, content]) => ({ path, content }))
      const tree = await createTree(this.token, this.repo, this.meta.tree, entries)
      const commit = await createCommit(this.token, this.repo, message, tree, [this.meta.head], this.author)
      try {
        await moveBranch(this.token, this.repo, this.meta.branch, commit)
      } catch (e) {
        if (e instanceof NotFastForward) {
          this.etag = undefined
          await this.pull()
          continue
        }
        throw e
      }
      // saved: GitHub now has exactly `sent`
      const baseUpdate = new Map<string, string | null>()
      for (const [p, t] of sent) {
        baseUpdate.set(p, t)
        if (t === null) this.base.delete(p)
        else this.base.set(p, t)
        if (this.pending.get(p) === t) {
          this.pending.delete(p) // unless you kept typing meanwhile
          void this.local.dropPending([p])
        }
      }
      await this.local.putBase(baseUpdate)
      this.meta = { ...this.meta, head: commit, tree }
      this.etag = undefined
      await this.local.setMeta(this.meta)
      this.messages = this.messages.slice(msgCount)
      void this.local.setMessages(this.messages)
      return
    }
    throw new Error('Teammates keep saving at the same moment. We’ll try again shortly.')
  }

  /** An empty repo can't take a tree yet: create sprawniej.json through the contents API first. */
  private async startRepo(sent: Map<string, string | null>) {
    const first = sent.get(WORKSPACE_FILE) ?? `${JSON.stringify({ name: this.repo.repo, format: 1, createdAt: new Date().toISOString() }, null, 2)}\n`
    const r = await createFirstFile(this.token, this.repo, WORKSPACE_FILE, first, 'Create the workspace', this.author)
    this.meta = { branch: r.branch, head: null, tree: null }
    this.etag = undefined
    // pull it in like any teammate's change, so base and meta are right
    const head = await getHead(this.token, this.repo, r.branch)
    const commit = await getCommit(this.token, this.repo, head.sha ?? r.commit)
    this.base.set(WORKSPACE_FILE, first)
    await this.local.putBase(new Map([[WORKSPACE_FILE, first]]))
    this.meta = { branch: r.branch, head: commit.sha, tree: commit.tree.sha }
    await this.local.setMeta(this.meta)
  }

  /** forget this browser's copy (signing out) */
  async wipe() {
    this.close()
    await this.local.wipe()
  }
}

/** files Sprawniej manages; anything else in the repo (README, .github…) is left alone */
const isOurs = (path: string) => classify(path) !== null || path.startsWith('assets/')

function commitMessage(messages: string[]): string {
  const unique = [...new Set(messages)]
  if (!unique.length) return 'Update the workspace'
  if (unique.length === 1) return unique[0]
  const more = unique.length - 1
  return `${unique[0]} (and ${more} more change${more === 1 ? '' : 's'})\n\n${unique.map((m) => `- ${m}`).join('\n')}\n`
}

// ---------- the open workspace ----------

let current: Workspace | null = null

export const workspace = () => current
export function setWorkspace(ws: Workspace | null) {
  current?.close()
  current = ws
}
