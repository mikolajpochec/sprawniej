# Changelog

Versions are `MAJOR.MINOR.PATCH`: major = the repo format or the way you work changes, minor = a new feature,
patch = fixes and polish. Written from `src/version.ts` by `bun scripts/changelog.ts`.

## 0.5.0: Tidier boards
*2026-10-07*

- Boards show only columns with issues; empty ones wait under Hidden columns, and you can drop a card on them

## 0.4.0: Views, projects and labels
*2026-10-07*

- Filter any list by status, assignee, priority, labels, project or team
- Save filters as a view with its own emoji, for the whole workspace or one team
- Rename views, change their emoji and filters in place; changes save for everyone
- Create projects with a status, lead, target date and teams, and see how much is done
- Manage labels in Settings: rename, recolour, delete
- Fixed: ⌘ Enter in the new issue dialog sometimes created the issue twice

## 0.3.0: Drag and drop
*2026-10-07*

- Drag issues to arrange them, in a list or on a board
- Drop an issue into another column or group to change its status, priority, assignee or project
- No mouse needed: Space picks an issue up, arrows move it, Space drops it
- New Display menu: group and sort issues your way, hide finished issues or sub-issues

## 0.2.1: Faster, and calmer with many tabs
*2026-10-07*

- Sprawniej opens faster: the editor loads in the background
- Several tabs with the same workspace work together and save once
- Very busy hours save in small batches instead of hitting GitHub’s limits
- Typing an issue title saves once you pause, not on every key
- Long issue lists with sub-issues scroll more smoothly

## 0.2.0: Create and edit issues
*2026-10-07*

- Press C anywhere to create an issue; only a title is needed
- Descriptions format as you type: bold, lists, checklists, code, links
- Type @ to mention someone, and an issue ID like ENG-7 to point at it
- Change status, priority, assignee, labels, project and parent from the issue page
- Create labels on the spot, move issues to another team, delete issues
- Working at the same time as teammates never asks you to pick a version

## 0.1.1: Workspaces are easy to spot
*2026-10-06*

- New workspaces are stored in a repository named workspace-sprawniej-…
- Those workspaces come first when you choose one

## 0.1.0: Sign in and everything saves by itself
*2026-10-06*

- Sign in with your GitHub account, then open or create a workspace
- Invite people by their GitHub username and send them a join link that walks them through getting in
- Everything you change is saved on its own, and your teammates’ changes show up within half a minute
- Works offline: your changes wait on your device and go out when you’re back
- When two people change the same issue at once, both changes are kept wherever they don’t overlap
- Create teams and join the ones you work with

## 0.0.0: A first look
*2026-10-06*

- A sample workspace to click through: teams, issues in a list or on a board, views, projects and the inbox
