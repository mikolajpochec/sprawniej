/** The frame: sidebar on the left, top bar and the page on the right. */
import { useEffect, type ReactNode } from 'react'
import { preloadEditor } from '@/editor/load'
import { NewIssueDialog } from '@/features/issues/NewIssueDialog'
import { QuickEdit } from '@/features/issues/QuickEdit'
import { CommandPalette } from './CommandPalette'
import { useChrome } from './chrome'
import { useShortcuts } from './shortcuts'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function Shell({ children }: { children: ReactNode }) {
  const open = useChrome((s) => s.sidebarOpen)
  useShortcuts()
  // fetch the editor while you look around, so the first issue you open is ready at once
  useEffect(() => {
    const t = setTimeout(preloadEditor, 1500)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="flex h-full">
      {open && <Sidebar />}
      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </main>
      <NewIssueDialog />
      <CommandPalette />
      <QuickEdit />
    </div>
  )
}
