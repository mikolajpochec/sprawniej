/**
 * How each page shows its issues (list or board, grouping, ordering…), remembered in this browser only.
 * Saved views carry their own display in the repo; this is for built-in pages and personal overrides.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Display } from '@/model/schema'

export const DEFAULT_DISPLAY: Display = { layout: 'list', grouping: 'status', ordering: 'manual', showCompleted: true, showSubIssues: true }

interface Displays {
  byPage: Record<string, Partial<Display>>
  set: (page: string, patch: Partial<Display>) => void
}

export const useDisplays = create<Displays>()(
  persist(
    (set) => ({
      byPage: {},
      set: (page, patch) => set((s) => ({ byPage: { ...s.byPage, [page]: { ...s.byPage[page], ...patch } } })),
    }),
    { name: 'sprawniej-displays' },
  ),
)

/** the display for a page: built-in default, then the page's own default, then what you picked here */
export function useDisplay(page: string, base?: Partial<Display>): [Display, (patch: Partial<Display>) => void] {
  const mine = useDisplays((s) => s.byPage[page])
  const set = useDisplays((s) => s.set)
  return [{ ...DEFAULT_DISPLAY, ...base, ...mine }, (patch) => set(page, patch)]
}
