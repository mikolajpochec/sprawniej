# The workspace repo

A workspace is a GitHub repo full of small, readable files. You can browse it on GitHub, edit a file by hand, or
look at its history. The app checks every file with the schemas in `src/model/schema.ts`. A file it can't
understand is skipped with a warning; it never breaks the app.

Format version: **1** (in `sprawniej.json`). Changing the meaning or place of any file below is a MAJOR release
and needs a migration.

## Layout

```
sprawniej.json                           the workspace: name, format version
people/<login>.json                      one person (written by that person)
labels/<id>.json                         one label
teams/<KEY>/team.json                    one team
teams/<KEY>/issues/<id>.md               one issue
teams/<KEY>/comments/<issueId>/<id>.md   one comment (written by its author)
projects/<id>.json                       one project
views/<id>.json                          one saved view
inbox/<login>/<id>.json                  one notification for <login> (written by whoever caused it)
state/<login>.json                       what <login> has read (written by that person)
assets/<sha>.<ext>                       pasted images
```

Ids are [ULIDs](https://github.com/ulid/spec): random, sortable by time, and never reused. File names use ids, not
titles or numbers, so renaming an issue never moves its file.

Fields we don't know are kept as they are when the app rewrites a file. Newer versions can add fields safely.

## sprawniej.json

```json
{ "name": "Software Mansion", "format": 1, "createdAt": "2026-10-06T10:00:00.000Z" }
```

## people/mikolajpochec.json

```json
{ "login": "mikolajpochec", "githubId": 123456, "name": "Mikołaj Pocheć", "avatarUrl": "https://avatars.githubusercontent.com/u/123456" }
```

## teams/ENG/team.json

The folder name is the team key, which starts issue numbers (`ENG-12`). Keys are 1 to 7 capital letters or digits,
starting with a letter.

```json
{ "key": "ENG", "name": "Engineering", "emoji": "🛠️", "members": ["mikolajpochec", "ania-k"], "createdAt": "…" }
```

## teams/ENG/issues/01J9Z….md

YAML front matter with the fields, then the description in Markdown.

```markdown
---
id: 01J9ZQ4M3K8Y2V6T0R5N7B1C9D
number: 12
title: Simplify `Insights` graphs
status: in_review
priority: 1
assignee: ania-k
labels: [insights]
project: 01J9ZP…
parent: null
sortOrder: a0V
createdBy: mikolajpochec
createdAt: 2026-10-02T09:12:00.000Z
updatedAt: 2026-10-06T16:40:00.000Z
completedAt: null
---
Charts should be easier to read at a glance.

- Move the per-row numbers into **tooltips**
- See [the design file](https://example.com)
```

| Field | Meaning |
| --- | --- |
| `number` | Shown as `ENG-12`. Final once it reached GitHub. |
| `status` | `backlog`, `todo`, `in_progress`, `in_review`, `done`, `canceled`, `duplicate` (Linear's defaults) |
| `priority` | `0` none, `1` urgent, `2` high, `3` medium, `4` low (Linear's numbers) |
| `assignee` | A GitHub login, or `null` |
| `labels` | Label ids |
| `project`, `parent` | Ids, or `null`. `parent` makes this a sub-issue. |
| `sortOrder` | Position in lists and boards ([fractional index](architecture.md#ordering-and-drag-n-drop)) |
| `completedAt` | When it moved to Done, else `null` |
| `duplicateOf` | Issue id, only for `duplicate` |

Moving an issue to another team moves the file to that team's folder and gives it a new number there.

## teams/ENG/comments/<issueId>/<id>.md

```markdown
---
id: 01J9ZR…
issue: 01J9ZQ…
author: zosia
createdAt: 2026-10-03T11:00:00.000Z
editedAt: null
---
Colours are ready, see ENG-14. @ania-k
```

Only the author edits or deletes their comment.

## labels/<id>.json

```json
{ "id": "01J9…", "name": "Bug", "color": "#eb5757" }
```

## projects/<id>.json

```json
{
  "id": "01J9…", "name": "Insights page", "emoji": "📊", "description": "Charts that explain where the money goes.",
  "status": "in_progress", "lead": "ania-k", "teams": ["ENG", "DES"], "targetDate": "2026-11-15", "createdAt": "…"
}
```

`status` is one of `backlog`, `planned`, `in_progress`, `paused`, `completed`, `canceled`.

## views/<id>.json

```json
{
  "id": "01J9…", "name": "Bugs", "emoji": "🐞", "description": "Every open bug", "owner": "mikolajpochec",
  "team": "ENG",
  "filters": { "labels": ["bug"], "statuses": ["todo", "in_progress"] },
  "display": { "layout": "board", "grouping": "status", "ordering": "priority", "showCompleted": false, "showSubIssues": true },
  "createdAt": "…"
}
```

`team: null` makes a workspace view. Filters left out match everything. Inside one filter any value matches;
different filters must all match. `grouping`: `status`, `assignee`, `priority`, `project`, `none`.
`ordering`: `manual`, `priority`, `updated`, `created`.

## inbox/<login>/<id>.json

Written by the person who caused it, so it never clashes with anything.

```json
{ "id": "01J9…", "type": "assigned", "issue": "01J9ZQ…", "actor": "ania-k", "at": "…" }
```

`type`: `assigned`, `mentioned`, `commented`, `status`. `comment` holds the comment id for `mentioned` and `commented`.

## state/<login>.json

```json
{ "readUntil": "2026-10-05T00:00:00.000Z", "read": ["01J9…"] }
```

Everything up to `readUntil` counts as read ("Mark all as read"), plus the ids in `read`.
