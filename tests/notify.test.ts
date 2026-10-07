import { beforeEach, describe, expect, test } from 'bun:test'
import { createComment, createIssue, deleteComment, setFollowers, subscribe, deleteInboxItems, markAllRead, markRead, tidyInbox, updateComment, updateIssue, INBOX_KEEP } from '@/data/actions'
import { linkReferences, mentionedLogins, newMentions } from '@/data/mentions'
import { followLists, followers, issueNotes } from '@/data/notify'
import { applyFiles, parsedFiles, resetProjection } from '@/data/project'
import { jsonToFile, paths } from '@/data/files'
import { isUnread } from '@/data/select'
import { EMPTY, useData } from '@/data/store'
import type { InboxItem, Issue, Person } from '@/model/schema'

const person = (login: string): Person => ({ login, githubId: login.length, name: login.toUpperCase(), avatarUrl: '' })
const people = { ana: person('ana'), bob: person('bob'), cy: person('cy') }

/** every inbox note in the workspace, as [recipient, item] */
const notes = () => [...parsedFiles()].flatMap(([, p]) => (p.kind === 'inbox' ? [[p.login, p.value] as const] : []))
const notesFor = (login: string) => notes().filter(([to]) => to === login).map(([, n]) => n)

beforeEach(() => {
  resetProjection()
  useData.setState({ ...EMPTY, me: people.ana, people })
})

describe('people from Linear who haven’t joined', () => {
  test('follow and can be assigned, but get no inbox notes', () => {
    const guest: Person = { login: '~jan', githubId: 0, name: 'Jan', avatarUrl: '' }
    const all = { ...people, '~jan': guest }
    const issue = { id: 'i', team: 'ENG', number: 1, title: 't', description: '', status: 'todo', priority: 0, assignee: '~jan', labels: [], project: null, parent: null, sortOrder: 'a0', createdBy: 'ana', createdAt: 'x', updatedAt: 'x', completedAt: null } as Issue
    expect(followers(issue, [], all)).toContain('~jan')
    expect(issueNotes(null, issue, 'bob', all)).toEqual([]) // assigned, but has no inbox
  })
})

describe('mentions', () => {
  test('only people in the workspace, not in code or e-mail addresses', () => {
    expect(mentionedLogins('hi @bob and @nobody, mail me@cy.dev, `@cy` and\n```\n@cy\n```', people)).toEqual(['bob'])
  })
  test('new mentions are the ones that were not there before', () => {
    expect(newMentions('@bob', '@bob @cy', people)).toEqual(['cy'])
  })
})

describe('notes', () => {
  const base: Issue = {
    id: 'i1', team: 'ENG', number: 1, title: 't', description: '', status: 'todo', priority: 0, assignee: null, labels: [],
    project: null, parent: null, sortOrder: 'a0', createdBy: 'bob', createdAt: '', updatedAt: '',
  }
  test('assigning someone tells them, assigning yourself tells nobody', () => {
    expect(issueNotes(base, { ...base, assignee: 'cy' }, 'ana', people)).toEqual([{ to: 'cy', type: 'assigned' }])
    expect(issueNotes(base, { ...base, assignee: 'ana' }, 'ana', people)).toEqual([])
  })
  test('a status change tells the followers once, never the person who made it', () => {
    expect(issueNotes({ ...base, assignee: 'bob' }, { ...base, assignee: 'bob', status: 'done' }, 'ana', people)).toEqual([{ to: 'bob', type: 'status', status: 'done' }])
    expect(issueNotes(base, { ...base, status: 'in_progress' }, 'ana', people)).toEqual([{ to: 'bob', type: 'status', status: 'in_progress' }])
    expect(issueNotes(base, { ...base, status: 'in_progress' }, 'bob', people)).toEqual([])
  })
  test('followers: creator, assignee, commenters and mentioned people, plus subscribers, minus unsubscribed', () => {
    const c = { id: 'c1', issue: 'i1', author: 'cy', createdAt: '', body: 'ask @ana' }
    expect(followers(base, [c], people).sort()).toEqual(['ana', 'bob', 'cy'])
    expect(followers({ ...base, unsubscribed: ['bob'], subscribers: ['nobody'] }, [], people)).toEqual([])
    expect(followers({ ...base, subscribers: ['cy'] }, [], people).sort()).toEqual(['bob', 'cy'])
  })
  test('followLists keeps the lists short', () => {
    expect(followLists(base, [], people, ['bob'])).toEqual({ subscribers: [], unsubscribed: [] })
    expect(followLists(base, [], people, ['cy'])).toEqual({ subscribers: ['cy'], unsubscribed: ['bob'] })
  })
  test('moving to a new assignee tells them once (assigned), not twice', () => {
    const notes = issueNotes(base, { ...base, assignee: 'cy', status: 'in_progress' }, 'ana', people)
    expect(notes).toEqual([{ to: 'cy', type: 'assigned' }, { to: 'bob', type: 'status', status: 'in_progress' }])
  })
})

