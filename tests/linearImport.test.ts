import { describe, expect, test } from 'bun:test'
import { parseFile } from '@/data/files'
import { buildImport, emojiFor, freeKey, guessPerson, involvedUsers, mapStatus, rewriteLinks, type Existing, type ImportChoices } from '@/features/import/linearMap'
import type { Comment, Issue, Label, Project, Team } from '@/model/schema'
import { linearFixture as data } from './fixtures/linear'

const person = (login: string, name: string) => ({ login, githubId: 1, name, avatarUrl: '' })
const people = [person('ana-n', 'Ana Nowak'), person('bstone', 'Robert'), person('mikolaj', 'Mikołaj Pocheć')]

describe('matching people', () => {
  test('by name, ignoring accents, or by the e-mail name', () => {
    expect(guessPerson(data.users[0], people)).toBe('ana-n')
    expect(guessPerson(data.users[1], people)).toBe('bstone')
    expect(guessPerson({ ...data.users[2], name: 'Mikolaj Pochec' }, people)).toBe('mikolaj')
    expect(guessPerson(data.users[2], people)).toBeNull()
  })
  test('only people who appear in the issues', () => {
    expect(involvedUsers({ ...data, issues: data.issues.slice(1, 3), comments: [] }).map((u) => u.id)).toEqual(['u-ana', 'u-old'])
  })
})

describe('mapping', () => {
  test('statuses by name, then by kind', () => {
    expect(mapStatus({ name: 'In Review', type: 'started' })).toBe('in_review')
    expect(mapStatus({ name: 'QA', type: 'started' })).toBe('in_progress')
    expect(mapStatus({ name: 'Triage', type: 'triage' })).toBe('backlog')
    expect(mapStatus({ name: 'Cancelled', type: 'canceled' })).toBe('canceled')
    expect(mapStatus({ name: 'Duplicate', type: 'canceled' })).toBe('duplicate')
  })
  test('icons', () => {
    expect(emojiFor('Rocket', '📦')).toBe('🚀')
    expect(emojiFor('🎨', '📦')).toBe('🎨')
    expect(emojiFor('SomethingElse', '📦')).toBe('📦')
  })
  test('free keys', () => {
    expect(freeKey('ENG', new Set(['ENG', 'ENG2']))).toBe('ENG3')
    expect(freeKey('des', new Set())).toBe('DES')
  })
  test('links to imported issues become references', () => {
    expect(rewriteLinks('a https://linear.app/acme/issue/ENG-2/fix and [x](https://linear.app/acme/issue/ENG-2/fix) and https://linear.app/acme/issue/OPS-1/y', new Set(['ENG-2']))).toBe(
      'a ENG-2 and ENG-2 and https://linear.app/acme/issue/OPS-1/y',
    )
  })
})

const empty = (): Existing => ({ me: 'mikolaj', teams: {}, issues: {}, labels: {}, projects: {}, comments: {} })
const choices: ImportChoices = { teamKeys: { 't-eng': 'ENG' }, people: { 'u-ana': 'ana-n', 'u-bob': 'bstone', 'u-old': null } }
const ids = () => {
  let n = 0
  return () => `id${++n}`
}

/** the import's files as workspace data, the way the app would read them */
function read(files: Map<string, string | null>): Existing {
  const ws = empty()
  for (const [path, text] of files) {
    const p = text && parseFile(path, text)
    if (!p) continue
    if (p.kind === 'team') ws.teams[p.value.key] = p.value as Team
    if (p.kind === 'issue') ws.issues[p.value.id] = p.value as Issue
    if (p.kind === 'label') ws.labels[p.value.id] = p.value as Label
    if (p.kind === 'project') ws.projects[p.value.id] = p.value as Project
    if (p.kind === 'comment') ws.comments[p.value.issue] = [...(ws.comments[p.value.issue] ?? []), p.value as Comment]
  }
  return ws
}

