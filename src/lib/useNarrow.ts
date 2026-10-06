/** Screen-size checks: `useNarrow` is true on phone-sized screens (under 768 px), where the sidebar becomes a menu. */
import { useSyncExternalStore } from 'react'

export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', onChange)
      return () => m.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
  )
}

export const useNarrow = () => useMedia('(max-width: 767px)')
