# Welcome to Sprawniej

Sprawniej is where our team keeps track of work: tasks, bugs and ideas. This page explains everything you need.
No technical knowledge required.

## Getting in

You need two things, and the join link walks you through both:

1. **A GitHub account.** GitHub is where Sprawniej keeps the team's work. If you don't have an account, the join
   link helps you make one (it's free).
2. **A GitHub key.** It's like a password that lets Sprawniej save your work for you. The join link opens GitHub
   with everything filled in. You just scroll down, press the green **Generate token** button, and copy the key
   back into Sprawniej.

You only do this once per browser. The join link also accepts the GitHub invitation for you.

### Inviting someone

Open the menu under your name (bottom left) and choose **Settings and people**. Type their GitHub username and press
**Invite**, then send them the join link from the same page. (Only the workspace's admins can invite.)

## Your work saves by itself

There is no Save button. Whatever you type or change is kept right away. In the top bar you'll see:

- **Saved**: everything is safe and your teammates can see it.
- **Saving…**: it's on its way, give it a second.
- **Offline: your changes are safe on this device**: no internet right now. Keep working; everything goes out when
  you're back online.

Your teammates' changes show up on their own, too.

## Issues

An **issue** is one piece of work: a task, a bug, an idea. Each has a short ID like `ENG-12` (team + number).

- **Create one:** press **C** anywhere, the pencil next to "Sprawniej" at the top left, or the **+** next to a group.
  Give it a title; status, priority, assignee, labels, project and parent are optional buttons below.
  Press `⌘` `Enter` (or `Ctrl` `Enter`) to create it. Tick **Create more** to add several in a row.
- **Open one:** click it. Change the title, description or any property on the right. It saves by itself.
- **Labels:** in the labels menu, type a name that doesn't exist yet and choose **Create label**.
- **Move to another team:** change **Team** on the right. The issue gets that team's next number.
- **Delete:** the `⋯` button next to the title, then **Delete issue**.
- **Links and formatting:** paste a link and it becomes clickable. Select some words and paste a link to turn
  them into a link. Type `**bold**`, `- ` for a list, or `[] ` for a checklist, and it formats as you type.
- **Mention someone:** type `@` and their name. They'll get a note in their Inbox.
- **Point to another issue:** type its ID, like `ENG-7`. Hold `⌘` (or `Ctrl`) and click it to open it.

### Working at the same time as others

You never have to choose between your changes and a teammate's. If you both change different things, both stay. If
you both change the same thing (say, the status), the one saved last stays, as in any app. The only time you'll see a
note is when you both rewrote the same lines of a description; your text is kept, and theirs stays in the history.

### Statuses

| Status | Means |
| --- | --- |
| Backlog | We might do it some day. |
| Todo | We plan to do it soon. |
| In Progress | Someone is working on it. |
| In Review | It's done and waiting for someone to check it. |
| Done | Finished. |
| Canceled | We decided not to do it. |
| Duplicate | Someone already reported the same thing. |

### Priority

**Urgent** (orange), **High**, **Medium**, **Low** (fewer bars = lower), or no priority (three dashes).

### Sub-issues

Big issues can be split into smaller **sub-issues**. The parent shows a counter like `2/5` (two of five done).

## Lists and boards

Every list of issues can be shown two ways. Switch with **List / Board** at the top right.

- **List:** rows grouped by status. Sub-issues sit just under their parent.
- **Board:** a column per status, with cards.

**Drag and drop** works in both. Drag an issue up or down to change its order, or into another group or column to
change its status. Your teammates see the new order too. No mouse? Move to an issue with `Tab`, press `Space` to
pick it up, use the arrow keys, and press `Space` again to drop it (`Esc` puts it back).

**Display** (next to List / Board) changes how the page looks, just for you:

- **Grouping:** by status, assignee, priority, project, or no groups at all. Dropping an issue into a group gives it
  that group's assignee, priority or project.
- **Ordering:** **Manual** is the order you and your teammates arrange by dragging. You can also sort by priority,
  by last update, or newest first. Dragging to reorder only works in Manual order.
- **Show finished issues** and **Show sub-issues** hide or show those.
- **Back to default** undoes your changes.

On your team's page, the tabs show:

- **Active**: Todo, In Progress and In Review.
- **Backlog**: ideas for later.
- **All issues**: everything, including finished work.

## Teams

Your teams are in the sidebar under **Your teams**. Each team has its own **Issues**, **Projects** and **Views**.
Press **+** next to *Your teams* to join a team or create a new one.

## Filters

**Filter** (above every list) narrows it down: by status, assignee, priority, labels, project or team. Each filter
shows as a chip. Click a chip to change it, or its **×** to remove it. Inside one filter, any of the chosen values
counts ("Todo or In Progress"); several filters must all match ("Todo, and assigned to Ana").

Filters you set on a team's page or on My issues are just for you, and go away when you leave the page. To keep
them, press **Save as view**.

## Views

A **view** is a saved set of filters with its own emoji, like "🐞 Open bugs" or "📊 Insights". Open **Views** in the
sidebar to see them, and **New view** to make one. A view shows issues from the whole workspace or from one team.

A view belongs to everyone. Changing its name, emoji, description, filters, grouping or List / Board saves straight
away, for everyone. To remove a view, use **⋯ › Delete view**; its issues stay as they are.

## Projects

A **project** is a bigger goal made of several issues, like "New onboarding". **New project** on the Projects page
starts one. On its page you can change its emoji, name and description in place, and set its status, who leads it,
a target date and which teams work on it. The bar shows how many of its issues are done.

Add issues to a project from the project's page, or pick the project on any issue. Deleting a project
(**⋯ › Delete project**) keeps its issues; they just no longer belong to a project.

## Labels

Labels like "Bug" or "Design" sort issues across teams. Make one right from an issue (type a new name in the
labels menu), or in **Settings › Labels**, where you can also rename, recolour and delete them. Changes apply to
every issue that has the label.

## Inbox

Your **Inbox** tells you when someone assigns you an issue, mentions you, or comments on your issue. The number in
the sidebar is how many you haven't seen.

## Handy keys

| Key | Does |
| --- | --- |
| `C` | New issue |
| `⌘` `K` | Search and jump anywhere |
| `S` | Change status of the issue under the mouse |
| `P` | Change priority |
| `A` | Change who it's assigned to |
| `L` | Change labels |
| `Esc` | Go back |

## Something went wrong?

- **"Your GitHub key stopped working"**: keys can expire. Make a new one (the app shows a button that opens the
  right GitHub page) and paste it in.
- **"You don't have access to this workspace"**: ask the person who invited you to invite you again, then accept the
  invitation on GitHub.
- **Using a shared computer?** Open the menu under your name at the bottom left, choose **Sign out**, and confirm on
  the page that opens. It removes your key and the workspace from that browser.
