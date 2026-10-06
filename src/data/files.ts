/**
 * Turning things into files and files back into things. docs/data-format.md shows every format with examples.
 * Paths are relative to the repo root.
 */
import YAML from 'yaml'
import type { z } from 'zod'
import {
  commentFieldsSchema,
  inboxItemSchema,
  issueFieldsSchema,
  labelSchema,
  personSchema,
  projectSchema,
  readStateSchema,
  teamSchema,
  viewSchema,
  workspaceSchema,
  type Comment,
  type InboxItem,
  type Issue,
  type Label,
  type Person,
  type Project,
  type ReadState,
  type Team,
  type View,
  type Workspace,
} from '@/model/schema'

export const WORKSPACE_FILE = 'sprawniej.json'

export const paths = {
  workspace: () => WORKSPACE_FILE,
  person: (login: string) => `people/${login}.json`,
  label: (id: string) => `labels/${id}.json`,
  team: (key: string) => `teams/${key}/team.json`,
  issue: (i: Pick<Issue, 'team' | 'id'>) => `teams/${i.team}/issues/${i.id}.md`,
  comment: (team: string, c: Pick<Comment, 'issue' | 'id'>) => `teams/${team}/comments/${c.issue}/${c.id}.md`,
  project: (id: string) => `projects/${id}.json`,
  view: (id: string) => `views/${id}.json`,
  inbox: (login: string, id: string) => `inbox/${login}/${id}.json`,
  readState: (login: string) => `state/${login}.json`,
}

/** What a path holds. The order of fields in `Parsed` doesn't matter; `kind` does. */
export type Parsed =
  | { kind: 'workspace'; value: Workspace }
  | { kind: 'person'; value: Person }
  | { kind: 'label'; value: Label }
  | { kind: 'team'; value: Team }
  | { kind: 'issue'; value: Issue }
  | { kind: 'comment'; team: string; value: Comment }
  | { kind: 'project'; value: Project }
  | { kind: 'view'; value: View }
  | { kind: 'inbox'; login: string; value: InboxItem }
  | { kind: 'readState'; login: string; value: ReadState }

/** Which kind of file lives at `path`, and the ids its path carries. Null for files we don't know (README…). */
export function classify(path: string): { kind: Parsed['kind']; parts: string[] } | null {
  const rules: [RegExp, Parsed['kind']][] = [
    [/^sprawniej\.json$/, 'workspace'],
    [/^people\/([^/]+)\.json$/, 'person'],
    [/^labels\/([^/]+)\.json$/, 'label'],
    [/^teams\/([^/]+)\/team\.json$/, 'team'],
    [/^teams\/([^/]+)\/issues\/([^/]+)\.md$/, 'issue'],
    [/^teams\/([^/]+)\/comments\/([^/]+)\/([^/]+)\.md$/, 'comment'],
    [/^projects\/([^/]+)\.json$/, 'project'],
    [/^views\/([^/]+)\.json$/, 'view'],
    [/^inbox\/([^/]+)\/([^/]+)\.json$/, 'inbox'],
    [/^state\/([^/]+)\.json$/, 'readState'],
  ]
  for (const [re, kind] of rules) {
    const m = re.exec(path)
    if (m) return { kind, parts: m.slice(1) }
  }
  return null
}

// ---------- Markdown with front matter ----------

export function splitFrontMatter(text: string): { fields: unknown; body: string } {
  const t = text.replace(/^﻿/, '').replace(/\r\n/g, '\n')
  if (!t.startsWith('---\n')) return { fields: {}, body: t }
  const end = t.indexOf('\n---', 4)
  if (end === -1) return { fields: {}, body: t }
  const after = t.indexOf('\n', end + 4)
  const yaml = t.slice(4, end + 1)
  return { fields: quickYaml(yaml) ?? YAML.parse(yaml) ?? {}, body: after === -1 ? '' : t.slice(after + 1) }
}

