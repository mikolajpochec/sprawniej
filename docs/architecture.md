# How Sprawniej works

Sprawniej is a web page and nothing else. There is no server of ours. The data lives in a **GitHub repo** that
the team picks: each issue, comment, view and project is a small file there. The page keeps a copy of that repo in
the browser, changes files when you work, and sends the changes to GitHub on its own.

This is the same idea as [peeponote](https://github.com/mikolajpochec/peeponote), our canvas app. The git layer is
copied from it.

## The big picture

```
Browser (Sprawniej, a PWA on GitHub Pages)
  React screens
     |  call
     v
  src/data/actions.ts  (the only code that changes data)
     |-> data store (zustand)              the screen updates at once
     |-> file in the local repo            survives a closed tab or a crash (IndexedDB)
     '-> save queue                        ~1.5 s later: commit + push to GitHub

  every 30 s, on focus, on reconnect:
     fetch from GitHub -> merge -> reload the files that changed -> store

GitHub repo (for example acme/sprawniej-data) = the workspace
```

## Signing in

- You paste a **classic GitHub token** with the `repo` scope. In the app we call it a "GitHub key".
- The app asks GitHub who you are (`GET /user`) and uses your login, name and picture. That is your account.
  There are no separate passwords.
- The token stays in this browser (localStorage). Signing out removes it.
- People in a workspace are the people GitHub lets in (`GET /repos/{owner}/{repo}/assignees`). Each person also
  writes `people/<login>.json` the first time they open the workspace, so names and pictures work offline.
- Anyone who can push to the repo can change anything, just like in Linear. We don't sign files.

### Joining a workspace (teammates)

The owner invites someone by GitHub username from Settings. The app adds them as a collaborator
(`PUT /repos/{owner}/{repo}/collaborators/{user}`) and gives back a join link (`#/join/<owner>/<repo>`) with a
ready-to-send message. The link opens a wizard with one step per screen:

1. **Welcome**: what Sprawniej is, in one sentence, with the team's pictures.
2. **GitHub account**: "I have one" or "Create one" (opens github.com/signup).
3. **Accept the invitation**: a button to GitHub's invitation page. The app checks every few seconds and moves on
   by itself once it is accepted.
4. **Make your key**: a button opens GitHub's token page with everything filled in, next to three small
   screenshots (scroll down, press the green button, copy). The pasted key is checked at once, and errors say what
   to do ("This key can't open Acme's workspace yet. Did you accept the invitation in step 3?").
5. **That's you!**: your GitHub picture and name, and "Let's go".

A short tour follows the first visit. The owner's own setup (creating the workspace repo) is a separate, guided path.

## Saving (there is no Save button)

1. An action updates the store and writes the file to the local repo straight away.
2. After about 1.5 seconds without new changes (or at once when you leave the page or hide the tab), the save
   queue commits the changed files with a plain message, such as `ENG-12: In Progress -> Done`, and pushes.
3. If GitHub says someone else pushed first, we fetch, merge, and push again (up to 3 times).
4. Offline, changes keep piling up in the local repo and go out when you are back online.

Commits are authored as `Name <id+login@users.noreply.github.com>`, so GitHub shows them as yours.

## Getting other people's changes

We check GitHub every 30 seconds while the tab is visible, when the tab gets focus, and when the network comes
back. The check sends an ETag, so "nothing changed" doesn't use up GitHub's rate limit. When there is something
new, we merge it and reload only the files that changed.

## Merge rules

Most changes touch different files (one file per issue, per comment), so they just combine. When two people
changed **the same issue**:

| Situation | Result |
| --- | --- |
| Different fields changed (say, status and assignee) | Both changes are kept. |
| The same field changed on both sides | The later save wins, as in Linear. |
| Both edited the description | Lines are merged. Where the same lines changed, the later save wins, the other version stays in history, and a message says so. |
| One edited, the other deleted | The edit wins and the issue stays. |
| Both created an issue with the same number while offline | The one not yet on GitHub gets the next free number, with a message ("ENG-12 is now ENG-14"). |

Comments, inbox items, people files and personal read marks have a single writer each, so they never clash.

## Ordering and drag-n-drop

Each issue has a `sortOrder` string made with [fractional-indexing](https://github.com/rocicorp/fractional-indexing).
Dropping an issue between two others gives it a key between theirs, so only the moved issue's file changes. List and
board use the same order. Dropping into another column or group also changes that field (status, assignee, priority
or project).

## Code layout

| Folder | What's inside |
| --- | --- |
| `src/app` | The frame (sidebar, top bar), routes, the save chip |
| `src/model` | File schemas (zod) and the fixed statuses and priorities |
| `src/data` | The store, pure selectors (filter, group, sort), `actions.ts`, the save queue |
| `src/git`, `src/fs` | The git layer from peeponote: local repo in IndexedDB, GitHub transport, merging |
| `src/features/*` | Screens, one folder per area (issues, views, projects, inbox, import, help…) |
| `src/components` | Small shared pieces (avatar, empty state, segmented switch) |
| `src/ui` | shadcn/ui components |
| `tests` | `bun test` for the pure logic |

Routes use the URL hash (`#/team/ENG/issues/active`, `#/issue/ENG-12`) because GitHub Pages serves a single file.

## Main libraries

React 19, Vite, Tailwind v4, shadcn/ui (Radix), lucide icons, zustand, zod, isomorphic-git with lightning-fs,
TipTap (descriptions and comments, stored as Markdown), dnd-kit (drag-n-drop), frimousse (emoji picker),
cmdk (the ⌘K palette), wouter (routes).
