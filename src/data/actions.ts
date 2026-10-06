/**
 * The ONLY place that changes workspace data (CLAUDE.md, golden rules). Every action works out which files
 * change and hands them to the open workspace, which:
 *   1. updates the store (the screen changes at once),
 *   2. keeps the files in this browser (survives a crash),
 *   3. saves them to GitHub a moment later.
 * Each action also says in a few words what happened; that becomes the commit message on GitHub.
 */
import { generateKeyBetween } from 'fractional-indexing'
import { ulid } from 'ulid'
import type { Comment, Display, Filters, InboxItem, Issue, Label, Person, Project, ReadState, Team, View } from '@/model/schema'
import { FORMAT_VERSION } from '@/model/schema'
import { PRIORITY_NAMES, statusOf } from '@/model/status'
import { workspace } from '@/sync/engine'
import { commentToFile as commentFile, issueToFile, jsonToFile, paths } from './files'
import { commentNotes, issueNotes, type Note } from './notify'
import { keyBetween } from './ordering'
import { applyFiles, parsedFiles, pathOf } from './project'
import { isUnread } from './select'
import { issueRef, useData } from './store'

const now = () => new Date().toISOString()

function save(files: Map<string, string | null>, message: string) {
  const ws = workspace()
  if (ws) ws.write(files, message)
  else applyFiles(files, useData.getState().me?.login ?? null) // no workspace open (tests, previews): screen only
}

const one = (path: string, text: string | null) => new Map([[path, text]])

// ---------- notes for other people's inboxes ----------

const SAME_NOTE_WITHIN = 10 * 60_000

/** the same note from me about the same issue, a few minutes ago (typing "@ania", deleting it, typing it again) */
function toldRecently(to: string, issue: string, type: InboxItem['type'], me: string): boolean {
  if (type === 'commented') return false
  const since = new Date(Date.now() - SAME_NOTE_WITHIN).toISOString()
  for (const [, p] of parsedFiles()) {
    if (p.kind === 'inbox' && p.login === to && p.value.actor === me && p.value.issue === issue && p.value.type === type && !p.value.comment && p.value.at > since) return true
  }
  return false
}

/** adds an inbox file for each note to `files`, so the change and its notes are saved together */
function addNotes(files: Map<string, string | null>, issue: string, notes: Note[]) {
  const me = useData.getState().me?.login
  if (!me) return
  for (const n of notes) {
    if (!n.comment && toldRecently(n.to, issue, n.type, me)) continue
    const item: InboxItem = { id: ulid(), type: n.type, issue, actor: me, at: now() }
    if (n.comment) item.comment = n.comment
    if (n.status) item.status = n.status
    files.set(paths.inbox(n.to, item.id), jsonToFile(item))
  }
}

/** remove everyone's inbox notes about an issue or a comment that's gone */
function dropNotes(files: Map<string, string | null>, about: (n: InboxItem) => boolean) {
  for (const [path, p] of parsedFiles()) if (p.kind === 'inbox' && about(p.value)) files.set(path, null)
}

// ---------- issues ----------

/** fields a person can change (Pick, not Omit: Omit drops named keys on passthrough schemas) */
export type IssuePatch = Partial<
  Pick<Issue, 'title' | 'description' | 'status' | 'priority' | 'assignee' | 'labels' | 'project' | 'parent' | 'sortOrder' | 'duplicateOf'>
>

