# Changelog

Versions are `MAJOR.MINOR.PATCH`: major = the repo format or the way you work changes, minor = a new feature,
patch = fixes and polish. Written from `src/version.ts` by `bun scripts/changelog.ts`.

## 0.9.0: Phones, several issues at once, and a welcome tour
*2026-10-07*

- Works on phones: the sidebar opens from the menu button, and you press and hold an issue to drag it
- Pick several issues with ⌘-click, Shift-click or X, then drag them together or change them all at once
- A short tour shows newcomers around; replay it from Help
- The Display menu closes when you pick up an issue
- Fixed: some issues with sub-issues showed an empty page

## 0.8.0: Search, shortcuts and pictures
*2026-10-07*

- Press ⌘ K (or the search box) to find any issue by ID or title and jump to any page
- S, P, A and L change status, priority, assignee and labels of the issue under the mouse
- J and K move between issues; Esc goes back from an issue
- Paste or drop pictures into descriptions and comments

## 0.7.0: Import from Linear
*2026-10-07*

- Settings › Import from Linear brings teams, issues, comments, projects and labels over
- Issue numbers stay the same, and people are matched by name (you can fix any match)
- Run it again later to bring in new changes without making copies

## 0.6.0: Comments, sub-issues and your inbox
*2026-10-07*

- Comment on issues, with @ mentions; edit or delete your own comments
- A comment you haven’t sent yet waits for you if you leave the page
- Add sub-issues right from an issue: type a title, press Enter, type the next one
- Your inbox tells you when you’re assigned, mentioned, or someone comments on your issues
- Mark notes as read one by one or all at once, and delete the ones you’re done with
- Old inbox notes clear themselves, so your workspace stays quick

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
