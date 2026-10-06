/** Keyboard shortcuts that work anywhere in the app (not while typing in a field). The Help page lists them. */
import { useEffect } from 'react'
import { useLocation } from 'wouter'
import { openComposer } from '@/features/issues/composer'
import { openPalette, targetIssue, usePalette, type QuickField } from './palette'

/** typing in a field, or a dialog/menu is open: leave the key alone */
export function isBusy(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  if (t?.closest('input, textarea, select, [contenteditable="true"]')) return true
  return !!document.querySelector('[role=dialog], [role=menu], [role=listbox], [data-slot=popover-content]')
}

const QUICK: Record<string, QuickField> = { s: 'status', p: 'priority', a: 'assignee', l: 'labels' }

/** move keyboard focus to the next or previous issue in the list or board */
function step(by: 1 | -1) {
  const all = [...document.querySelectorAll<HTMLElement>('main [data-issue-id]')]
  if (!all.length) return
  const at = all.findIndex((el) => el === document.activeElement || el.contains(document.activeElement))
  const next = all[at === -1 ? (by === 1 ? 0 : all.length - 1) : Math.min(all.length - 1, Math.max(0, at + by))]
  next.focus()
  next.scrollIntoView({ block: 'nearest' })
}

export function useShortcuts() {
  const [location, navigate] = useLocation()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⌘K works everywhere, even while typing
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (!usePalette.getState().open) usePalette.setState({ quick: null })
        usePalette.setState((s) => ({ open: !s.open }))
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isBusy(e)) return
      const key = e.key.toLowerCase()
      // during a keyboard drag the arrows move the issue
      const dragging = !!document.querySelector('[aria-pressed="true"][data-issue-id]')
      if (key === 'c') {
        e.preventDefault()
        openComposer()
      } else if (QUICK[key]) {
        const issue = targetIssue()
        if (!issue) return
        e.preventDefault()
        usePalette.setState({ quick: { issue, field: QUICK[key] } })
      } else if (key === 'j' || (key === 'arrowdown' && !dragging)) {
        e.preventDefault()
        step(1)
      } else if (key === 'k' || (key === 'arrowup' && !dragging)) {
        e.preventDefault()
        step(-1)
      } else if (key === 'escape' && location.startsWith('/issue/')) {
        e.preventDefault()
        if (history.length > 1) history.back()
        else navigate('/')
      } else if (key === '/') {
        e.preventDefault()
        openPalette()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [location, navigate])
}