const NUMBER = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][-+]?[0-9]+)?$/
/** what YAML reads as a number in any spelling (01, +1, 1., 0x1F…); only the plain spelling above is quick */
const NUMBERISH = /^([-+]?[0-9]+|0o[0-7]+|0x[0-9a-fA-F]+|[-+]?(\.[0-9]+|[0-9]+(\.[0-9]*)?)([eE][-+]?[0-9]+)?)$/
/** plain words YAML could read as something else, or that need its full rules */
const TRICKY = /^([-?:,[\]{}#&*!|>'"%@`~]|\.|0[box]|[+-]?\.?(inf|nan)$)|: |:$| #|^(null|true|false|yes|no|on|off|y|n)$/i

function scalar(raw: string): { v: unknown } | null {
  if (raw === 'null' || raw === '~') return { v: null }
  if (raw === 'true') return { v: true }
  if (raw === 'false') return { v: false }
  if (raw === '[]') return { v: [] }
  if (NUMBER.test(raw)) return { v: Number(raw) }
  if (NUMBERISH.test(raw)) return null
  if (raw.startsWith('"') && raw.endsWith('"') && raw.length > 1) {
    // JSON's escapes are the common part of YAML's; anything else goes to the full reader
    if (/\\[^"\\/bfnrtu]/.test(raw)) return null
    try {
      return { v: JSON.parse(raw) }
    } catch {
      return null
    }
  }
  if (raw.startsWith("'") && raw.endsWith("'") && raw.length > 1) {
    const inner = raw.slice(1, -1)
    return /'(?!')/.test(inner.replace(/''/g, '')) ? null : { v: inner.replace(/''/g, "'") }
  }
  if (!raw || TRICKY.test(raw) || raw !== raw.trim()) return null
  return { v: raw }
}

/**
 * A quick reader for the front matter this app writes: `key: value` lines and `- item` lists. Reading thousands of
 * issues at start-up is several times faster this way. Returns null for anything else (folded text, nested maps,
 * unusual quoting…), and then the full YAML reader takes over, so the result is always the same.
 */
export function quickYaml(yaml: string): Record<string, unknown> | null {
  const out: Record<string, unknown> = {}
  let list: unknown[] | null = null
  for (const line of yaml.split('\n')) {
    if (!line) continue
    if (line.startsWith('  - ')) {
      if (!list) return null
      const item = scalar(line.slice(4))
      if (!item || Array.isArray(item.v)) return null
      list.push(item.v)
      continue
    }
    list = null
    const colon = line.indexOf(':')
    if (colon < 1) return null
    const key = line.slice(0, colon)
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || key in out) return null
    const rest = line.slice(colon + 1)
    if (rest === '') {
      list = []
      out[key] = list
      continue
    }
    if (!rest.startsWith(' ')) return null
    const v = scalar(rest.slice(1))
    if (!v) return null
    out[key] = v.v
  }
  return out
}

export function joinFrontMatter(fields: Record<string, unknown>, body: string): string {
  const yaml = YAML.stringify(fields, { lineWidth: 0 })
  const text = body.replace(/\s+$/, '')
  return `---\n${yaml}---\n${text ? `${text}\n` : ''}`
}

/** front matter keys in a fixed, readable order; anything unknown keeps its place after them */
const ISSUE_ORDER = ['id', 'number', 'title', 'status', 'priority', 'assignee', 'labels', 'project', 'parent', 'sortOrder', 'createdBy', 'createdAt', 'updatedAt', 'completedAt', 'duplicateOf']

function ordered(obj: Record<string, unknown>, order: string[], drop: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of order) if (k in obj && obj[k] !== undefined) out[k] = obj[k]
  for (const [k, v] of Object.entries(obj)) if (!(k in out) && !drop.includes(k) && v !== undefined) out[k] = v
  return out
}

export function issueToFile(issue: Issue): string {
  const { description, ...rest } = issue
  return joinFrontMatter(ordered(rest, ISSUE_ORDER, ['team']), description)
}

export function commentToFile(c: Comment): string {
  const { body, ...rest } = c
  return joinFrontMatter(ordered(rest, ['id', 'issue', 'author', 'createdAt', 'editedAt']), body)
}

export const jsonToFile = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

// ---------- parsing ----------

function check<T>(schema: z.ZodType<T>, value: unknown, path: string): T {
  const r = schema.safeParse(value)
  if (!r.success) throw new Error(`${path}: ${r.error.issues[0]?.message ?? 'not valid'}`)
  return r.data
}

/** Read one file. Throws (with the path in the message) when the file is broken; the caller skips it. */
export function parseFile(path: string, text: string): Parsed | null {
  const c = classify(path)
  if (!c) return null
  const json = () => JSON.parse(text) as unknown
  switch (c.kind) {
    case 'workspace':
      return { kind: 'workspace', value: check(workspaceSchema, json(), path) }
    case 'person':
      return { kind: 'person', value: check(personSchema, json(), path) }
    case 'label':
      return { kind: 'label', value: check(labelSchema, json(), path) }
    case 'team':
      return { kind: 'team', value: check(teamSchema, json(), path) }
    case 'issue': {
      const { fields, body } = splitFrontMatter(text)
      const f = check(issueFieldsSchema, fields, path)
      return { kind: 'issue', value: { ...f, team: c.parts[0], description: body.replace(/\s+$/, '') } }
    }
    case 'comment': {
      const { fields, body } = splitFrontMatter(text)
      return { kind: 'comment', team: c.parts[0], value: { ...check(commentFieldsSchema, fields, path), body: body.replace(/\s+$/, '') } }
    }
    case 'project':
      return { kind: 'project', value: check(projectSchema, json(), path) }
    case 'view':
      return { kind: 'view', value: check(viewSchema, json(), path) }
    case 'inbox':
      return { kind: 'inbox', login: c.parts[0], value: check(inboxItemSchema, json(), path) }
    case 'readState':
      return { kind: 'readState', login: c.parts[0], value: check(readStateSchema, json(), path) }
  }
}