describe('inbox', () => {
  test('a comment tells the creator, the assignee and earlier commenters, and mentions come first', () => {
    const i = createIssue({ team: 'ENG', title: 'Bug', assignee: 'bob' })
    expect(notesFor('bob').map((n) => n.type)).toEqual(['assigned'])
    useData.setState({ me: people.cy })
    createComment(i.id, 'Seen it, @bob')
    useData.setState({ me: people.ana })
    createComment(i.id, 'Thanks')
    expect(notesFor('cy').map((n) => n.type)).toEqual(['commented'])
    expect(notesFor('bob').map((n) => n.type).sort()).toEqual(['assigned', 'commented', 'mentioned'])
    expect(notesFor('ana').map((n) => n.type)).toEqual(['commented']) // cy's comment on ana's issue
  })

  test('unsubscribing stops comment and status notes; subscribing starts them', () => {
    const i = createIssue({ team: 'ENG', title: 'Bug', assignee: 'bob' })
    useData.setState({ me: people.bob })
    subscribe(i.id, false)
    expect(useData.getState().issues[i.id].unsubscribed).toEqual(['bob'])
    useData.setState({ me: people.cy })
    subscribe(i.id, true)
    useData.setState({ me: people.ana })
    createComment(i.id, 'Any news?')
    updateIssue(i.id, { status: 'in_progress' })
    expect(notesFor('bob').map((n) => n.type)).toEqual(['assigned'])
    expect(notesFor('cy').map((n) => n.type).sort()).toEqual(['commented', 'status'])
    // the same status again within minutes: one note
    updateIssue(i.id, { status: 'todo' })
    updateIssue(i.id, { status: 'in_progress' })
    expect(notesFor('cy').filter((n) => n.type === 'status').map((n) => n.status)).toEqual(['in_progress', 'todo'])
    const before = useData.getState().issues[i.id].updatedAt
    setFollowers(i.id, ['ana'])
    const after = useData.getState().issues[i.id]
    expect(after.updatedAt).toBe(before)
    expect(after.unsubscribed).toEqual(['bob'])
    expect(after.subscribers).toBeUndefined()
  })

  test('typing the same mention again in a few minutes tells them once', () => {
    const i = createIssue({ team: 'ENG', title: 'Bug' })
    updateIssue(i.id, { description: 'ask @bob' })
    updateIssue(i.id, { description: 'ask' })
    updateIssue(i.id, { description: 'ask @bob' })
    expect(notesFor('bob')).toHaveLength(1)
  })

  test('editing a comment tells only newly mentioned people; deleting it takes its notes away', () => {
    const i = createIssue({ team: 'ENG', title: 'Bug' })
    const c = createComment(i.id, 'hi @bob')!
    updateComment(i.id, c.id, 'hi @bob and @cy')
    expect(notesFor('bob')).toHaveLength(1)
    expect(notesFor('cy')).toHaveLength(1)
    expect(useData.getState().comments[i.id][0].editedAt).toBeTruthy()
    deleteComment(i.id, c.id)
    expect(notes()).toHaveLength(0)
    expect(useData.getState().comments[i.id]).toBeUndefined()
  })

  test("you can't edit someone else's comment", () => {
    const i = createIssue({ team: 'ENG', title: 'Bug' })
    useData.setState({ me: people.bob })
    const c = createComment(i.id, 'mine')!
    useData.setState({ me: people.ana })
    updateComment(i.id, c.id, 'yours now')
    deleteComment(i.id, c.id)
    expect(useData.getState().comments[i.id][0].body).toBe('mine')
  })

  const put = (to: string, item: InboxItem) => applyFiles(new Map([[paths.inbox(to, item.id), jsonToFile(item)]]), 'ana')
  const item = (id: string, at: string): InboxItem => ({ id, type: 'assigned', issue: 'x', actor: 'bob', at })

  test('read marks: one at a time, all at once, and deleting read notes', () => {
    put('ana', item('n1', '2026-10-01T00:00:00.000Z'))
    put('ana', item('n2', '2026-10-02T00:00:00.000Z'))
    markRead(['n1'])
    const unread = () => useData.getState().inbox.filter((n) => isUnread(n, useData.getState().readState)).map((n) => n.id)
    expect(unread()).toEqual(['n2'])
    deleteInboxItems(undefined, { readOnly: true })
    expect(useData.getState().inbox.map((n) => n.id)).toEqual(['n2'])
    expect(useData.getState().readState.read).toEqual([])
    markAllRead()
    expect(unread()).toEqual([])
  })

  test('tidying removes old notes and nothing else', () => {
    const now = Date.parse('2026-10-06T00:00:00.000Z')
    const ago = (ms: number) => new Date(now - ms).toISOString()
    put('ana', item('fresh', ago(INBOX_KEEP.read / 2)))
    put('ana', item('read-old', ago(INBOX_KEEP.read + 1000)))
    put('ana', item('unread-old', ago(INBOX_KEEP.read + 1000)))
    put('ana', item('ancient', ago(INBOX_KEEP.unread + 1000)))
    put('bob', item('bobs', ago(INBOX_KEEP.unread + 1000)))
    put('bob', item('bobs-ancient', ago(INBOX_KEEP.anyone + 1000)))
    markRead(['read-old'])
    tidyInbox(now)
    expect(useData.getState().inbox.map((n) => n.id).sort()).toEqual(['fresh', 'unread-old'])
    expect(notesFor('bob').map((n) => n.id)).toEqual(['bobs'])
    expect(useData.getState().readState.read).toEqual([])
  })
})

describe('sub-issues', () => {
  test('a new sub-issue goes under its siblings, not to the top of the team', () => {
    const parent = createIssue({ team: 'ENG', title: 'Parent' })
    const other = createIssue({ team: 'ENG', title: 'Newer' })
    const a = createIssue({ team: 'ENG', title: 'A', parent: parent.id })
    const b = createIssue({ team: 'ENG', title: 'B', parent: parent.id })
    const order = Object.values(useData.getState().issues).sort((x, y) => (x.sortOrder < y.sortOrder ? -1 : 1)).map((i) => i.title)
    expect(order).toEqual([other.title, parent.title, a.title, b.title])
  })
})

describe('linkReferences', () => {
  test('links people and issues, not code or links', () => {
    const md = 'ping @bob about ENG-1 and ENG-9, `@bob ENG-1`, [ENG-1](https://x.dev) https://x.dev/@bob'
    expect(linkReferences(md, people, (r) => r === 'ENG-1')).toBe(
      'ping [@bob](#@bob) about [ENG-1](#/issue/ENG-1) and ENG-9, `@bob ENG-1`, [ENG-1](https://x.dev) https://x.dev/@bob',
    )
  })
})
