/**
 * Everything the workspace holds, kept in memory as plain maps. Components read from here with selectors;
 * they never change it directly. All changes go through `actions.ts` (see CLAUDE.md, golden rules).
 */
import { create } from 'zustand'
import type { Comment, InboxItem, Issue, Label, Person, Project, ReadState, Team, View, Workspace } from '@/model/schema'

export interface DataState {
  workspace: Workspace | null
  /** the signed-in person */
  me: Person | null
  people: Record<string, Person>
  labels: Record<string, Label>
  teams: Record<string, Team>
  issues: Record<string, Issue>
  projects: Record<string, Project>
  views: Record<string, View>
  /** by issue id, oldest first */
  comments: Record<string, Comment[]>
  /** my inbox, newest first */
  inbox: InboxItem[]
  readState: ReadState
}

export const EMPTY: DataState = {
  workspace: null,
  me: null,
  people: {},
  labels: {},
  teams: {},
  issues: {},
  projects: {},
  views: {},
  comments: {},
  inbox: [],
  readState: { readUntil: null, read: [] },
}

export const useData = create<DataState>()(() => ({ ...EMPTY }))

/** "ENG-12" */
export const issueRef = (issue: Pick<Issue, 'team' | 'number'>) => `${issue.team}-${issue.number}`

/** find an issue by its "ENG-12" reference */
export function findByRef(issues: Record<string, Issue>, ref: string): Issue | undefined {
  const m = /^([A-Z][A-Z0-9]*)-(\d+)$/.exec(ref.toUpperCase())
  if (!m) return undefined
  const n = Number(m[2])
  return Object.values(issues).find((i) => i.team === m[1] && i.number === n)
}

declare global {
  interface Window {
    /** for scripted checks in tests: window.sprawniej.data.getState(), window.sprawniej.actions.createIssue(…) */
    sprawniej?: { data?: typeof useData; actions?: Record<string, unknown>; sync?: unknown }
  }
}
if (typeof window !== 'undefined') window.sprawniej = { ...window.sprawniej, data: useData }
