/** A row of joined buttons where one is chosen, like Punchcard's Day / Week / Month switch. */
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  /** the accessible name, when the label can be just an icon (phones) */
  name?: string
}

export function Segmented<T extends string>({ value, options, onChange, label, tour }: { value: T; options: SegmentedOption<T>[]; onChange: (v: T) => void; label: string; tour?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex h-10 rounded-lg border" data-tour={tour}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          aria-label={o.name}
          onClick={() => onChange(o.value)}
          className={cn(
            '-m-px flex items-center gap-2 rounded-lg border border-transparent px-3 text-[15px] sm:px-4 text-foreground/90 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [&_svg]:size-4',
            o.value === value && 'border-foreground/80 bg-accent',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
