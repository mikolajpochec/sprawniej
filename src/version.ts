/**
 * The app's version and its changelog: one list, used by "What's new" in the app and by
 * `scripts/changelog.ts` (which writes CHANGELOG.md from it). Newest release first.
 *
 * Numbering (see CLAUDE.md): MAJOR.MINOR.PATCH. Major = the repo format or the way you work changes,
 * minor = a new feature, patch = fixes and polish. Notes are written for the people using Sprawniej.
 */
export const APP_VERSION = '0.1.0'

export interface Release {
  version: string
  /** YYYY-MM-DD */
  date: string
  /** what this release is about, one short line */
  title: string
  /** what changed, in the user's words */
  notes: string[]
}

export const CHANGELOG: Release[] = [
  {
    version: '0.1.0',
    date: '2026-10-06',
    title: 'Sign in and everything saves by itself',
    notes: [
      'Sign in with your GitHub account, then open or create a workspace',
      'Invite people by their GitHub username and send them a join link that walks them through getting in',
      'Everything you change is saved on its own, and your teammates’ changes show up within half a minute',
      'Works offline: your changes wait on your device and go out when you’re back',
      'When two people change the same issue at once, both changes are kept wherever they don’t overlap',
      'Create teams and join the ones you work with',
    ],
  },
  {
    version: '0.0.0',
    date: '2026-10-06',
    title: 'A first look',
    notes: ['A sample workspace to click through: teams, issues in a list or on a board, views, projects and the inbox'],
  },
]

export const latestRelease = () => CHANGELOG[0]
