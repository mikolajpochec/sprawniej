import { describe, expect, test } from 'bun:test'
import { generateKeyBetween } from 'fractional-indexing'
import { sampleData } from '@/data/sample'
import { childIndex, groupIssues, inTab, matches, nestChildren, projectProgress } from '@/data/select'
import { findByRef, issueRef } from '@/data/store'
import { DEFAULT_DISPLAY } from '@/data/displays'
import type { Issue } from '@/model/schema'
import { issueFieldsSchema } from '@/model/schema'

const data = sampleData()
const issues = Object.values(data.issues)
const ctx = { people: data.people, projects: data.projects }

describe('sample data', () => {
  test('every issue fits the file schema', () => {
    for (const i of issues) expect(issueFieldsSchema.safeParse(i).success).toBe(true)
  })
  test('numbers count up per team', () => {
    expect(issues.filter((i) => i.team === 'DES').map((i) => i.number)).toEqual([1, 2, 3])
  })
})

describe('refs', () => {
  test('ENG-1 round trip, any case', () => {
    const first = issues[0]
    expect(issueRef(first)).toBe('ENG-1')
    expect(findByRef(data.issues, 'eng-1')?.id).toBe(first.id)
    expect(findByRef(data.issues, 'ENG-999')).toBeUndefined()
    expect(findByRef(data.issues, 'nonsense')).toBeUndefined()
  })
})

describe('filters and tabs', () => {
  test('empty filters match everything', () => {
    expect(issues.every((i) => matches(i, {}))).toBe(true)
  })
  test('different filters must all match, values inside one filter are alternatives', () => {
    const hit = issues.filter((i) => matches(i, { teams: ['ENG'], labels: ['bug', 'feature'] }))
    expect(hit.length).toBeGreaterThan(0)
    expect(hit.every((i) => i.team === 'ENG' && i.labels.some((l) => l === 'bug' || l === 'feature'))).toBe(true)
  })
  test('null assignee filter finds unassigned issues', () => {
    expect(issues.filter((i) => matches(i, { assignees: [null] })).every((i) => i.assignee === null)).toBe(true)
  })
  test('Active is Todo, In Progress and In Review only', () => {
    const active = issues.filter((i) => inTab(i, 'active'))
    expect(new Set(active.map((i) => i.status))).toEqual(new Set(['todo', 'in_progress', 'in_review']))
  })
})

describe('grouping', () => {
  test('status groups follow Linear order and include empty ones', () => {
    const groups = groupIssues(issues, DEFAULT_DISPLAY, ctx, 'all')
    expect(groups.map((g) => g.key)).toEqual(['backlog', 'todo', 'in_progress', 'in_review', 'done', 'canceled', 'duplicate'])
    expect(groups.find((g) => g.key === 'duplicate')!.issues).toEqual([])
  })
  test('showCompleted off hides closed groups and issues', () => {
    const groups = groupIssues(issues, { ...DEFAULT_DISPLAY, showCompleted: false }, ctx, 'all')
    expect(groups.map((g) => g.key)).toEqual(['backlog', 'todo', 'in_progress', 'in_review'])
  })
  test('priority groups: urgent first, no priority last', () => {
    const groups = groupIssues(issues, { ...DEFAULT_DISPLAY, grouping: 'priority' }, ctx)
    expect(groups.map((g) => g.value)).toEqual([1, 2, 3, 4, 0])
  })
  test('assignee groups end with No assignee', () => {
    const groups = groupIssues(issues, { ...DEFAULT_DISPLAY, grouping: 'assignee' }, ctx)
    expect(groups.at(-1)!.title).toBe('No assignee')
    expect(groups.reduce((n, g) => n + g.issues.length, 0)).toBe(issues.length)
  })
  test('manual order uses plain string order of sortOrder', () => {
    const a = issues[0]
    const moved: Issue = { ...issues[5], status: a.status, sortOrder: generateKeyBetween(null, a.sortOrder) }
    const groups = groupIssues([a, moved], DEFAULT_DISPLAY, ctx)
    expect(groups.find((g) => g.key === a.status)!.issues.map((i) => i.id)).toEqual([moved.id, a.id])
  })
})

describe('sub-issues', () => {
  test('children sit right under their parent', () => {
    const inReview = issues.filter((i) => i.status === 'in_review')
    const rows = nestChildren(inReview)
    const parentAt = rows.findIndex((r) => r.issue.id === 'sample-01')
    expect(rows[parentAt + 1]).toEqual({ issue: data.issues['sample-02'], depth: 1 })
  })
  test('a parent loop does not hang or drop issues', () => {
    const a: Issue = { ...issues[0], id: 'a', parent: 'b' }
    const b: Issue = { ...issues[1], id: 'b', parent: 'a' }
    expect(nestChildren([a, b]).length).toBe(2)
  })
  test('counter counts done children', () => {
    expect(childIndex(data.issues).get('sample-01')).toEqual({ done: 1, total: 4 })
    expect(childIndex(data.issues).get('sample-02')).toBeUndefined()
  })
  test('counters are built once per version of the issues', () => {
    expect(childIndex(data.issues)).toBe(childIndex(data.issues))
    expect(childIndex({ ...data.issues })).not.toBe(childIndex(data.issues))
  })
  test('project progress leaves canceled out', () => {
    const p = projectProgress('p-insights', issues)
    expect(p.total).toBe(6)
    expect(p.done).toBe(1)
  })
})
