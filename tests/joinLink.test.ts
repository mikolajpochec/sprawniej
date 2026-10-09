import { expect, test } from 'bun:test'
import { joinLink, linkIsForSomeoneElse, readJoinLink } from '@/features/onboarding/joinLink'

test('join links carry who was invited', () => {
  const link = readJoinLink('#/join/acme/workspace-sprawniej-acme?ws=Acme+Studio&by=ana&for=Tom-K')
  expect(link).toEqual({ repo: { owner: 'acme', repo: 'workspace-sprawniej-acme' }, ws: 'Acme Studio', by: 'ana', for: 'Tom-K' })
})

test('older links without a name still open', () => {
  expect(readJoinLink('/join/acme/data')).toEqual({ repo: { owner: 'acme', repo: 'data' }, ws: undefined, by: undefined, for: undefined })
  expect(readJoinLink('#/team/WEB')).toBeNull()
})

test('a link made for someone else is noticed, ignoring letter case', () => {
  const link = readJoinLink('#/join/acme/data?for=Tom-K')!
  expect(linkIsForSomeoneElse(link, 'tom-k')).toBe(false)
  expect(linkIsForSomeoneElse(link, 'testaccount')).toBe(true)
  expect(linkIsForSomeoneElse(readJoinLink('#/join/acme/data')!, 'testaccount')).toBe(false)
})

test('the published app makes a link for the invited person that reads back the same', () => {
  const was = globalThis.location
  globalThis.location = new URL('https://mikolajpochec.github.io/sprawniej/') as unknown as Location
  try {
    const made = { repo: { owner: 'acme', repo: 'data' }, ws: 'Final Test', by: 'mikolajpochec', for: 'testaccount-mp' }
    const link = joinLink(made)!
    expect(link).toBe('https://mikolajpochec.github.io/sprawniej/#/join/acme/data?ws=Final+Test&by=mikolajpochec&for=testaccount-mp')
    expect(readJoinLink(new URL(link).hash)).toEqual(made)
  } finally {
    globalThis.location = was
  }
})
