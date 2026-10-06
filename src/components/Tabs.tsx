/** Page tabs that are links (Active / Backlog / All issues), styled as outlined buttons. */
import { Link } from 'wouter'
import { cn } from '@/lib/utils'

export function LinkTabs({ tabs, current }: { tabs: { href: string; label: string }[]; current: string }) {
  return (
    <nav className="flex gap-2">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            'flex h-10 items-center rounded-lg border px-4 text-[15px] text-muted-foreground hover:bg-accent/60 hover:text-foreground',
            t.href === current && 'border-foreground/80 bg-accent text-foreground',
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