describe('building the import', () => {
  const r = buildImport(data, choices, empty(), ids(), '2026-10-07T00:00:00.000Z')
  const ws = read(r.files)
  const byTitle = (t: string) => Object.values(ws.issues).find((i) => i.title === t)!

  test('only the chosen team, with numbers, statuses and people', () => {
    expect(r.counts).toEqual({ teams: 1, labels: 2, projects: 1, issues: 3, comments: 2 })
    expect(ws.teams.ENG).toMatchObject({ name: 'Engineering', emoji: '🚀' })
    expect(ws.teams.ENG.members.sort()).toEqual(['ana-n', 'bstone', 'mikolaj'])
    const charts = byTitle('Charts are slow')
    expect(charts).toMatchObject({ number: 1, status: 'in_review', priority: 2, assignee: 'bstone', createdBy: 'ana-n', dueDate: '2026-11-03', estimate: 5 })
    expect('dueDate' in byTitle('Old idea')).toBe(false)
    expect(byTitle('Old idea')).toMatchObject({ status: 'backlog', createdBy: 'mikolaj' })
    expect(byTitle('Fix the axis')).toMatchObject({ status: 'done', completedAt: '2026-02-01T00:00:00.000Z', parent: charts.id })
  })
  test('labels are flattened and merged by name', () => {
    expect(Object.values(ws.labels).map((l) => l.name).sort()).toEqual(['Area: Charts', 'Bug'])
    expect(byTitle('Fix the axis').labels).toEqual(byTitle('Charts are slow').labels.slice(0, 1))
  })
  test('projects, order, links and comments', () => {
    const project = Object.values(ws.projects)[0]
    expect(project).toMatchObject({ name: 'Launch', emoji: '🚩', status: 'in_progress', lead: 'ana-n', teams: ['ENG'], targetDate: '2026-12-01' })
    expect(byTitle('Charts are slow').project).toBe(project.id)
    const order = Object.values(ws.issues).sort((a, b) => (a.sortOrder < b.sortOrder ? -1 : 1)).map((i) => i.number)
    expect(order).toEqual([2, 3, 1])
    expect(byTitle('Charts are slow').description).toBe('See ENG-2 and ENG-2 and https://linear.app/acme/issue/OPS-9/x')
    const comments = ws.comments[byTitle('Charts are slow').id]
    expect(comments.map((c) => [c.author, c.body])).toEqual([
      ['bstone', 'On it'],
      ['mikolaj', '*From Linear: Old Timer*\n\nBack in my day'],
    ])
  })

  test('running it again updates instead of copying', () => {
    const again = buildImport({ ...data, issues: data.issues.map((i) => (i.id === 'i-3' ? { ...i, title: 'Old idea, renamed' } : i)) }, choices, { ...ws, me: 'mikolaj' }, ids(), 'later')
    expect(again.counts).toMatchObject({ teams: 0, labels: 0, issues: 3, comments: 2 })
    const ws2 = read(again.files)
    expect(Object.keys(ws2.issues).sort()).toEqual(Object.keys(ws.issues).sort())
    expect(Object.values(ws2.issues).find((i) => i.number === 3)?.title).toBe('Old idea, renamed')
    expect(Object.keys(ws2.projects)).toEqual(Object.keys(ws.projects))
  })

  test('into a team that already has issues: clashing numbers move up', () => {
    const mine: Issue = { id: 'mine', team: 'ENG', number: 2, title: 'Made here', description: '', status: 'todo', priority: 0, assignee: null, labels: [], project: null, parent: null, sortOrder: 'a0', createdBy: 'mikolaj', createdAt: '', updatedAt: '' }
    const existing = { ...empty(), teams: { ENG: { key: 'ENG', name: 'Eng', emoji: '🛠️', members: [], createdAt: '' } }, issues: { mine } }
    const r2 = buildImport(data, choices, existing, ids(), 'now')
    expect(r2.counts.teams).toBe(0)
    expect(r2.renumbered).toEqual([{ from: 'ENG-2', to: 'ENG-4' }])
  })
})

test('a Linear team that joins a team here is remembered', () => {
  const existing = { ...empty(), teams: { ENG: { key: 'ENG', name: 'Eng', emoji: '🛠️', members: ['mikolaj'], createdAt: '' } } }
  const r = buildImport(data, choices, existing, ids(), 'now')
  expect(read(r.files).teams.ENG).toMatchObject({ name: 'Eng', linearId: 't-eng' })
  expect(r.counts.teams).toBe(0)
})
