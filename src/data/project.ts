/**
 * Files → store. When files change (loaded at start, edited here, or arriving from teammates) we parse just
 * those files and update the store. A file that can't be read is skipped with a warning.
 */
import type { Comment, Person } from '@/model/schema'
import { parseFile, type Parsed } from './files'
import { useData, type DataState } from './store'

/** what each path held last time, so a deleted or changed file can be taken out of the store */
const index = new Map<string, Parsed>()

/** people GitHub says have access but who haven't opened the workspace yet (no people/ file) */
let collaborators: Record<string, Person> = {}

export function resetProjection() {
  index.clear()
  collaborators = {}
}

type Draft = Pick<DataState, 'workspace' | 'people' | 'labels' | 'teams' | 'issues' | 'projects' | 'views' | 'comments' | 'inbox' | 'readState'>

function remove(d: Draft, p: Parsed) {
  switch (p.kind) {
    case 'workspace':
      d.workspace = null
      break
    case 'person':
      delete d.people[p.value.login]
      if (collaborators[p.value.login]) d.people[p.value.login] = collaborators[p.value.login]
      break
    case 'label':
      delete d.labels[p.value.id]
      break
    case 'team':
      delete d.teams[p.value.key]
      break
    case 'issue':
      delete d.issues[p.value.id]
      break
    case 'comment': {
      const list = (d.comments[p.value.issue] ?? []).filter((c) => c.id !== p.value.id)
      if (list.length) d.comments[p.value.issue] = list
      else delete d.comments[p.value.issue]
      break
    }
    case 'project':
      delete d.projects[p.value.id]
      break
    case 'view':
      delete d.views[p.value.id]
      break
    case 'inbox':
      d.inbox = d.inbox.filter((n) => n.id !== p.value.id)
      break
    case 'readState':
      d.readState = { readUntil: null, read: [] }
      break
  }
}

function add(d: Draft, p: Parsed, me: string | null) {
  switch (p.kind) {
    case 'workspace':
      d.workspace = p.value
      break
    case 'person':
      d.people[p.value.login] = p.value
      break
    case 'label':
      d.labels[p.value.id] = p.value
      break
    case 'team':
      d.teams[p.value.key] = p.value
      break
    case 'issue':
      d.issues[p.value.id] = p.value
      break
    case 'comment': {
      const list: Comment[] = [...(d.comments[p.value.issue] ?? []).filter((c) => c.id !== p.value.id), p.value]
      d.comments[p.value.issue] = list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      break
    }
    case 'project':
      d.projects[p.value.id] = p.value
      break
    case 'view':
      d.views[p.value.id] = p.value
      break
    case 'inbox':
      if (p.login === me) d.inbox = [p.value, ...d.inbox.filter((n) => n.id !== p.value.id)].sort((a, b) => b.at.localeCompare(a.at))
      break
    case 'readState':
      if (p.login === me) d.readState = p.value
      break
  }
}

/** which part of the store each kind of file lives in */
const FIELD = {
  workspace: 'workspace',
  person: 'people',
  label: 'labels',
  team: 'teams',
  issue: 'issues',
  comment: 'comments',
  project: 'projects',
  view: 'views',
  inbox: 'inbox',
  readState: 'readState',
} as const satisfies Record<Parsed['kind'], keyof Draft>

/**
 * Apply changed files (null = deleted) to the store. `me` decides whose inbox and read marks we keep.
 * Only the parts of the store these files touch get a new object, so a screen about labels doesn't redraw
 * because an issue changed.
 */
export function applyFiles(changes: Map<string, string | null>, me: string | null): string[] {
  const broken: string[] = []
  const parsed = new Map<string, Parsed | null>()
  const touched = new Set<keyof Draft>()
  for (const [path, text] of changes) {
    const old = index.get(path)
    if (old) touched.add(FIELD[old.kind])
    let p: Parsed | null = null
    if (text !== null) {
      try {
        p = parseFile(path, text)
      } catch (e) {
        console.warn(`Sprawniej skipped a file it couldn't read: ${(e as Error).message}`)
        broken.push(path)
      }
    }
    if (p) touched.add(FIELD[p.kind])
    parsed.set(path, p)
  }
  if (!touched.size) {
    for (const path of changes.keys()) index.delete(path)
    return broken
  }

  const s = useData.getState()
  const d: Partial<Draft> = {}
  for (const f of touched) {
    const v = s[f]
    // records are copied so we can change them; the rest are replaced whole by remove/add
    d[f] = (v && typeof v === 'object' && !Array.isArray(v) && f !== 'workspace' && f !== 'readState' ? { ...v } : v) as never
  }
  const draft = d as Draft
  for (const [path, p] of parsed) {
    const old = index.get(path)
    if (old) {
      remove(draft, old)
      index.delete(path)
    }
    if (!p) continue
    index.set(path, p)
    add(draft, p, me)
  }
  useData.setState(d)
  return broken
}

/** People with access according to GitHub. Their own people/ file, when there is one, wins. */
export function setCollaborators(list: Person[]) {
  collaborators = Object.fromEntries(list.map((p) => [p.login, p]))
  const s = useData.getState()
  const people = { ...collaborators }
  for (const p of index.values()) if (p.kind === 'person') people[p.value.login] = p.value
  useData.setState({ people: { ...s.people, ...people } })
}

/** the path a parsed thing came from, e.g. to find an issue's file before it moves */
export function pathOf(match: (p: Parsed) => boolean): string | undefined {
  for (const [path, p] of index) if (match(p)) return path
  return undefined
}

/** every file we know of, parsed (including other people's inbox items, which the store leaves out) */
export function* parsedFiles(): Generator<[path: string, parsed: Parsed]> {
  yield* index
}
