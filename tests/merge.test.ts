import { describe, expect, test } from 'bun:test'
import { issueToFile, jsonToFile, parseFile, paths } from '@/data/files'
import { sampleData } from '@/data/sample'
import { mergeFile, mergeText, mergeValue } from '@/sync/merge'
import { renumber } from '@/sync/renumber'
import type { Issue } from '@/model/schema'

const base = sampleData().issues['sample-01']
const path = paths.issue(base)
const file = (i: Issue) => issueToFile(i)
const read = (text: string | null) => parseFile(path, text!)!.value as Issue

describe('issues changed by two people', () => {
  test('different fields: both changes survive', () => {
    const ours = { ...base, status: 'done' as const, updatedAt: '2026-10-07T10:00:00.000Z' }
    const theirs = { ...base, assignee: 'zosia', updatedAt: '2026-10-07T09:00:00.000Z' }
    const m = mergeFile(path, file(base), file(ours), file(theirs))
    expect(m.conflict).toBe(false)
    const r = read(m.text)
    expect(r.status).toBe('done')
    expect(r.assignee).toBe('zosia')
    expect(r.updatedAt).toBe('2026-10-07T10:00:00.000Z')
  })
  test('same field: ours wins and it is reported', () => {
    const m = mergeFile(path, file(base), file({ ...base, title: 'Ours' }), file({ ...base, title: 'Theirs' }))
    expect(m.conflict).toBe(true)
    expect(read(m.text).title).toBe('Ours')
  })
  test('labels merge as sets', () => {
    const b = { ...base, labels: ['a', 'b'] }
    const m = mergeFile(path, file(b), file({ ...b, labels: ['a', 'b', 'c'] }), file({ ...b, labels: ['b', 'd'] }))
    expect(read(m.text).labels).toEqual(['b', 'c', 'd'])
    expect(m.conflict).toBe(false)
  })
  test('descriptions merge line by line', () => {
    const b = { ...base, description: 'one\ntwo\nthree\nfour\nfive' }
    const ours = { ...b, description: 'ONE\ntwo\nthree\nfour\nfive' }
    const theirs = { ...b, description: 'one\ntwo\nthree\nfour\nFIVE' }
    const m = mergeFile(path, file(b), file(ours), file(theirs))
    expect(read(m.text).description).toBe('ONE\ntwo\nthree\nfour\nFIVE')
    expect(m.conflict).toBe(false)
  })
  test('overlapping description lines keep ours', () => {
    expect(mergeText('a\nb\nc', 'a\nX\nc', 'a\nY\nc')).toBe('a\nX\nc')
  })
  test('an edit beats a delete, both ways', () => {
    const edited = file({ ...base, title: 'Edited' })
    expect(mergeFile(path, file(base), null, edited).text).toBe(edited)
    expect(mergeFile(path, file(base), edited, null).text).toBe(edited)
  })
  test('a delete on one side and nothing on the other deletes', () => {
    expect(mergeFile(path, file(base), null, file(base)).text).toBeNull()
  })
})

describe('json files', () => {
  test('team members join from both sides', () => {
    const t = sampleData().teams.ENG
    const p = paths.team('ENG')
    const m = mergeFile(p, jsonToFile(t), jsonToFile({ ...t, members: [...t.members, 'zosia'] }), jsonToFile({ ...t, name: 'Eng', members: [...t.members, 'kuba'] }))
    const r = JSON.parse(m.text!)
    expect(r.name).toBe('Eng')
    expect(r.members).toEqual([...t.members, 'zosia', 'kuba'])
  })
  test('nested objects merge per field', () => {
    expect(mergeValue({ d: { a: 1, b: 1 } }, { d: { a: 2, b: 1 } }, { d: { a: 1, b: 3 } })).toEqual({ d: { a: 2, b: 3 } })
  })
  test('both created the same new file: fields merge, clashes keep ours', () => {
    expect(mergeValue(undefined, { a: 1, b: 2 }, { a: 1, c: 3 })).toEqual({ a: 1, b: 2, c: 3 })
  })
})

describe('renumbering', () => {
  const at = (n: number, id: string, createdAt = '2026-10-07T00:00:00.000Z') => ({ ...base, id, number: n, createdAt })
  test('our unsaved issue moves to the next free number', () => {
    const remote = at(13, 'remote')
    const mine = at(13, 'mine')
    const baseFiles = new Map([[paths.issue(remote), file(remote)]])
    const pending = new Map<string, string | null>([[paths.issue(mine), file(mine)]])
    const r = renumber(baseFiles, pending)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ team: 'ENG', from: 13, to: 14 })
    expect(read(r[0].text).number).toBe(14)
  })
  test('no clash, no change', () => {
    const remote = at(13, 'remote')
    const mine = at(14, 'mine')
    expect(renumber(new Map([[paths.issue(remote), file(remote)]]), new Map([[paths.issue(mine), file(mine)]]))).toEqual([])
  })
  test('two of our own new issues with the same number: the newer one moves', () => {
    const a = at(5, 'a', '2026-10-07T01:00:00.000Z')
    const b = at(5, 'b', '2026-10-07T02:00:00.000Z')
    const r = renumber(new Map(), new Map([[paths.issue(b), file(b)], [paths.issue(a), file(a)]]))
    expect(r.map((x) => [x.path.includes('/b.md'), x.to])).toEqual([[true, 6]])
  })
})
