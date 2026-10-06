import { describe, expect, test } from 'bun:test'
import { issueToFile } from '@/data/files'
import { issueEvents, type Version } from '@/data/history'
import type { Issue } from '@/model/schema'

const base: Issue = {
  id: 'i1', team: 'ENG', number: 3, title: 'Charts', description: 'Old', status: 'todo', priority: 0, assignee: null, labels: [],
  project: null, parent: null, sortOrder: 'a0', createdBy: 'ana', createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z',
}
let n = 0
const at = (min: number) => new Date(Date.parse('2026-10-01T10:00:00Z') + min * 60_000).toISOString()
const v = (min: number, who: string, issue: Issue | null, path = `teams/${issue?.team ?? 'ENG'}/issues/i1.md`, message = 'x'): Version => ({
  oid: `c${++n}`, at: at(min), message, login: who, name: who.toUpperCase(), path, text: issue ? issueToFile(issue) : null,
})

describe('issue history', () => {
  test('one event per changed property, oldest first; the first version is the creation', () => {
    const events = issueEvents([
      v(0, 'ana', base),
      v(60, 'bob', { ...base, status: 'in_progress', assignee: 'bob' }),
      v(120, 'ana', { ...base, status: 'in_progress', assignee: 'bob', labels: ['bug'], dueDate: '2026-10-31', estimate: 3 }),
    ])
    expect(events.map((e) => [e.by, e.change.kind])).toEqual([
      ['bob', 'status'], ['bob', 'assignee'], ['ana', 'labels'], ['ana', 'dueDate'], ['ana', 'estimate'],
    ])
    expect(events[0].change).toEqual({ kind: 'status', from: 'todo', to: 'in_progress' })
  })
  test('the same person typing a title over a few saves reads as one change', () => {
    const events = issueEvents([v(0, 'ana', base), v(1, 'ana', { ...base, title: 'Chart' }), v(2, 'ana', { ...base, title: 'Charts are slow' })])
    expect(events).toEqual([{ at: at(2), by: 'ana', change: { kind: 'title', from: 'Charts', to: 'Charts are slow' } }])
  })
  test('there and back again leaves nothing; someone else in between keeps both', () => {
    expect(issueEvents([v(0, 'ana', base), v(1, 'ana', { ...base, status: 'done' }), v(2, 'ana', base)])).toEqual([])
    const kept = issueEvents([v(0, 'ana', base), v(1, 'ana', { ...base, status: 'done' }), v(2, 'bob', { ...base, status: 'done', priority: 1 }), v(3, 'ana', { ...base, priority: 1 })])
    expect(kept.map((e) => e.change.kind)).toEqual(['status', 'priority', 'status'])
  })
  test('a move between teams is one event, read across both paths', () => {
    const moved = { ...base, team: 'DES', number: 7 }
    const oid = 'move'
    const events = issueEvents([
      v(0, 'ana', base),
      { ...v(10, 'ana', null), oid },
      { ...v(10, 'ana', moved, 'teams/DES/issues/i1.md'), oid },
    ])
    expect(events.map((e) => e.change)).toEqual([{ kind: 'team', from: 'ENG-3', to: 'DES-7' }])
  })
  test('archived and restored', () => {
    const events = issueEvents([v(0, 'ana', base), v(10, 'bob', null, undefined, 'Archive ENG-3'), v(20, 'ana', base)])
    expect(events.map((e) => e.change)).toEqual([{ kind: 'removed', message: 'Archive ENG-3' }, { kind: 'restored' }])
  })
  test('a broken version is skipped', () => {
    const broken = { ...v(5, 'ana', base), text: '---\nnot: [valid\n---\n' }
    expect(issueEvents([v(0, 'ana', base), broken, v(10, 'bob', { ...base, priority: 2 })]).map((e) => e.change.kind)).toEqual(['priority'])
  })
})

describe('following moves', () => {
  test('a move is found alone or as one line of a bigger save, and only for this issue', async () => {
    const { movedFrom } = await import('@/features/issues/useHistory')
    expect(movedFrom('Move ENG-3 to Design as DES-7', 'DES-7')).toBe('ENG')
    expect(movedFrom('ENG-9: edit title (and 2 more changes)\n\n- ENG-9: edit title\n- Move ENG-3 to Design as DES-7\n', 'DES-7')).toBe('ENG')
    expect(movedFrom('Move ENG-4 to Design as DES-8', 'DES-7')).toBeUndefined()
  })
  test('save order decides, not the clocks of the people saving', () => {
    // bob's clock runs late: his later save carries an earlier time
    const events = issueEvents([v(10, 'ana', base), v(20, 'ana', { ...base, status: 'in_progress' }), v(5, 'bob', { ...base, status: 'done' })])
    expect(events.map((e) => e.change)).toEqual([
      { kind: 'status', from: 'todo', to: 'in_progress' },
      { kind: 'status', from: 'in_progress', to: 'done' },
    ])
  })
})
