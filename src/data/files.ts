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
  return { fields: YAML.parse(t.slice(4, end + 1)) ?? {}, body: after === -1 ? '' : t.slice(after + 1) }
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
