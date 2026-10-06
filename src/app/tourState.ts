/** The first-visit tour's state: which tip is showing. Once finished or skipped it stays away (Help can replay it). */
import { create } from 'zustand'

const DONE = 'sprawniej:tour-done'

export const useTour = create<{ step: number | null }>()(() => ({ step: null }))

export const tourDone = () => localStorage.getItem(DONE) === '1'

export function endTour() {
  localStorage.setItem(DONE, '1')
  useTour.setState({ step: null })
}

export function replayTour() {
  localStorage.removeItem(DONE)
  useTour.setState({ step: 0 })
}
