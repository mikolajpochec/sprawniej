/**
 * Due dates and estimates: the picker for a due day (quick choices and a calendar), the estimate choices, and the
 * small chips rows and cards show. A due date is a plain day ("2026-10-31"), the same day for everyone.
 */
import { useState, type ReactNode } from 'react'
import { CalendarClock, Triangle, X } from 'lucide-react'
import type { PickerItem } from '@/components/Picker'
import { cn } from '@/lib/utils'
import { ESTIMATES } from '@/model/status'
import { Calendar } from '@/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui/popover'
import { shortDate } from './format'

/** a Date as a plain day in this browser's time zone */
export function toDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const fromDay = (day: string) => new Date(`${day}T00:00`)
const addDays = (n: number, from = new Date()) => toDay(new Date(from.getFullYear(), from.getMonth(), from.getDate() + n))

/** "Today", "Tomorrow", "Yesterday", else "Oct 31" */
export function dayName(day: string, today = toDay(new Date())): string {
  const now = fromDay(today)
  if (day === today) return 'Today'
  if (day === addDays(1, now)) return 'Tomorrow'
  if (day === addDays(-1, now)) return 'Yesterday'
  return shortDate(day, now)
}

/** overdue (red), due within two days (amber), or later */
export function dueTone(day: string, today = toDay(new Date())): 'overdue' | 'soon' | 'later' {
  if (day < today) return 'overdue'
  return day <= addDays(2, fromDay(today)) ? 'soon' : 'later'
}

/** the next Monday, or the one after if today is Monday */
function nextMonday(): string {
  const d = new Date()
  return addDays(((8 - d.getDay()) % 7) || 7)
}

const QUICK = [
  { label: 'Today', day: () => addDays(0) },
  { label: 'Tomorrow', day: () => addDays(1) },
  { label: 'Next week', day: nextMonday },
  { label: 'In two weeks', day: () => addDays(14) },
]

export function DueDatePicker({ value, onChange, children, align = 'start' }: { value: string | null | undefined; onChange: (day: string | null) => void; children: ReactNode; align?: 'start' | 'end' }) {
  const [open, setOpen] = useState(false)
  const pick = (day: string | null) => {
    onChange(day)
    setOpen(false)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} className="w-auto p-0">
        <div className="flex flex-wrap gap-1 border-b p-2">
          {QUICK.map((q) => (
            <button key={q.label} type="button" onClick={() => pick(q.day())} className="rounded-md border px-2 py-1 text-sm hover:bg-accent">
              {q.label}
            </button>
          ))}
        </div>
        <Calendar
          mode="single"
          selected={value ? fromDay(value) : undefined}
          defaultMonth={value ? fromDay(value) : undefined}
          onSelect={(d) => d && pick(toDay(d))}
          weekStartsOn={1}
        />
        {value && (
          <div className="border-t p-2">
            <button type="button" onClick={() => pick(null)} className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
              <X className="size-4" /> No due date
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

const TONE = { overdue: 'text-red-400 border-red-400/30', soon: 'text-amber-300 border-amber-300/30', later: 'text-muted-foreground' }

/** the due date on a row or card; a finished issue is never late */
export function DueChip({ day, closed, className }: { day: string; closed?: boolean; className?: string }) {
  const tone = closed ? 'later' : dueTone(day)
  return (
    <span
      className={cn('inline-flex h-6 shrink-0 items-center gap-1 rounded-md border px-1.5 text-xs tabular-nums', TONE[tone], className)}
      title={`Due ${shortDate(day)}${tone === 'overdue' ? ' (overdue)' : ''}`}
    >
      <CalendarClock className="size-3.5" />
      {dayName(day)}
    </span>
  )
}

export const EstimateIcon = ({ className }: { className?: string }) => <Triangle className={cn('size-3.5 shrink-0 text-muted-foreground', className)} />

export const estimateName = (points: number) => `${points} ${points === 1 ? 'point' : 'points'}`

/** the estimate choices; an imported estimate outside the usual ones is offered too, so it shows as picked */
export function estimateItems(current?: number | null): PickerItem<number | null>[] {
  const values = [...new Set([...ESTIMATES, ...(current != null ? [current] : [])])].sort((a, b) => a - b)
  return [
    { value: null, label: 'No estimate', icon: <EstimateIcon className="opacity-50" /> },
    ...values.map((p) => ({ value: p as number | null, label: estimateName(p), keywords: [String(p)], icon: <EstimateIcon /> })),
  ]
}

export function EstimateChip({ points, className }: { points: number; className?: string }) {
  return (
    <span className={cn('inline-flex h-6 shrink-0 items-center gap-1 rounded-md border px-1.5 text-xs text-muted-foreground tabular-nums', className)} title={estimateName(points)}>
      <EstimateIcon className="size-3" />
      {points}
    </span>
  )
}
