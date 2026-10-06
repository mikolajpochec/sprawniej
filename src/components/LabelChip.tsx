import type { Label } from '@/model/schema'

/** A label as a small pill with a coloured dot. */
export function LabelChip({ label }: { label: Label }) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-xs text-muted-foreground">
      <span className="size-2 rounded-full" style={{ background: label.color }} />
      {label.name}
    </span>
  )
}
