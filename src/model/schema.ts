/**
 * The shape of every file in a workspace repo. docs/data-format.md describes the same thing in plain words,
 * with examples; keep the two in step. Files are checked with these schemas when they are read, and a file that
 * doesn't fit is skipped with a warning instead of breaking the app.
 *
 * `.passthrough()` keeps fields we don't know yet, so an older app never deletes what a newer one wrote.
 */
import { z } from 'zod'
import { PRIORITY_IDS, STATUS_IDS } from './status'

/** Bump only together with a MAJOR release and a migration (see CLAUDE.md). */
export const FORMAT_VERSION = 1

const iso = z.string() // ISO 8601 date-time
const login = z.string() // GitHub login

/** sprawniej.json at the repo root */
export const workspaceSchema = z
  .object({
    name: z.string(),
    format: z.number().int(),
    createdAt: iso,
  })
  .passthrough()
export type Workspace = z.infer<typeof workspaceSchema>

/** people/<login>.json, written by that person when they first open the workspace */
export const personSchema = z
  .object({
    login,
    githubId: z.number().int(),
    name: z.string(),
    avatarUrl: z.string(),
  })
  .passthrough()
export type Person = z.infer<typeof personSchema>

/** labels/<id>.json */
export const labelSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    color: z.string(),
  })
  .passthrough()
export type Label = z.infer<typeof labelSchema>

/** teams/<KEY>/team.json */
export const teamSchema = z
  .object({
    key: z.string().regex(/^[A-Z][A-Z0-9]{0,6}$/),
    name: z.string(),
    emoji: z.string(),
    members: z.array(login),
    createdAt: iso,
    /** the highest number a deleted or moved-away issue had, so numbers are never given out twice */
    lastNumber: z.number().int().optional(),
  })
  .passthrough()
export type Team = z.infer<typeof teamSchema>

/** The front matter of teams/<KEY>/issues/<id>.md. The Markdown body after it is the description. */
export const issueFieldsSchema = z
  .object({
    id: z.string(),
    number: z.number().int().positive(),
    title: z.string(),
    status: z.enum(STATUS_IDS),
    priority: z.union(PRIORITY_IDS.map((p) => z.literal(p))),
    assignee: login.nullable(),
    labels: z.array(z.string()),
    project: z.string().nullable(),
    parent: z.string().nullable(),
    /** fractional index (see fractional-indexing): a drag rewrites only the moved issue */
    sortOrder: z.string(),
    createdBy: login,
    createdAt: iso,
    updatedAt: iso,
    completedAt: iso.nullable().optional(),
    duplicateOf: z.string().nullable().optional(),
  })
  .passthrough()
export type IssueFields = z.infer<typeof issueFieldsSchema>

export interface Issue extends IssueFields {
  /** which team folder the file lives in */
  team: string
  /** Markdown */
  description: string
}

/** teams/<KEY>/comments/<issueId>/<id>.md: front matter + Markdown body, written only by its author */
export const commentFieldsSchema = z
  .object({
    id: z.string(),
    issue: z.string(),
    author: login,
    createdAt: iso,
    editedAt: iso.nullable().optional(),
  })
  .passthrough()
export interface Comment extends z.infer<typeof commentFieldsSchema> {
  body: string
}

export const PROJECT_STATUSES = ['backlog', 'planned', 'in_progress', 'paused', 'completed', 'canceled'] as const

/** projects/<id>.json */
export const projectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    emoji: z.string(),
    description: z.string(),
    status: z.enum(PROJECT_STATUSES),
    lead: login.nullable(),
    teams: z.array(z.string()),
    targetDate: z.string().nullable(),
    createdAt: iso,
  })
  .passthrough()
export type Project = z.infer<typeof projectSchema>

export const GROUPINGS = ['status', 'assignee', 'priority', 'project', 'none'] as const
export type Grouping = (typeof GROUPINGS)[number]
export const ORDERINGS = ['manual', 'priority', 'updated', 'created'] as const
export type Ordering = (typeof ORDERINGS)[number]

export const filtersSchema = z
  .object({
    teams: z.array(z.string()).optional(),
    statuses: z.array(z.enum(STATUS_IDS)).optional(),
    assignees: z.array(login.nullable()).optional(),
    priorities: z.array(z.number().int()).optional(),
    labels: z.array(z.string()).optional(),
    projects: z.array(z.string().nullable()).optional(),
  })
  .passthrough()
export type Filters = z.infer<typeof filtersSchema>

export const displaySchema = z
  .object({
    layout: z.enum(['list', 'board']),
    grouping: z.enum(GROUPINGS),
    ordering: z.enum(ORDERINGS),
    showCompleted: z.boolean(),
    showSubIssues: z.boolean(),
  })
  .passthrough()
export type Display = z.infer<typeof displaySchema>

/** views/<id>.json: a saved filter with an emoji */
export const viewSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    emoji: z.string(),
    description: z.string(),
    owner: login,
    /** null = the whole workspace, otherwise a team key */
    team: z.string().nullable(),
    filters: filtersSchema,
    display: displaySchema,
    createdAt: iso,
  })
  .passthrough()
export type View = z.infer<typeof viewSchema>

/** inbox/<recipient>/<id>.json, written by whoever caused it */
export const inboxItemSchema = z
  .object({
    id: z.string(),
    type: z.enum(['assigned', 'mentioned', 'commented', 'status']),
    issue: z.string(),
    actor: login,
    at: iso,
    /** the comment it's about (mentioned in a comment, commented) */
    comment: z.string().optional(),
    /** the new status (status) */
    status: z.enum(STATUS_IDS).optional(),
  })
  .passthrough()
export type InboxItem = z.infer<typeof inboxItemSchema>

/** state/<login>.json: personal marks, written only by that person */
export const readStateSchema = z
  .object({
    /** everything at or before this moment counts as read */
    readUntil: iso.nullable(),
    /** single items read after that */
    read: z.array(z.string()),
  })
  .passthrough()
export type ReadState = z.infer<typeof readStateSchema>