function describe(issue: Issue, patch: IssuePatch): string {
  const ref = issueRef(issue)
  const people = useData.getState().people
  if (patch.status && patch.status !== issue.status) return `${ref}: ${statusOf(issue.status).name} -> ${statusOf(patch.status).name}`
  if (patch.priority !== undefined && patch.priority !== issue.priority) return `${ref}: priority ${PRIORITY_NAMES[patch.priority]}`
  if (patch.assignee !== undefined && patch.assignee !== issue.assignee)
    return patch.assignee ? `${ref}: assign to ${people[patch.assignee]?.name ?? patch.assignee}` : `${ref}: unassign`
  if (patch.labels !== undefined) return `${ref}: labels`
  if (patch.project !== undefined) return patch.project ? `${ref}: project ${useData.getState().projects[patch.project]?.name ?? ''}`.trim() : `${ref}: no project`
  if (patch.parent !== undefined) {
    const parent = patch.parent ? useData.getState().issues[patch.parent] : undefined
    return parent ? `${ref}: sub-issue of ${issueRef(parent)}` : `${ref}: no parent`
  }
  if (patch.title !== undefined) return `${ref}: edit title`
  if (patch.description !== undefined) return `${ref}: edit description`
  if (patch.sortOrder !== undefined) return `${ref}: reorder`
  return `${ref}: update`
}

export function updateIssue(id: string, patch: IssuePatch): void {
  const old = useData.getState().issues[id]
  if (!old) return
  const next: Issue = { ...old, ...patch, updatedAt: now() }
  if (patch.status && patch.status !== old.status) {
    next.completedAt = statusOf(patch.status).group === 'completed' ? now() : null
  }
  const files = one(paths.issue(next), issueToFile(next))
  const s = useData.getState()
  if (s.me) addNotes(files, id, issueNotes(old, next, s.me.login, s.people))
  save(files, describe(old, patch))
}

/**
 * A drag-n-drop drop. `patch` = what the group it landed in stands for (status, priority…); `place` = its new
 * neighbours (issue ids, null = top or bottom), or null to keep its place (the list isn't in manual order).
 * One file changes either way.
 */
export function moveIssue(id: string, to: { patch: IssuePatch; place: { prev: string | null; next: string | null } | null }) {
  const issues = useData.getState().issues
  if (!issues[id]) return
  const patch: IssuePatch = { ...to.patch }
  if (to.place) {
    const key = (x: string | null) => (x && issues[x] ? issues[x].sortOrder : null)
    patch.sortOrder = keyBetween(key(to.place.prev), key(to.place.next))
  }
  if (Object.keys(patch).length) updateIssue(id, patch)
}

export interface NewIssue {
  team: string
  title: string
  description?: string
  status?: Issue['status']
  priority?: Issue['priority']
  assignee?: string | null
  labels?: string[]
  project?: string | null
  parent?: string | null
}

/** where a new sub-issue goes: after its last sibling, or right after its parent */
function subIssueOrder(issues: Issue[], parent: Issue): string {
  const anchor = issues.filter((i) => i.parent === parent.id).reduce((max, i) => (i.sortOrder > max ? i.sortOrder : max), parent.sortOrder)
  const next = issues.reduce<string | null>((min, i) => (i.sortOrder > anchor && (min === null || i.sortOrder < min) ? i.sortOrder : min), null)
  return keyBetween(anchor, next)
}

/** Creates an issue at the top of its team's order (a sub-issue: under its siblings) and returns it. */
export function createIssue(input: NewIssue): Issue {
  const s = useData.getState()
  const inTeam = Object.values(s.issues).filter((i) => i.team === input.team)
  const number = inTeam.reduce((max, i) => Math.max(max, i.number), 0) + 1
  const first = inTeam.reduce<string | null>((min, i) => (min === null || i.sortOrder < min ? i.sortOrder : min), null)
  const parent = input.parent ? s.issues[input.parent] : undefined
  const issue: Issue = {
    id: ulid(),
    team: input.team,
    number,
    title: input.title.trim(),
    description: input.description ?? '',
    status: input.status ?? 'todo',
    priority: input.priority ?? 0,
    assignee: input.assignee ?? null,
    labels: input.labels ?? [],
    project: input.project ?? null,
    parent: input.parent ?? null,
    sortOrder: parent && parent.team === input.team ? subIssueOrder(inTeam, parent) : generateKeyBetween(null, first),
    createdBy: s.me?.login ?? 'unknown',
    createdAt: now(),
    updatedAt: now(),
    completedAt: null,
  }
  const files = one(paths.issue(issue), issueToFile(issue))
  if (s.me) addNotes(files, issue.id, issueNotes(null, issue, s.me.login, s.people))
  save(files, `Create ${issueRef(issue)}: ${issue.title}`)
  return issue
}

