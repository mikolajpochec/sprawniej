/** Open state of the ⌘K palette and of the quick property menus (S, P, A, L on an issue). */
import { create } from 'zustand'
import { findByRef, useData } from '@/data/store'

export type QuickField = 'status' | 'priority' | 'assignee' | 'labels' | 'estimate'

interface Palette {
  open: boolean
  /** a quick menu for one property of one or more issues */
  quick: { issues: string[]; field: QuickField } | null
}

export const usePalette = create<Palette>()(() => ({ open: false, quick: null }))

export const openPalette = () => usePalette.setState({ open: true })

/**
 * The issue a shortcut is about: the one under the mouse, else the one with keyboard focus, else the issue whose
 * page is open.
 */
export function targetIssue(): string | undefined {
  const hovered = [...document.querySelectorAll('[data-issue-id]:hover')].pop()
  const focused = (document.activeElement as HTMLElement | null)?.closest('[data-issue-id]')
  const id = (hovered ?? focused)?.getAttribute('data-issue-id')
  if (id) return id
  const ref = /^#\/issue\/([^/?]+)/.exec(location.hash)?.[1]
  return ref ? findByRef(useData.getState().issues, decodeURIComponent(ref))?.id : undefined
}
