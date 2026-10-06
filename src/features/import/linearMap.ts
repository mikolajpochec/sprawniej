/**
 * Linear data → workspace files. Pure (no store, no network), so every rule is unit-tested
 * (tests/linearImport.test.ts). docs/linear-import.md describes the same mapping in plain words.
 *
 * Every imported file keeps its Linear id in `linearId`, so running the import again updates what came over
 * the first time instead of making copies.
 */
import { generateNKeysBetween } from 'fractional-indexing'
import { commentToFile, issueToFile, jsonToFile, paths } from '@/data/files'
import { STATUSES, type Priority, type StatusId } from '@/model/status'
import type { Comment, Issue, Label, Person, Project, Team } from '@/model/schema'
import type { LIssue, LinearData, LTeam, LUser } from './linearApi'

// ---------- people ----------

const plain = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

/** a Linear person's best guess among the workspace's people: same name, or a login that looks like theirs */
export function guessPerson(u: LUser, people: Person[]): string | null {
  const names = [u.name, u.displayName].filter(Boolean).map(plain)
  const local = u.email ? plain(u.email.split('@')[0]) : ''
  const hit =
    people.find((p) => p.name && names.includes(plain(p.name))) ??
    people.find((p) => names.includes(plain(p.login)) || (local && plain(p.login) === local))
  return hit?.login ?? null
}

/** the Linear people who show up in these issues and comments (assignees, creators, commenters) */
export function involvedUsers(data: Pick<LinearData, 'users' | 'issues' | 'comments'>): LUser[] {
  const ids = new Set<string>()
  for (const i of data.issues) for (const u of [i.assignee, i.creator]) if (u) ids.add(u.id)
  for (const c of data.comments) if (c.user) ids.add(c.user.id)
  return data.users.filter((u) => ids.has(u.id)).sort((a, b) => a.name.localeCompare(b.name))
}

// ---------- statuses, teams, emoji ----------

const STATE_TYPES: Record<string, StatusId> = {
  triage: 'backlog',
  backlog: 'backlog',
  unstarted: 'todo',
  started: 'in_progress',
  completed: 'done',
  canceled: 'canceled',
}

/** by name first ("In Review"), then by Linear's kind of state */
export function mapStatus(state: { name: string; type: string }): StatusId {
  const name = plain(state.name.replace(/cancelled/i, 'canceled'))
  return STATUSES.find((s) => plain(s.name) === name)?.id ?? STATE_TYPES[state.type] ?? 'backlog'
}

const PROJECT_STATES: Record<string, Project['status']> = {
  backlog: 'backlog',
  planned: 'planned',
  started: 'in_progress',
  paused: 'paused',
  completed: 'completed',
  canceled: 'canceled',
}

/** Linear icons are names ("Rocket") or emoji; names we know become their emoji */
const ICONS: Record<string, string> = {
  rocket: '🚀', bug: '🐞', code: '💻', terminal: '💻', design: '🎨', palette: '🎨', brush: '🎨', mobile: '📱', phone: '📱',
  chart: '📊', barchart: '📊', megaphone: '📣', book: '📚', cube: '📦', box: '📦', flag: '🚩', star: '⭐', heart: '❤️',
  lightning: '⚡', bolt: '⚡', globe: '🌍', world: '🌍', server: '🖥️', computer: '🖥️', gear: '⚙️', settings: '⚙️',
  people: '👥', users: '👥', team: '👥', target: '🎯', shield: '🛡️', lock: '🔒', money: '💰', dollar: '💰', briefcase: '💼',
  lab: '🧪', flask: '🧪', tools: '🛠️', wrench: '🛠️', calendar: '📅', mail: '✉️', chat: '💬', home: '🏠', music: '🎵', camera: '📷',
}

export function emojiFor(icon: string | null, fallback: string): string {
  if (!icon) return fallback
  if (/\p{Extended_Pictographic}/u.test(icon)) return icon
  return ICONS[plain(icon)] ?? fallback
}

const TEAM_EMOJI = ['🚀', '🛠️', '🎨', '📦', '🧪', '📣', '🌍', '⚡']