/** Remove an issue (and its comments). Its sub-issues stay, without a parent. */
export function deleteIssue(id: string) {
  const s = useData.getState()
  const issue = s.issues[id]
  if (!issue) return
  const files = new Map<string, string | null>([[paths.issue(issue), null]])
  for (const c of s.comments[id] ?? []) files.set(paths.comment(issue.team, c), null)
  for (const child of Object.values(s.issues).filter((i) => i.parent === id)) {
    files.set(paths.issue(child), issueToFile({ ...child, parent: null, updatedAt: now() }))
  }
  dropNotes(files, (n) => n.issue === id)
  save(files, `Delete ${issueRef(issue)}: ${issue.title}`)
}

/** Move an issue to another team: it gets that team's next number, like a new issue there. */
export function moveIssueToTeam(id: string, team: string): Issue | undefined {
  const s = useData.getState()
  const old = s.issues[id]
  if (!old || old.team === team || !s.teams[team]) return old
  const number = Object.values(s.issues).filter((i) => i.team === team).reduce((max, i) => Math.max(max, i.number), 0) + 1
  const next: Issue = { ...old, team, number, updatedAt: now() }
  const files = new Map<string, string | null>([
    [pathOf((p) => p.kind === 'issue' && p.value.id === id) ?? paths.issue(old), null],
    [paths.issue(next), issueToFile(next)],
  ])
  for (const c of s.comments[id] ?? []) {
    files.set(paths.comment(old.team, c), null)
    files.set(paths.comment(team, c), commentFile(c))
  }
  save(files, `Move ${issueRef(old)} to ${s.teams[team].name} as ${issueRef(next)}`)
  return next
}

// ---------- comments ----------

const tidyBody = (body: string) => body.replace(/\s+$/, '')

export function createComment(issueId: string, body: string): Comment | undefined {
  const s = useData.getState()
  const issue = s.issues[issueId]
  if (!issue || !s.me || !body.trim()) return undefined
  const comment: Comment = { id: ulid(), issue: issueId, author: s.me.login, createdAt: now(), body: tidyBody(body) }
  const files = one(paths.comment(issue.team, comment), commentFile(comment))
  addNotes(files, issueId, commentNotes(issue, comment, null, s.comments[issueId] ?? [], s.me.login, s.people))
  save(files, `${issueRef(issue)}: comment`)
  return comment
}

/** only your own comments; an empty text is ignored (delete the comment instead) */
export function updateComment(issueId: string, id: string, body: string) {
  const s = useData.getState()
  const issue = s.issues[issueId]
  const old = s.comments[issueId]?.find((c) => c.id === id)
  if (!issue || !old || !s.me || old.author !== s.me.login || !body.trim() || tidyBody(body) === old.body) return
  const next: Comment = { ...old, body: tidyBody(body), editedAt: now() }
  const files = one(paths.comment(issue.team, next), commentFile(next))
  addNotes(files, issueId, commentNotes(issue, next, old.body, [], s.me.login, s.people))
  save(files, `${issueRef(issue)}: edit comment`)
}

export function deleteComment(issueId: string, id: string) {
  const s = useData.getState()
  const issue = s.issues[issueId]
  const old = s.comments[issueId]?.find((c) => c.id === id)
  if (!issue || !old || !s.me || old.author !== s.me.login) return
  const files = one(paths.comment(issue.team, old), null)
  dropNotes(files, (n) => n.comment === id)
  save(files, `${issueRef(issue)}: delete comment`)
}

// ---------- your inbox ----------

