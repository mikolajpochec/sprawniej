/**
 * The app's version and its changelog: one list, used by "What's new" in the app and by
 * `scripts/changelog.ts` (which writes CHANGELOG.md from it). Newest release first.
 *
 * Numbering (see CLAUDE.md): MAJOR.MINOR.PATCH. Major = the repo format or the way you work changes,
 * minor = a new feature, patch = fixes and polish. Notes are written for the people using Sprawniej.
 */
export const APP_VERSION = '0.6.0'

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
    version: '0.6.0',
    date: '2026-10-07',
    title: 'Comments, sub-issues and your inbox',
    notes: [
      'Comment on issues, with @ mentions; edit or delete your own comments',
      'A comment you haven’t sent yet waits for you if you leave the page',
      'Add sub-issues right from an issue: type a title, press Enter, type the next one',
      'Your inbox tells you when you’re assigned, mentioned, or someone comments on your issues',
      'Mark notes as read one by one or all at once, and delete the ones you’re done with',
      'Old inbox notes clear themselves, so your workspace stays quick',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-10-07',
    title: 'Tidier boards',
    notes: ['Boards show only columns with issues; empty ones wait under Hidden columns, and you can drop a card on them'],
  },
  {
    version: '0.4.0',
    date: '2026-10-07',
    title: 'Views, projects and labels',
    notes: [
      'Filter any list by status, assignee, priority, labels, project or team',
      'Save filters as a view with its own emoji, for the whole workspace or one team',
      'Rename views, change their emoji and filters in place; changes save for everyone',
      'Create projects with a status, lead, target date and teams, and see how much is done',
      'Manage labels in Settings: rename, recolour, delete',
      'Fixed: ⌘ Enter in the new issue dialog sometimes created the issue twice',
    ],
  },
  {
    version: '0.3.0',
    date: '2026-10-07',
    title: 'Drag and drop',
    notes: [
      'Drag issues to arrange them, in a list or on a board',
      'Drop an issue into another column or group to change its status, priority, assignee or project',
      'No mouse needed: Space picks an issue up, arrows move it, Space drops it',
      'New Display menu: group and sort issues your way, hide finished issues or sub-issues',
    ],
  },
  {
    version: '0.2.1',
    date: '2026-10-07',
    title: 'Faster, and calmer with many tabs',
    notes: [
      'Sprawniej opens faster: the editor loads in the background',
      'Several tabs with the same workspace work together and save once',
      'Very busy hours save in small batches instead of hitting GitHub’s limits',
      'Typing an issue title saves once you pause, not on every key',
      'Long issue lists with sub-issues scroll more smoothly',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-10-07',
    title: 'Create and edit issues',
    notes: [
      'Press C anywhere to create an issue; only a title is needed',
      'Descriptions format as you type: bold, lists, checklists, code, links',
      'Type @ to mention someone, and an issue ID like ENG-7 to point at it',
      'Change status, priority, assignee, labels, project and parent from the issue page',
      'Create labels on the spot, move issues to another team, delete issues',
      'Working at the same time as teammates never asks you to pick a version',
    ],
  },
  {
    version: '0.1.1',
    date: '2026-10-06',
    title: 'Workspaces are easy to spot',
    notes: [
      'New workspaces are stored in a repository named workspace-sprawniej-…',
      'Those workspaces come first when you choose one',
    ],
  },
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
