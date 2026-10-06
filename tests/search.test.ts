import { expect, test } from 'bun:test'
import { searchIssues } from '@/data/search'
import type { Issue } from '@/model/schema'

const mk = (number: number, title: string, status: Issue['status'] = 'todo', updatedAt = '2026-01-01'): Issue => ({
  id: `i${number}`, team: 'ENG', number, title, description: '', status, priority: 0, assignee: null, labels: [], project: null, parent: null,
  sortOrder: 'a0', createdBy: 'x', createdAt: '', updatedAt,
})
const issues = Object.fromEntries([mk(1, 'Fix login'), mk(12, 'Login page is slow', 'done'), mk(3, 'Slow charts', 'todo', '2026-02-01'), mk(4, 'Mention ENG-12')].map((i) => [i.id, i]))

test('an exact ID comes first, then open issues, newest first', () => {
  expect(searchIssues(issues, 'eng-12').map((i) => i.number)).toEqual([12, 4])
  expect(searchIssues(issues, 'slow').map((i) => i.number)).toEqual([3, 12])
  expect(searchIssues(issues, 'login fix').map((i) => i.number)).toEqual([1])
  expect(searchIssues(issues, '  ')).toEqual([])
})