function saveReadState(next: ReadState, files = new Map<string, string | null>(), message = 'Inbox: mark as read') {
  const me = useData.getState().me?.login
  if (!me) return
  files.set(paths.readState(me), jsonToFile(next))
  save(files, message)
}

export function markRead(ids: string[]) {
  const s = useData.getState()
  const fresh = s.inbox.filter((n) => ids.includes(n.id) && isUnread(n, s.readState)).map((n) => n.id)
  if (fresh.length) saveReadState({ ...s.readState, read: [...s.readState.read, ...fresh] })
}

export function markAllRead() {
  const s = useData.getState()
  if (!s.inbox.some((n) => isUnread(n, s.readState))) return
  const latest = s.inbox.reduce((max, n) => (n.at > max ? n.at : max), s.readState.readUntil ?? '')
  saveReadState({ ...s.readState, readUntil: latest, read: [] }, undefined, 'Inbox: mark all as read')
}

/** delete notes from your inbox (all of them if `ids` is left out, only read ones with `readOnly`) */
export function deleteInboxItems(ids?: string[], { readOnly = false } = {}) {
  const s = useData.getState()
  const me = s.me?.login
  if (!me) return
  const gone = s.inbox.filter((n) => (!ids || ids.includes(n.id)) && (!readOnly || !isUnread(n, s.readState)))
  if (!gone.length) return
  const files = new Map<string, string | null>(gone.map((n) => [paths.inbox(me, n.id), null]))
  const ids2 = new Set(gone.map((n) => n.id))
  const read = s.readState.read.filter((id) => !ids2.has(id))
  if (read.length !== s.readState.read.length) files.set(paths.readState(me), jsonToFile({ ...s.readState, read }))
  save(files, gone.length === 1 ? 'Inbox: delete a note' : `Inbox: delete ${gone.length} notes`)
}

const DAY = 86_400_000
/** how long inbox notes are kept: read ones, unread ones, and anyone's (people who left never tidy theirs) */
export const INBOX_KEEP = { read: 30 * DAY, unread: 90 * DAY, anyone: 180 * DAY }

/**
 * Keeps the workspace small: removes old notes from your inbox (and very old ones from anyone's) and forgets read
 * marks for notes that are gone. Runs when the workspace opens; saves nothing when there's nothing to tidy.
 */
export function tidyInbox(at = Date.now()) {
  const s = useData.getState()
  const me = s.me?.login
  if (!me) return
  const before = (ms: number) => new Date(at - ms).toISOString()
  const files = new Map<string, string | null>()
  for (const [path, p] of parsedFiles()) {
    if (p.kind !== 'inbox') continue
    const n = p.value
    const old = p.login === me ? n.at < (isUnread(n, s.readState) ? before(INBOX_KEEP.unread) : before(INBOX_KEEP.read)) : n.at < before(INBOX_KEEP.anyone)
    if (old) files.set(path, null)
  }
  const left = new Set(s.inbox.filter((n) => !files.has(paths.inbox(me, n.id))).map((n) => n.id))
  const read = s.readState.read.filter((id) => left.has(id))
  if (read.length !== s.readState.read.length) files.set(paths.readState(me), jsonToFile({ ...s.readState, read }))
  if (files.size) save(files, 'Tidy up old inbox notes')
}

// ---------- labels ----------

/** a calm set of label colours; new labels take the next one */
export const LABEL_COLORS = ['#eb5757', '#f2994a', '#f2c94c', '#4cb782', '#26b5ce', '#5e6ad2', '#bb87fc', '#f7a8d8', '#95a2b3']

export function createLabel(name: string): Label {
  const s = useData.getState()
  const label: Label = { id: ulid(), name: name.trim(), color: LABEL_COLORS[Object.keys(s.labels).length % LABEL_COLORS.length] }
  save(one(paths.label(label.id), jsonToFile(label)), `Add label ${label.name}`)
  return label
}

export function updateLabel(id: string, patch: Partial<Pick<Label, 'name' | 'color'>>) {
  const label = useData.getState().labels[id]
  if (!label) return
  save(one(paths.label(id), jsonToFile({ ...label, ...patch })), `Edit label ${patch.name ?? label.name}`)
}

