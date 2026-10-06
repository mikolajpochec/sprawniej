/** Shown while issues are picked: how many, and buttons to change or delete all of them at once. */
import { useState } from 'react'
import { CircleDot, SignalHigh, Tag, Trash2, UserRound, X } from 'lucide-react'
import { usePalette, type QuickField } from '@/app/palette'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { deleteIssue } from '@/data/actions'
import { Button } from '@/ui/button'
import { clearSelection, useSelection } from './selection'

const FIELDS: [QuickField, string, typeof CircleDot, string][] = [
  ['status', 'Status', CircleDot, 'S'],
  ['priority', 'Priority', SignalHigh, 'P'],
  ['assignee', 'Assignee', UserRound, 'A'],
  ['labels', 'Labels', Tag, 'L'],
]

export function SelectionBar() {
  const ids = useSelection((s) => s.ids)
  const [confirm, setConfirm] = useState(false)
  if (!ids.length) return null
  return (
    <div role="toolbar" aria-label="Picked issues" className="fixed bottom-6 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-xl border bg-popover p-1.5 shadow-xl">
      <span className="px-3 text-sm whitespace-nowrap tabular-nums">{ids.length} picked</span>
      {FIELDS.map(([field, label, Icon, key]) => (
        <Button key={field} variant="ghost" size="sm" onClick={() => usePalette.setState({ quick: { issues: ids, field } })} title={`${label} (${key})`}>
          <Icon /> <span className="hidden sm:inline">{label}</span>
        </Button>
      ))}
      <Button variant="ghost" size="sm" className="text-red-300" onClick={() => setConfirm(true)}>
        <Trash2 /> <span className="hidden sm:inline">Delete</span>
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Unpick all (Esc)" onClick={clearSelection}>
        <X />
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${ids.length} issues?`}
        confirm="Delete"
        onConfirm={() => {
          for (const id of ids) deleteIssue(id)
          clearSelection()
        }}
      >
        They and their comments will be removed for everyone. Their sub-issues stay.
      </ConfirmDialog>
    </div>
  )
}
