# How Sprawniej works

Sprawniej is a web page and nothing else. There is no server of ours. The data lives in a **GitHub repo** that
the team picks: each issue, comment, view and project is a small file there. The page keeps a copy of that repo in
the browser, changes files when you work, and sends the changes to GitHub on its own.

This is the same idea as [peeponote](https://github.com/mikolajpochec/peeponote), our canvas app. Unlike peeponote we
don't run git in the browser: we only ever talk to GitHub, so we use GitHub's API directly. That needs fewer requests
and no special tricks.

## The big picture

```
Browser (Sprawniej, a PWA on GitHub Pages)
  React screens
     |  call
     v
  src/data/actions.ts  (the only code that changes data)
     |-> data store (zustand)              the screen updates at once
     |-> "pending" file in IndexedDB       survives a closed tab or a crash
     '-> save (src/sync/engine.ts)         ~1.5 s later: one commit on GitHub

  every 30 s, on focus, on reconnect:
     "anything new?" -> download changed files -> merge with pending -> store

GitHub repo (for example acme/sprawniej-data) = the workspace
```

## Signing in

- You paste a **classic GitHub token** with the `repo` scope. In the app we call it a "GitHub key".
- The app asks GitHub who you are (`GET /user`) and uses your login, name and picture. That is your account.
  There are no separate passwords.
- The token stays in this browser (localStorage). Signing out removes it.
- People in a workspace are the people GitHub lets in (`GET /repos/{owner}/{repo}/assignees`). Each person also
  writes `people/<login>.json` the first time they open the workspace, so names and pictures work offline.
- Anyone who can push to the repo can change anything. We don't sign files.

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

Join links use the app's public address: `VITE_PUBLIC_URL` at build time, or else the address the app is served
from (`src/config.ts`). On localhost there is no link to share, so Settings doesn't show one.

A short tour follows the first visit. The owner's own setup (creating the workspace repo) is a separate, guided path.

### Workspace repositories

Repositories Sprawniej creates are private and named `workspace-sprawniej-<name>` (`src/features/onboarding/repoNames.ts`).
When you choose a workspace, those come first, under *Sprawniej workspaces*; any other repository you can save to is
listed after them and opens fine too. "Invitations for you" only shows invitations to `workspace-sprawniej-` repositories,
so the app never accepts an unrelated GitHub invitation.

## The copy in your browser

Each workspace has its own IndexedDB database (`src/sync/local.ts`) with:

- **base**: every file as it is on GitHub at a known commit,
- **pending**: your changes that haven't reached GitHub yet (a deleted file is stored as nothing),
- **meta**: which commit `base` matches, and the branch.

What you see is base with pending laid on top. The first time you open a workspace, every file is downloaded (100 per
request, through GitHub's GraphQL API). After that only changed files are.

## Saving (there is no Save button)

1. An action updates the store and writes the file to the local repo straight away.
2. After about 1.5 seconds without new changes (or at once when you hide the tab), all pending files go to GitHub as
   one commit with a plain message, such as `ENG-12: In Progress -> Done`. That is three requests: a new tree on top
   of the last known one, a commit, and moving the branch.
3. Moving the branch refuses to overwrite a teammate's newer save. Then we pull, merge, and try again (up to 4 times).
4. An empty repository can't take a tree yet, so the very first file (`sprawniej.json`) is created through GitHub's
   contents API.
5. Offline, changes keep piling up in pending and go out when you are back online.

Commits are authored as `Name <id+login@users.noreply.github.com>`, so GitHub shows them as yours.

## Getting other people's changes

We check GitHub every 30 seconds while the tab is visible, when the tab gets focus, and when the network comes
back. The check asks for the branch with an ETag, so "nothing changed" doesn't use up GitHub's rate limit. When the
branch moved, GitHub's compare API lists the changed files (if it can't, for example after a rewritten history, we
compare whole file lists by their git ids). We download only those, merge them with pending, and update the screen
before anything else runs, so your next edit starts from the merged version.

## Merge rules: nobody ever sees a conflict

Two people working at the same time must never be asked to choose between versions. Most things are separate
files with a single writer, so they can't clash at all. Where two people can touch the same file, the app merges
field by field, and when they changed the very same field the later save wins, exactly what a normal app with a
server does. The code is `src/sync/merge.ts` (`mergeIncoming`), and every row below has a test in
`tests/merge.test.ts`.

| What two people do at the same time | What happens | Notice? |
| --- | --- | --- |
| Comment on the same issue | Both comments appear (one file per comment) | No |
| Edit different fields of one issue (status, assignee…) | Both changes stay | No |
| Change the same field of one issue | The later save wins | No |
| Add or remove labels on one issue | Both sides' additions and removals apply | No |
| Edit different parts of a description | Lines merge | No |
| Rewrite the same lines of a description | The later save's lines win; the other version stays in GitHub history | Yes, a small one, because text disappeared |
| Edit one view (filters, emoji, layout…) | Field by field; filter lists merge like labels | No |
| Edit one project, team, label or the workspace name | Field by field; the same field: later save wins | No |
| Join or leave the same team | Membership lists merge | No |
| Create issues | Separate files; if both got the same number while offline, the one not yet saved takes the next number | Yes, because the number changed ("ENG-12 is now ENG-14") |
| One deletes an issue, the other edits it | The edit wins and the issue stays | No |
| One moves an issue to another team, the other edits it | One issue, in the new team, with the edit | No |
| Mark inbox items as read on two devices | Read lists merge | No |
| Drag issues around | Each drag rewrites only the moved issue; the same issue: later drop wins | No |

"Later save" means whoever's changes reach GitHub second. Someone who was offline for an hour and then comes back
counts as later, just as their request would arrive later at a server.

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
| `src/github` | Every call to GitHub (REST and GraphQL), with errors in plain words |
| `src/sync` | The browser copy, the save and pull loop, merging, renumbering |
| `src/session.ts` | Who is signed in, which workspace is open (localStorage) |
| `src/features/onboarding` | Sign-in, the join wizard, choosing and creating workspaces |
| `src/features/*` | Screens, one folder per area (issues, views, projects, inbox, import, help…) |
| `src/components` | Small shared pieces (avatar, empty state, segmented switch) |
| `src/ui` | shadcn/ui components |
| `tests` | `bun test` for the pure logic |

Routes use the URL hash (`#/team/ENG/issues/active`, `#/issue/ENG-12`) because GitHub Pages serves a single file.

## Main libraries

React 19, Vite, Tailwind v4, shadcn/ui (Radix), lucide icons, zustand, zod, idb-keyval (IndexedDB), yaml, node-diff3
(description merges), sonner (messages),
TipTap (descriptions and comments, stored as Markdown), dnd-kit (drag-n-drop), frimousse (emoji picker),
cmdk (the ⌘K palette), wouter (routes).