/** remove a label everywhere */
export function deleteLabel(id: string) {
  const s = useData.getState()
  const label = s.labels[id]
  if (!label) return
  const files = new Map<string, string | null>([[paths.label(id), null]])
  for (const i of Object.values(s.issues)) {
    if (i.labels.includes(id)) files.set(paths.issue(i), issueToFile({ ...i, labels: i.labels.filter((l) => l !== id), updatedAt: now() }))
  }
  save(files, `Delete label ${label.name}`)
}

// ---------- views ----------

export interface NewView {
  name: string
  emoji: string
  description?: string
  /** null = the whole workspace */
  team: string | null
  filters?: Filters
  display: Display
}

export function createView(input: NewView): View {
  const me = useData.getState().me
  const view: View = {
    id: ulid(),
    name: input.name.trim(),
    emoji: input.emoji,
    description: input.description?.trim() ?? '',
    owner: me?.login ?? 'unknown',
    team: input.team,
    filters: input.filters ?? {},
    display: input.display,
    createdAt: now(),
  }
  save(one(paths.view(view.id), jsonToFile(view)), `Create view ${view.emoji} ${view.name}`)
  return view
}

export type ViewPatch = Partial<Pick<View, 'name' | 'emoji' | 'description' | 'filters' | 'display'>>

export function updateView(id: string, patch: ViewPatch) {
  const view = useData.getState().views[id]
  if (!view) return
  const next: View = { ...view, ...patch }
  // empty filter lists are left out, so the file stays readable
  next.filters = Object.fromEntries(Object.entries(next.filters).filter(([, v]) => !Array.isArray(v) || v.length > 0))
  const what = patch.filters ? 'filters' : patch.display ? 'display' : patch.name ? 'rename' : 'edit'
  save(one(paths.view(id), jsonToFile(next)), `View ${next.emoji} ${next.name}: ${what}`)
}

export function deleteView(id: string) {
  const view = useData.getState().views[id]
  if (!view) return
  save(one(paths.view(id), null), `Delete view ${view.emoji} ${view.name}`)
}

// ---------- projects ----------

export interface NewProject {
  name: string
  emoji: string
  description?: string
  status?: Project['status']
  lead?: string | null
  teams?: string[]
  targetDate?: string | null
}

export function createProject(input: NewProject): Project {
  const project: Project = {
    id: ulid(),
    name: input.name.trim(),
    emoji: input.emoji,
    description: input.description?.trim() ?? '',
    status: input.status ?? 'planned',
    lead: input.lead ?? null,
    teams: input.teams ?? [],
    targetDate: input.targetDate ?? null,
    createdAt: now(),
  }
  save(one(paths.project(project.id), jsonToFile(project)), `Create project ${project.emoji} ${project.name}`)
  return project
}

export type ProjectPatch = Partial<Pick<Project, 'name' | 'emoji' | 'description' | 'status' | 'lead' | 'teams' | 'targetDate'>>

export function updateProject(id: string, patch: ProjectPatch) {
  const project = useData.getState().projects[id]
  if (!project) return
  const next = { ...project, ...patch }
  const what = patch.status ? `status ${patch.status.replace('_', ' ')}` : patch.lead !== undefined ? 'lead' : patch.targetDate !== undefined ? 'target date' : 'edit'
  save(one(paths.project(id), jsonToFile(next)), `Project ${next.emoji} ${next.name}: ${what}`)
}

/** remove a project; its issues stay, without a project */
export function deleteProject(id: string) {
  const s = useData.getState()
  const project = s.projects[id]
  if (!project) return
  const files = new Map<string, string | null>([[paths.project(id), null]])
  for (const i of Object.values(s.issues)) if (i.project === id) files.set(paths.issue(i), issueToFile({ ...i, project: null, updatedAt: now() }))
  save(files, `Delete project ${project.emoji} ${project.name}`)
}

