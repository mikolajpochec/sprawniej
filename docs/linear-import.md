# Importing from Linear

Settings → Import from Linear brings a Linear workspace over in one go. It talks to Linear's GraphQL API straight
from the browser (Linear allows that), so nothing passes through a server of ours.

## Steps

1. **Key**: paste a Linear personal API key (Linear → Settings → Security & access → Personal API keys). It is
   used for this import only and not stored.
2. **Teams**: pick which Linear teams to bring. Each becomes a Sprawniej team with the same key (`ENG`), so
   `ENG-123` stays `ENG-123`. If a team here already uses that key, the issues join that team (handy for the
   first team made during setup); type another key to make a new team instead. If that team already has an issue
   with the same number, the imported one gets the next free number, and the check step lists these.
3. **People**: Linear people are matched to GitHub people in the workspace by name. You can fix any match or leave
   someone unmatched (their issues come in unassigned, and their comments say who wrote them).
4. **Check**: how many teams, issues, comments, projects and labels will come over.
5. **Import**: everything is written as files and saved as `Import from Linear: 412 issues`. Big imports are
   saved in parts of 300 files (`… (part 2 of 5)`), with a progress bar; keep the page open until it's done.

The code: `src/features/import/linearApi.ts` reads Linear, `linearMap.ts` turns it into files (pure, tested in
`tests/linearImport.test.ts`), and `ImportPage.tsx` is the wizard.

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
| Due date, estimate | Kept (any estimate number stays as it is) |
| Created, updated, completed dates | Kept |

Issues finished longer ago than the team keeps finished issues (six months unless it says otherwise) go straight
into the team's archive files, with their comments, instead of becoming a file each. They keep their numbers and can
be searched, opened and restored like any archived issue.

## What doesn't

- Cycles, SLAs, customer requests, integrations, agents: Sprawniej doesn't have them.
- Custom views: their filters are too different to map reliably. Recreate the few you need (it takes a minute and
  you get to pick an emoji).
- Images and files uploaded to Linear stay as links to Linear. They only open for people signed in to Linear.

## Running it again

Each imported file remembers its Linear id (`linearId`), and so does a team that took in a Linear team. Running the
import again picks those teams by itself and updates what came over instead of making copies, so you can import
once early and again on switch-over day. Linear's version wins for imported issues; issues made here are left alone.
Issues deleted in Linear stay here, and issues archived here since the last import stay archived.
