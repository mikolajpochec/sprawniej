/**
 * The first-visit tour: four small tips next to the real things they're about. It starts the first time you open
 * a team's issues, can be skipped, and never comes back unless you ask for it on the Help page.
 */
import { useEffect, useState } from 'react'
import { useLocation } from 'wouter'
import { Button } from '@/ui/button'
import { endTour, tourDone, useTour } from './tourState'

const STEPS = [
  { anchor: 'new-issue', title: 'Write down a task', text: 'Press C anywhere, or this button, to make a new issue. Only a title is needed.' },
  { anchor: 'issues', title: 'Drag to move things along', text: 'Drag an issue to another group to change its status, or up and down to put it in order. On a phone, press and hold first.' },
  { anchor: 'layout', title: 'List or board', text: 'See the same issues as a list, or as columns on a board.' },
  { anchor: 'saved', title: 'There is no Save button', text: 'Everything you change saves by itself and shows up for your team. This little sign tells you when it’s done.' },
]

const CARD = 320

function useRect(anchor: string | undefined): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null)
  useEffect(() => {
    if (!anchor) return
    let frame = 0
    const tick = () => {
      const el = [...document.querySelectorAll(`[data-tour="${anchor}"]`)].find((e) => e.getClientRects().length > 0)
      const r = el?.getBoundingClientRect() ?? null
      setRect((old) => (old && r && old.x === r.x && old.y === r.y && old.width === r.width && old.height === r.height ? old : r))
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [anchor])
  return rect
}

export function Tour() {
  const step = useTour((s) => s.step)
  const [location] = useLocation()
  const tip = step === null ? undefined : STEPS[step]
  const rect = useRect(tip?.anchor)

  // the first time someone opens a team's issues
  useEffect(() => {
    if (tourDone() || useTour.getState().step !== null || !/^\/team\/[^/]+\/issues/.test(location)) return
    const t = setTimeout(() => !tourDone() && useTour.setState({ step: 0 }), 800)
    return () => clearTimeout(t)
  }, [location])

  useEffect(() => {
    if (step === null) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && endTour()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step])

  if (step === null || !tip) return null
  const last = step === STEPS.length - 1
  // next to the thing: below it when there's room, else above; a big area gets the tip inside its top
  let style: React.CSSProperties = { left: '50%', top: '30%', transform: 'translateX(-50%)' }
  if (rect) {
    const big = rect.height > 200
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - CARD / 2), window.innerWidth - CARD - 12)
    const below = rect.bottom + 180 < window.innerHeight
    style = big ? { left, top: rect.top + 60 } : below ? { left, top: rect.bottom + 12 } : { left, bottom: window.innerHeight - rect.top + 12 }
  }
  return (
    <>
      {rect && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-50 rounded-lg ring-2 ring-foreground/70 transition-all"
          style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }}
        />
      )}
      <section aria-label="Tour" aria-live="polite" className="fixed z-50 rounded-xl border bg-popover p-4 shadow-2xl" style={{ ...style, width: CARD, maxWidth: 'calc(100vw - 24px)' }}>
        <p className="text-xs text-muted-foreground tabular-nums">
          {step + 1} of {STEPS.length}
        </p>
        <h2 className="mt-1 font-semibold">{tip.title}</h2>
        <p className="mt-1 text-sm text-foreground/85">{tip.text}</p>
        <div className="mt-4 flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={endTour}>
            Skip
          </Button>
          {step > 0 && (
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => useTour.setState({ step: step - 1 })}>
              Back
            </Button>
          )}
          <Button size="sm" className={step === 0 ? 'ml-auto' : ''} onClick={() => (last ? endTour() : useTour.setState({ step: step + 1 }))}>
            {last ? 'Got it' : 'Next'}
          </Button>
        </div>
      </section>
    </>
  )
}
