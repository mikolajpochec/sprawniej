/** What an empty list shows: what belongs here, in plain words, and one button to start. */
import type { ReactNode } from 'react'

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-6 py-20 text-center">
      {icon && <div className="text-muted-foreground [&_svg]:size-8">{icon}</div>}
      <h2 className="text-base font-semibold">{title}</h2>
      {children && <p className="text-sm text-muted-foreground">{children}</p>}
      {action}
    </div>
  )
}
