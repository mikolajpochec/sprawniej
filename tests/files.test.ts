import { describe, expect, test } from 'bun:test'
import { sampleData } from '@/data/sample'
import { classify, commentToFile, issueToFile, jsonToFile, parseFile, paths, splitFrontMatter } from '@/data/files'

const data = sampleData()
const issue = data.issues['sample-01']

describe('issue files', () => {
  test('round trip keeps every field and the description', () => {
    const text = issueToFile(issue)
    const back = parseFile(paths.issue(issue), text)
    expect(back?.kind).toBe('issue')
    expect(back?.value).toEqual(issue)
  })
  test('front matter is readable YAML with the id first and no team field', () => {
    const text = issueToFile(issue)
    expect(text.startsWith('---\nid: sample-01\nnumber: 1\n')).toBe(true)
    expect(text).not.toContain('team:')
    expect(text).toContain('\n---\nCharts should be easier')
  })
  test('titles with colons, quotes and backticks survive', () => {
    const tricky = { ...issue, title: 'Fix: "quotes", `code` and # hashes', description: '' }
    const back = parseFile(paths.issue(tricky), issueToFile(tricky))
    expect(back?.value).toEqual(tricky)
  })
  test('unknown fields are kept', () => {
    const text = issueToFile(issue).replace('number: 1\n', 'number: 1\nlinearId: abc-123\n')
    const back = parseFile(paths.issue(issue), text)!
    expect((back.value as Record<string, unknown>).linearId).toBe('abc-123')
    expect(issueToFile(back.value as typeof issue)).toContain('linearId: abc-123')
  })
  test('a broken file throws with its path', () => {
    expect(() => parseFile('teams/ENG/issues/x.md', '---\nid: x\n---\n')).toThrow('teams/ENG/issues/x.md')
  })
  test('Windows line endings are fine', () => {
    const text = issueToFile(issue).replace(/\n/g, '\r\n')
    expect(parseFile(paths.issue(issue), text)?.value).toEqual(issue)
  })
})

describe('other files', () => {
  test('comment round trip', () => {
    const c = data.comments['sample-01'][0]
    expect(parseFile(paths.comment('ENG', c), commentToFile(c))?.value).toEqual(c)
  })
  test('team and view round trip', () => {
    const t = data.teams.ENG
    expect(parseFile(paths.team('ENG'), jsonToFile(t))?.value).toEqual(t)
    const v = data.views['v-bugs']
    expect(parseFile(paths.view(v.id), jsonToFile(v))?.value).toEqual(v)
  })
  test('files we do not manage are ignored', () => {
    expect(classify('README.md')).toBeNull()
    expect(parseFile('.github/workflows/x.yml', 'anything')).toBeNull()
  })
  test('front matter split handles a body that contains ---', () => {
    const { body } = splitFrontMatter('---\na: 1\n---\nline\n---\nmore\n')
    expect(body).toBe('line\n---\nmore\n')
  })
})
