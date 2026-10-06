# Importing from Linear

Settings → Import from Linear brings a Linear workspace over in one go. It talks to Linear's GraphQL API straight
from the browser (Linear allows that), so nothing passes through a server of ours.

## Steps

1. **Key**: paste a Linear personal API key (Linear → Settings → Security & access → Personal API keys). It is
   used for this import only and not stored.
2. **Teams**: pick which Linear teams to bring. Each becomes a Sprawniej team with the same key (`ENG`), so
   `ENG-123` stays `ENG-123`. If the key is taken, you choose a new one.
3. **People**: Linear people are matched to GitHub people in the workspace by name. You can fix any match or leave
   someone unmatched (their issues come in unassigned, and their comments say who wrote them).
4. **Import**: everything is written as files and saved as one change, `Import from Linear: 412 issues`.

## What comes over

| Linear | Sprawniej |
| --- | --- |
| Team (key, name, icon emoji) | Team |
| Workflow state | Status: by name first (`In Review`), then by Linear's state type (`started` → In Progress, `unstarted` → Todo, `backlog` → Backlog, `completed` → Done, `canceled` → Canceled). `Triage` becomes Backlog. |
| Priority 0 to 4 | Same numbers |
| Issue number, title, description (Markdown) | Same |
| Assignee | Matched GitHub person, or no one |
| Labels | Labels (group labels are flattened: `Area/Charts` becomes `Area: Charts`) |
| Project (name, icon, description, state, lead, target date) | Project |
| Parent issue | Parent (sub-issues) |
| Sort order | `sortOrder`, keeping Linear's order |
| Comments | Comments, with the original author and date. Unmatched authors are shown as "From Linear: Name". |
| Created, updated, completed dates | Kept |

## What doesn't

- Cycles, estimates, SLAs, customer requests, integrations, agents: Sprawniej doesn't have them.
- Custom views: their filters are too different to map reliably. Recreate the few you need (it takes a minute and
  you get to pick an emoji).
- Images and files uploaded to Linear stay as links to Linear. They only open for people signed in to Linear.

## Running it again

Each imported file remembers its Linear id (`linearId`). Running the import again updates those issues instead of
making copies, so you can import once early and again on switch-over day.
