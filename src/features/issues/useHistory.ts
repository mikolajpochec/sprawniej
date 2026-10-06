/**
 * Loads an issue's history (src/data/history.ts) when its page opens, and again after its changes are saved.
 * Kept per issue while the app is open, so going back to an issue shows its history at once.
 */
import { useEffect, useRef, useState } from 'react'
import { issueEvents, type HistoryEvent, type Version } from '@/data/history'
import { paths } from '@/data/files'
import type { Issue } from '@/model/schema'
import { useSync, workspace } from '@/sync/engine'

/** `complete`: loaded after the issue's latest change was saved, so nothing is missing */
const cache = new Map<string, { updatedAt: string; complete: boolean; events: HistoryEvent[] }>()

/** a move shows up as the oldest save in the new place, "Move ENG-3 to Design as DES-7" */
const MOVED_FROM = /^Move ([A-Z][A-Z0-9]*)-\d+ to /

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** the "last changed" time in a version of an issue file */
const savedAt = (text: string | null | undefined) => /^updatedAt: ['"]?([^'"\n]+)/m.exec(text ?? '')?.[1]

/** `latest`: the issue was just saved, so GitHub's newest version should be this one (it can take a moment) */
async function load(issue: Issue, latest: boolean): Promise<HistoryEvent[]> {
  const ws = workspace()
  if (!ws) return []
  const versions: Version[] = []
  let path = paths.issue(issue)
  // follow the issue back through moves between teams (a few at most)
  for (let hop = 0; hop < 4; hop++) {
    let found = (await ws.history(path)).map((v) => ({ ...v, path }))
    for (let retry = 0; latest && hop === 0 && retry < 4 && savedAt(found[0]?.text) !== issue.updatedAt; retry++) {
      await wait(1500 * (retry + 1))
      found = (await ws.history(path)).map((v) => ({ ...v, path }))
    }
    versions.push(...found)
    const from = MOVED_FROM.exec(found.at(-1)?.message ?? '')?.[1]
    if (!from || found.length >= 100) break
    const older = paths.issue({ team: from, id: issue.id })
    if (older === path) break
    path = older
  }
  return issueEvents(versions)
}

export function useIssueHistory(issue: Issue): { events: HistoryEvent[] | null; failed: boolean } {
  // the cache holds the history; this only redraws once a load finishes
  const [, redraw] = useState(0)
  const [failed, setFailed] = useState<string | null>(null)
  const saved = useSync((s) => s.state === 'saved')
  const latest = useRef(issue)
  useEffect(() => {
    latest.current = issue
  })
  const { id, updatedAt } = issue
  useEffect(() => {
    const known = cache.get(id)
    if (known && known.updatedAt === updatedAt && known.complete) return
    // wait until the latest change reached GitHub, then a moment more
    if (!saved && known) return
    let stale = false
    const t = setTimeout(
      () =>
        void load(latest.current, saved && !!known).then(
          (events) => {
            cache.set(id, { updatedAt, complete: saved, events })
            if (!stale) redraw((n) => n + 1)
          },
          () => !stale && setFailed(id),
        ),
      known ? 1000 : 0,
    )
    return () => {
      stale = true
      clearTimeout(t)
    }
  }, [id, updatedAt, saved])
  return { events: cache.get(id)?.events ?? null, failed: failed === id }
}
