/** The frame: sidebar on the left, top bar and the page on the right. */
import type { ReactNode } from 'react'
import { NewIssueDialog } from '@/features/issues/NewIssueDialog'
import { useChrome } from './chrome'
import { useShortcuts } from './shortcuts'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function Shell({ children }: { children: ReactNode }) {
  const open = useChrome((s) => s.sidebarOpen)
  useShortcuts()
  return (
    <div className="flex h-full">
      {open && <Sidebar />}
      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </main>
      <NewIssueDialog />
    </div>
  )
}
