/** Keyboard shortcuts that work anywhere in the app (not while typing in a field). */
import { useEffect } from 'react'
import { openComposer } from '@/features/issues/composer'

/** typing in a field, or a dialog/menu is open: leave the key alone */
export function isBusy(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  if (t?.closest('input, textarea, select, [contenteditable="true"]')) return true
  return !!document.querySelector('[role=dialog], [role=menu], [data-slot=popover-content]')
}

export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isBusy(e)) return
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        openComposer()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
