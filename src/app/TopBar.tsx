/** The bar above every page: sidebar toggle, where you are, whether your changes are saved, and search. */
import { Fragment } from 'react'
import { Link } from 'wouter'
import { PanelLeft, Search } from 'lucide-react'
import { useChrome } from './chrome'
import { openPalette } from './palette'
import { SaveStatus } from './SaveStatus'

export function TopBar() {
  const crumbs = useChrome((s) => s.crumbs)
  const toggle = useChrome((s) => s.toggleSidebar)
  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b px-6">
      <button type="button" onClick={toggle} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Show or hide the sidebar">
        <PanelLeft className="size-5" />
      </button>
      <div className="h-5 w-px bg-border" />
      <nav className="flex min-w-0 items-center gap-2 text-[15px]" aria-label="Breadcrumbs">
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          Sprawniej
        </Link>
        {crumbs.map((c, i) => (
          <Fragment key={i}>
            <span className="text-muted-foreground">/</span>
            {c.href && i < crumbs.length - 1 ? (
              <Link href={c.href} className="truncate text-muted-foreground hover:text-foreground">
                {c.label}
              </Link>
            ) : (
              <span className="truncate">{c.label}</span>
            )}
          </Fragment>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-3">
        <SaveStatus />
        <button
          type="button"
          onClick={openPalette}
          className="flex h-10 w-80 items-center gap-2 rounded-lg border bg-input/20 px-3 text-[15px] text-muted-foreground hover:bg-input/40"
          aria-label="Search"
        >
          <Search className="size-4" />
          Search or jump to…
          <kbd className="ml-auto rounded-md border px-1.5 py-0.5 font-sans text-xs">⌘K</kbd>
        </button>
      </div>
    </header>
  )
}
