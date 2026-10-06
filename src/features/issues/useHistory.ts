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

/** the save that moved this issue here: "Move ENG-3 to Design as DES-7", alone or as one line of a bigger save */
export const movedFrom = (message: string, ref: string) =>
  new RegExp(`^(?:- )?Move ([A-Z][A-Z0-9]*)-\\d+ to .+ as ${ref}$`, 'm').exec(message)?.[1]

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
/** the "last changed" time in a version of an issue file */
const savedAt = (text: string | null | undefined) => /^updatedAt: ['"]?([^'"\n]+)/m.exec(text ?? '')?.[1]
const numberIn = (text: string | null | undefined) => /^number: (\d+)/m.exec(text ?? '')?.[1]

/** `latest`: the issue was just saved, so GitHub's newest version should be this one (it can take a moment) */
async function load(issue: Issue, latest: boolean): Promise<HistoryEvent[]> {
  const ws = workspace()
  if (!ws) return []
  // oldest first: each path's saves in GitHub's order (newest first, so reversed), older paths before newer ones
  const versions: Version[] = []
  let path = paths.issue(issue)
  let team = issue.team
  // follow the issue back through moves between teams (a few at most)
  for (let hop = 0; hop < 4; hop++) {
    let found = (await ws.history(path)).map((v) => ({ ...v, path }))
    // an archived issue's newest save is the one that took its file away
    const isNewest = (v: Version | undefined) => ('archivedAt' in issue ? v?.text === null : savedAt(v?.text) === issue.updatedAt)
    for (let retry = 0; latest && hop === 0 && retry < 4 && !isNewest(found[0]); retry++) {
      await wait(1500 * (retry + 1))
      found = (await ws.history(path)).map((v) => ({ ...v, path }))
    }
    versions.unshift(...found.reverse())
    const oldest = found[0]
    const ref = `${team}-${numberIn(oldest?.text) ?? issue.number}`
    const from = oldest && movedFrom(oldest.message, ref)
    if (!from || found.length >= 100) break
    const older = paths.issue({ team: from, id: issue.id })
    if (older === path) break
    path = older
    team = from
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
  const { id } = issue
  // archiving and restoring are saves too, though "last changed" stays
  const updatedAt = `${issue.updatedAt}${'archivedAt' in issue ? ' archived' : ''}`
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