// ---------- teams ----------

export function createTeam(input: { key: string; name: string; emoji: string }): Team {
  const me = useData.getState().me
  const team: Team = { key: input.key, name: input.name.trim(), emoji: input.emoji, members: me ? [me.login] : [], createdAt: now() }
  save(one(paths.team(team.key), jsonToFile(team)), `Create team ${team.name}`)
  return team
}

export function joinTeam(key: string) {
  const s = useData.getState()
  const team = s.teams[key]
  if (!team || !s.me || team.members.includes(s.me.login)) return
  const next = { ...team, members: [...team.members, s.me.login] }
  save(one(paths.team(key), jsonToFile(next)), `${s.me.name || s.me.login} joins ${team.name}`)
}

export function leaveTeam(key: string) {
  const s = useData.getState()
  const team = s.teams[key]
  if (!team || !s.me) return
  const next = { ...team, members: team.members.filter((m) => m !== s.me!.login) }
  save(one(paths.team(key), jsonToFile(next)), `${s.me.name || s.me.login} leaves ${team.name}`)
}

/** "Engineering" → "ENG", "Mobile app" → "MA" */
export function suggestKey(name: string): string {
  const words = name
    .normalize('NFD')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const raw = words.length > 1 ? words.map((w) => w[0]).join('') : (words[0] ?? '').slice(0, 3)
  const key = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return /^[A-Z]/.test(key) ? key.slice(0, 7) : `T${key}`.slice(0, 7)
}

// ---------- people and the workspace ----------

/** Make sure your people/ file matches your GitHub profile (name and picture change over time). */
export function introduceMe(me: Person) {
  const s = useData.getState()
  const mine = s.people[me.login]
  if (mine && mine.name === me.name && mine.avatarUrl === me.avatarUrl && mine.githubId === me.githubId) return
  save(one(paths.person(me.login), jsonToFile({ ...mine, ...me })), mine ? `Update ${me.name || me.login}'s profile` : `${me.name || me.login} joins the workspace`)
}

/** A brand-new workspace: its file, you, and a first team. */
export function startWorkspace(name: string, firstTeam: { key: string; name: string; emoji: string }) {
  const me = useData.getState().me
  const created = now()
  const files = new Map<string, string | null>([[paths.workspace(), jsonToFile({ name: name.trim(), format: FORMAT_VERSION, createdAt: created })]])
  if (me) files.set(paths.person(me.login), jsonToFile(me))
  const team: Team = { key: firstTeam.key, name: firstTeam.name.trim(), emoji: firstTeam.emoji, members: me ? [me.login] : [], createdAt: created }
  files.set(paths.team(team.key), jsonToFile(team))
  save(files, `Create the ${name.trim()} workspace`)
}

export function renameWorkspace(name: string) {
  const ws = useData.getState().workspace
  if (!ws || !name.trim()) return
  save(one(paths.workspace(), jsonToFile({ ...ws, name: name.trim() })), `Rename the workspace to ${name.trim()}`)
}

// ---------- import ----------

/** how many files go into one save; big imports are saved in parts so GitHub never gets one huge change */
const IMPORT_BATCH = 300

/**
 * Write a prepared import (features/import). Saves part by part and waits for each, calling `progress` with how
 * many files are saved so far.
 */
export async function importFiles(files: Map<string, string | null>, message: string, progress?: (saved: number, total: number) => void) {
  const entries = [...files]
  const parts = Math.ceil(entries.length / IMPORT_BATCH)
  for (let n = 0; n < parts; n++) {
    const batch = new Map(entries.slice(n * IMPORT_BATCH, (n + 1) * IMPORT_BATCH))
    save(batch, parts > 1 ? `${message} (part ${n + 1} of ${parts})` : message)
    await workspace()?.flush()
    progress?.(Math.min(entries.length, (n + 1) * IMPORT_BATCH), entries.length)
  }
}
