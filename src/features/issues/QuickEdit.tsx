/**
 * The menu that S (status), P (priority), A (assignee) and L (labels) open for the issue under the mouse, the
 * focused one, or the open one. Pick with the keyboard or the mouse; labels stay open so you can tick several.
 */
import { Check } from 'lucide-react'
import { usePalette, type QuickField } from '@/app/palette'
import type { PickerItem } from '@/components/Picker'
import { updateIssue } from '@/data/actions'
import { issueRef, useData } from '@/data/store'
import { cn } from '@/lib/utils'
import type { Issue } from '@/model/schema'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/ui/command'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/ui/dialog'
import { priorityItems, statusItems, useLabelItems, usePeopleItems } from './pickers'

const TITLES: Record<QuickField, string> = { status: 'Change status', priority: 'Change priority', assignee: 'Assign to', labels: 'Change labels' }

function Menu({ issue, field }: { issue: Issue; field: QuickField }) {
  const people = usePeopleItems()
  const labels = useLabelItems()
  const close = () => usePalette.setState({ quick: null })
  const items = (field === 'status' ? statusItems : field === 'priority' ? priorityItems : field === 'assignee' ? people : labels) as PickerItem<unknown>[]
  const chosen = (v: unknown) => (field === 'labels' ? issue.labels.includes(v as string) : issue[field] === v)

  function pick(v: unknown) {
    if (field === 'labels') {
      const id = v as string
      updateIssue(issue.id, { labels: issue.labels.includes(id) ? issue.labels.filter((l) => l !== id) : [...issue.labels, id] })
      return
    }
    updateIssue(issue.id, { [field]: v })
    close()
  }

  return (
    <Command>
      <CommandInput placeholder={`${TITLES[field]}…`} />
      <CommandList>
        <CommandEmpty>Nothing found.</CommandEmpty>
        <CommandGroup>
          {items.map((i, n) => (
            <CommandItem key={n} value={`${i.label} ${(i.keywords ?? []).join(' ')}`} onSelect={() => pick(i.value)}>
              {i.icon}
              <span className="truncate">{i.label}</span>
              <Check className={cn('ml-auto size-4', !chosen(i.value) && 'invisible')} />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

export function QuickEdit() {
  const quick = usePalette((s) => s.quick)
  const issue = useData((s) => (quick ? s.issues[quick.issue] : undefined))
  return (
    <Dialog open={!!quick && !!issue} onOpenChange={(o) => !o && usePalette.setState({ quick: null })}>
      {quick && issue && (
        <DialogContent className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-md" showCloseButton={false}>
          <div className="flex items-center gap-2 border-b px-3 py-2 text-sm text-muted-foreground">
            <DialogTitle className="text-sm font-normal">
              {TITLES[quick.field]}: <span className="text-foreground">{issueRef(issue)}</span>
            </DialogTitle>
            <DialogDescription className="truncate">{issue.title}</DialogDescription>
          </div>
          <Menu issue={issue} field={quick.field} />
        </DialogContent>
      )}
    </Dialog>
  )
}