/** a key for a team that isn't taken (ENG, then ENG2, ENG3…) */
export function freeKey(key: string, taken: Set<string>): string {
  const base = key.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'T'
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base}${n}`.slice(0, 7))) return `${base}${n}`.slice(0, 7)
}

// ---------- descriptions ----------

/** links to Linear issues that came over become plain references (ENG-12), which open here */
export function rewriteLinks(md: string, imported: Set<string>): string {
  const ref = (r: string, whole: string) => (imported.has(r) ? r : whole)
  return md
    .replace(/\[([^\]\n]*)\]\(https:\/\/linear\.app\/[^/\s)]+\/issue\/([A-Z][A-Z0-9]*-\d+)[^)\s]*\)/g, (whole, _text: string, r: string) => ref(r, whole))
    .replace(/<?https:\/\/linear\.app\/[^/\s)]+\/issue\/([A-Z][A-Z0-9]*-\d+)[^\s)>]*>?/g, (whole, r: string) => ref(r, whole))
}

// ---------- the whole import ----------

/** what the person chose in the wizard */
export interface ImportChoices {
  /** Linear team id → the key it gets here (its own key, or another one when that is taken) */
  teamKeys: Record<string, string>
  /** Linear user id → GitHub login here, or null for nobody */
  people: Record<string, string | null>
}

/** the workspace as it is now */
export interface Existing {
  me: string
  teams: Record<string, Team>
  issues: Record<string, Issue>
  labels: Record<string, Label>
  projects: Record<string, Project>
  comments: Record<string, Comment[]>
}

export interface ImportResult {
  files: Map<string, string | null>
  counts: { teams: number; labels: number; projects: number; issues: number; comments: number }
  /** imported issues that couldn't keep their number, because the team here already used it */
  renumbered: { from: string; to: string }[]
}

const linearIdOf = (x: object): string | undefined => {
  const v = (x as { linearId?: unknown }).linearId
  return typeof v === 'string' ? v : undefined
}

function byLinearId<T extends object>(things: Iterable<T>): Map<string, T> {
  const m = new Map<string, T>()
  for (const t of things) {
    const id = linearIdOf(t)
    if (id) m.set(id, t)
  }
  return m
}

/** Linear sends higher numbers for later in a list; this turns their order into ours, team by team */
function orderKeys(issues: LIssue[]): Map<string, string> {
  const out = new Map<string, string>()
  const byTeam = new Map<string, LIssue[]>()
  for (const i of issues) byTeam.set(i.team.id, [...(byTeam.get(i.team.id) ?? []), i])
  for (const list of byTeam.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.number - b.number)
    const keys = generateNKeysBetween(null, null, list.length)
    list.forEach((i, n) => out.set(i.id, keys[n]))
  }
  return out
}

export function buildImport(data: LinearData, choices: ImportChoices, ws: Existing, newId: () => string, now: string): ImportResult {
  const files = new Map<string, string | null>()
  const counts = { teams: 0, labels: 0, projects: 0, issues: 0, comments: 0 }
  const renumbered: ImportResult['renumbered'] = []
  const login = (u: { id: string } | null | undefined) => (u ? (choices.people[u.id] ?? null) : null)
  const teams = data.teams.filter((t) => choices.teamKeys[t.id])
  const teamIds = new Set(teams.map((t) => t.id))
  const issues = data.issues.filter((i) => teamIds.has(i.team.id))
  const keyOf = (t: { id: string }) => choices.teamKeys[t.id]

  // teams: new ones get a file; ones that are already here stay as they are
  const members = new Map<string, Set<string>>()
  for (const i of issues) for (const p of [login(i.assignee), login(i.creator)]) if (p) members.set(i.team.id, (members.get(i.team.id) ?? new Set()).add(p))
  teams.forEach((t: LTeam, n) => {
    const here = ws.teams[keyOf(t)]
    if (here) {
      // remember which Linear team it is, so the next import picks it again
      if (linearIdOf(here) !== t.id) files.set(paths.team(here.key), jsonToFile({ ...here, linearId: t.id }))
      return
    }
    const team: Team & { linearId: string } = {
      key: keyOf(t),
      name: t.name,
      emoji: emojiFor(t.icon, TEAM_EMOJI[n % TEAM_EMOJI.length]),
      members: [...new Set([ws.me, ...(members.get(t.id) ?? [])])],
      createdAt: now,
      linearId: t.id,
    }
    files.set(paths.team(team.key), jsonToFile(team))
    counts.teams++
  })

  // labels: group labels are flattened ("Area: Charts"); the same name in several teams becomes one label
  const usedLabels = new Set(issues.flatMap((i) => i.labels.nodes.map((l) => l.id)))
  const labelsByLinear = byLinearId(Object.values(ws.labels))
  const labelsByName = new Map(Object.values(ws.labels).map((l) => [l.name.toLowerCase(), l]))
  const labelId = new Map<string, string>()
  for (const l of data.labels) {
    if (l.isGroup || !usedLabels.has(l.id)) continue
    const name = l.parent ? `${l.parent.name}: ${l.name}` : l.name
    const found = labelsByLinear.get(l.id) ?? labelsByName.get(name.toLowerCase())
    if (found) {
      labelId.set(l.id, found.id)
      continue
    }
    const label: Label & { linearId: string } = { id: newId(), name, color: l.color, linearId: l.id }
    files.set(paths.label(label.id), jsonToFile(label))
    labelsByName.set(name.toLowerCase(), label)
    labelId.set(l.id, label.id)
    counts.labels++
  }

  // projects: the ones these teams' issues belong to, or that belong to these teams
  const usedProjects = new Set(issues.flatMap((i) => (i.project ? [i.project.id] : [])))
  const projectsByLinear = byLinearId(Object.values(ws.projects))
  const projectId = new Map<string, string>()
  for (const p of data.projects) {
    if (!usedProjects.has(p.id) && !p.teams.nodes.some((t) => teamIds.has(t.id))) continue
    const old = projectsByLinear.get(p.id)
    const state = p.status?.type ?? p.state ?? 'planned'
    const project: Project & { linearId: string } = {
      ...old,
      id: old?.id ?? newId(),
      name: p.name,
      emoji: emojiFor(p.icon, old?.emoji ?? '📦'),
      description: p.description ?? '',
      status: PROJECT_STATES[state] ?? 'planned',
      lead: login(p.lead),
      teams: p.teams.nodes.filter((t) => teamIds.has(t.id)).map(keyOf),
      targetDate: p.targetDate,
      createdAt: old?.createdAt ?? p.createdAt,
      linearId: p.id,
    }
    files.set(paths.project(project.id), jsonToFile(project))
    projectId.set(p.id, project.id)
    counts.projects++
  }

  // issues: keep numbers unless the team here already used one for something else
  const issuesByLinear = byLinearId(Object.values(ws.issues))
  const order = orderKeys(issues)
  const idOf = new Map(issues.map((i) => [i.id, issuesByLinear.get(i.id)?.id ?? newId()]))
  const refs = new Set(issues.map((i) => `${keyOf(i.team)}-${i.number}`))
  const taken = new Map<string, Set<number>>()
  for (const i of Object.values(ws.issues)) {
    if (linearIdOf(i) && idOf.has(linearIdOf(i)!)) continue
    taken.set(i.team, (taken.get(i.team) ?? new Set()).add(i.number))
  }
  const highest = new Map<string, number>()
  const raise = (team: string, n: number) => highest.set(team, Math.max(highest.get(team) ?? 0, n))
  for (const [team, used] of taken) for (const n of used) raise(team, n)
  for (const t of Object.values(ws.teams)) raise(t.key, t.lastNumber ?? 0)
  for (const li of issues) raise(issuesByLinear.get(li.id)?.team ?? keyOf(li.team), li.number)
  const plan: { li: LIssue; team: string; number: number }[] = []
  for (const li of [...issues].sort((a, b) => a.number - b.number)) {
    const old = issuesByLinear.get(li.id)
    const team = old?.team ?? keyOf(li.team)
    const used = taken.get(team) ?? new Set<number>()
    taken.set(team, used)
    let number = old?.number ?? li.number
    if (!old && used.has(number)) {
      const n = (highest.get(team) ?? 0) + 1
      raise(team, n)
      renumbered.push({ from: `${team}-${number}`, to: `${team}-${n}` })
      number = n
    }
    used.add(number)
    plan.push({ li, team, number })
  }
  const pathOfIssue = new Map<string, Issue>()
  for (const { li, team, number } of plan) {
    const old = issuesByLinear.get(li.id)
    const issue: Issue & { linearId: string } = {
      ...old,
      id: idOf.get(li.id)!,
      team,
      number,
      title: li.title,
      description: rewriteLinks(li.description ?? '', refs).replace(/\s+$/, ''),
      status: mapStatus(li.state),
      priority: (li.priority >= 0 && li.priority <= 4 ? li.priority : 0) as Priority,
      assignee: login(li.assignee),
      labels: [...new Set(li.labels.nodes.map((l) => labelId.get(l.id)).filter((x): x is string => !!x))],
      project: li.project ? (projectId.get(li.project.id) ?? null) : null,
      parent: li.parent ? (idOf.get(li.parent.id) ?? null) : null,
      sortOrder: order.get(li.id)!,
      createdBy: login(li.creator) ?? old?.createdBy ?? ws.me,
      createdAt: li.createdAt,
      updatedAt: li.updatedAt,
      completedAt: li.completedAt ?? li.canceledAt ?? null,
      linearId: li.id,
    }
    files.set(paths.issue(issue), issueToFile(issue))
    pathOfIssue.set(li.id, issue)
    counts.issues++
  }

  // comments: matched authors keep their name; others are written by you, saying who wrote them
  const commentsByLinear = byLinearId(Object.values(ws.comments).flat())
  for (const c of [...data.comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const issue = c.issue && pathOfIssue.get(c.issue.id)
    if (!issue || !c.body.trim()) continue
    const author = login(c.user)
    const old = commentsByLinear.get(c.id)
    const body = rewriteLinks(c.body, refs).replace(/\s+$/, '')
    const comment: Comment & { linearId: string } = {
      ...old,
      id: old?.id ?? newId(),
      issue: issue.id,
      author: author ?? ws.me,
      createdAt: c.createdAt,
      body: author ? body : `*From Linear: ${c.user?.name ?? 'someone'}*\n\n${body}`,
      linearId: c.id,
    }
    files.set(paths.comment(issue.team, comment), commentToFile(comment))
    counts.comments++
  }

  return { files, counts, renumbered }
}
