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
import type { Issue, Label, Person, Team } from '@/model/schema'
import { FORMAT_VERSION } from '@/model/schema'
import { PRIORITY_NAMES, statusOf } from '@/model/status'
import { workspace } from '@/sync/engine'
import { commentToFile as commentFile, issueToFile, jsonToFile, paths } from './files'
import { keyBetween } from './ordering'
import { pathOf } from './project'
import { applyFiles } from './project'
import { issueRef, useData } from './store'

const now = () => new Date().toISOString()

function save(files: Map<string, string | null>, message: string) {
  const ws = workspace()
  if (ws) ws.write(files, message)
  else applyFiles(files, useData.getState().me?.login ?? null) // no workspace open (tests, previews): screen only
}

const one = (path: string, text: string | null) => new Map([[path, text]])

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
  save(one(paths.issue(next), issueToFile(next)), describe(old, patch))
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

/** Creates an issue at the top of its team's order and returns it. */
export function createIssue(input: NewIssue): Issue {
  const s = useData.getState()
  const inTeam = Object.values(s.issues).filter((i) => i.team === input.team)
  const number = inTeam.reduce((max, i) => Math.max(max, i.number), 0) + 1
  const first = inTeam.reduce<string | null>((min, i) => (min === null || i.sortOrder < min ? i.sortOrder : min), null)
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
    sortOrder: generateKeyBetween(null, first),
    createdBy: s.me?.login ?? 'unknown',
    createdAt: now(),
    updatedAt: now(),
    completedAt: null,
  }
  save(one(paths.issue(issue), issueToFile(issue)), `Create ${issueRef(issue)}: ${issue.title}`)
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
