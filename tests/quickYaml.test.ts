import { describe, expect, test } from 'bun:test'
import YAML from 'yaml'
import { issueToFile, quickYaml, splitFrontMatter } from '@/data/files'
import type { Issue } from '@/model/schema'

const TITLES = [
  'Plain title', 'Fix: the login', 'a # not a comment', '#hashtag', 'yes', 'No', 'null', 'true', '123', '1.5', '0x1F', '.inf', '-1', '-dash start',
  "It's fine", '"quoted"', "'single'", 'Tab\there', 'Line\nbreak', 'Ünïcödé ✅ 🚀', 'Trailing space ', ' leading', '[bracket]', '{brace}', 'a: b', 'end:',
  '@mention', '`code`', 'back\\slash', 'percent %', 'star *', 'ampersand & co', '! bang', '| pipe', '> gt', '~', '', 'x'.repeat(300), 'ENG-12', '2026-10-07',
]

const issue = (title: string): Issue => ({
  id: '01J9', team: 'ENG', number: 7, title, description: '', status: 'in_review', priority: 3, assignee: null, labels: ['a', 'b c', '9'],
  project: null, parent: 'x', sortOrder: 'a0V', createdBy: 'ana', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', completedAt: null,
})

const fm = (text: string) => text.slice(4, text.indexOf('\n---', 4) + 1)

describe('quick front matter reader', () => {
  test('reads exactly what the full reader reads, or steps aside', () => {
    let quick = 0
    for (const title of TITLES) {
      const yaml = fm(issueToFile(issue(title)))
      const q = quickYaml(yaml)
      if (q) {
        quick++
        expect(q).toEqual(YAML.parse(yaml))
      }
      expect(splitFrontMatter(issueToFile(issue(title))).fields).toEqual(YAML.parse(yaml))
    }
    expect(quick).toBeGreaterThan(TITLES.length / 2)
  })
  test('anything unusual goes to the full reader', () => {
    expect(quickYaml('a:\n  b: 1\n')).toBeNull()
    expect(quickYaml('a: >-\n  folded\n')).toBeNull()
    expect(quickYaml('a: 1\na: 2\n')).toBeNull()
    expect(quickYaml('a: "\\x41"\n')).toBeNull()
    for (const odd of ['01', '+1', '1.', '0o17', '0x1F', '1e5', '-0', '2026-10-07', '12:30', 'True', 'NULL']) {
      const yaml = `a: ${odd}\n`
      expect(splitFrontMatter(`---\n${yaml}---\n`).fields).toEqual(YAML.parse(yaml))
    }
    expect(quickYaml('empty: []\nlist:\n  - 1\n  - two\n')).toEqual({ empty: [], list: [1, 'two'] })
  })
})
