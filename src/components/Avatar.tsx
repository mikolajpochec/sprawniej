/**
 * A person's picture: the one they picked in Sprawniej, else their GitHub one, else their initials on a stable colour
 * (no picture, or we're offline).
 */
import { useState } from 'react'
import type { Person } from '@/model/schema'
import { assetUrl } from '@/data/assets'
import { cn } from '@/lib/utils'
import { initials, personColor } from '@/lib/person'

export function PersonAvatar({ person, login, className }: { person?: Person; login?: string | null; className?: string }) {
  const [broken, setBroken] = useState<string[]>([])
  const box = cn('inline-flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full text-[9px] font-semibold text-white', className)
  const key = person?.login ?? login
  if (!key) {
    return (
      <span className={cn(box, 'border border-dashed border-muted-foreground/60')} aria-label="No assignee" />
    )
  }
  // their own picture may not be on this device yet: the GitHub one meanwhile
  const src = [assetUrl(person?.avatar), person?.avatarUrl].find((u) => u && !broken.includes(u))
  if (src) {
    return <img src={src} alt={person!.name} className={cn(box, 'object-cover')} onError={() => setBroken((b) => [...b, src])} />
  }
  return (
    <span className={box} style={{ background: personColor(key) }} aria-label={person?.name ?? key}>
      {initials(person?.name || key)}
    </span>
  )
}
