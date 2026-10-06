/**
 * Drag-n-drop for the list and the board (dnd-kit). While you drag, the issue moves between groups on screen
 * (local state only). On drop it gets one change: a new place among its neighbours, plus the status, priority,
 * assignee or project of the group it landed in. Space picks an issue up from the keyboard, arrows move it,
 * Space drops it and Esc puts it back.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  closestCenter,
  getFirstCollision,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { toast } from 'sonner'
import { moveIssue } from '@/data/actions'
import { changedOnly, groupPatch, neighbours } from '@/data/ordering'
import { nestChildren, type Group } from '@/data/select'
import type { Display, Issue } from '@/model/schema'

const GROUP = 'group:'
export const groupDropId = (key: string) => `${GROUP}${key}`
const isGroupId = (id: UniqueIdentifier) => String(id).startsWith(GROUP)

/** scroll only when the pointer is close to the edge (dnd-kit's default, 20%, scrolls a wide board too eagerly) */
export const AUTO_SCROLL = { threshold: { x: 0.08, y: 0.12 } }

const ORDER_NAMES: Record<Display['ordering'], string> = { manual: 'manual', priority: 'priority', updated: 'last update', created: 'creation date' }

/** the order each group shows its issues in: sub-issues right under their parent in a list */
function baseOrder(groups: Group[], nest: boolean): Record<string, string[]> {
  return Object.fromEntries(groups.map((g) => [g.key, nest ? nestChildren(g.issues).map((r) => r.issue.id) : g.issues.map((i) => i.id)]))
}

/**
 * `nest`: sub-issues sit under their parent (list). `park`: empty groups are shown apart (the board's hidden
 * columns); dropping on one moves the issue there, but nothing moves on screen while you hover it.
 */
export function useIssueDrag(groups: Group[], display: Display, { nest = false, park = false } = {}) {
  const base = useMemo(() => baseOrder(groups, nest), [groups, nest])
  const parked = useMemo(() => new Set(park ? groups.filter((g) => g.issues.length === 0).map((g) => g.key) : []), [groups, park])
  const issues = useMemo(() => new Map(groups.flatMap((g) => g.issues.map((i) => [i.id, i] as const))), [groups])
  /** only while dragging: the order on screen */
  const [live, setLive] = useState<Record<string, string[]> | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const order = live ?? base
  const orderRef = useRef(order)
  useEffect(() => {
    orderRef.current = order
  })
  const startGroup = useRef<string | null>(null)
  const lastOver = useRef<UniqueIdentifier | null>(null)
  const movedGroup = useRef(false)
  const dropped = useRef(false)

  useEffect(() => {
    requestAnimationFrame(() => (movedGroup.current = false))
  }, [live])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Enter still opens the issue; Space picks it up and drops it
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  )

  const groupOf = useCallback((id: UniqueIdentifier): string | undefined => {
    if (isGroupId(id)) return String(id).slice(GROUP.length)
    return Object.keys(orderRef.current).find((k) => orderRef.current[k].includes(String(id)))
  }, [])

  /** the pointer's group, then the closest issue in it (dnd-kit's multiple-containers recipe) */
  const collisionDetection: CollisionDetection = useCallback(
    (args) => {
      const within = pointerWithin(args)
      const hits = within.length ? within : rectIntersection(args)
      let overId = getFirstCollision(hits, 'id')
      if (overId != null) {
        if (isGroupId(overId)) {
          const ids = orderRef.current[String(overId).slice(GROUP.length)] ?? []
          if (ids.length) {
            const closest = closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => ids.includes(String(c.id))) })
            overId = closest[0]?.id ?? overId
          }
        }
        lastOver.current = overId
        return [{ id: overId }]
      }
      // just moved to another group: its layout is still settling, stay where we are
      if (movedGroup.current) lastOver.current = args.active.id
      return lastOver.current ? [{ id: lastOver.current }] : []
    },
    [],
  )

  const reset = () => {
    setLive(null)
    setActiveId(null)
    startGroup.current = null
  }

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id))
    startGroup.current = groupOf(active.id) ?? null
    setLive(base)
  }

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return
    const from = groupOf(active.id)
    const to = groupOf(over.id)
    if (!from || !to || from === to || parked.has(to)) return
    setLive((o) => {
      const cur = o ?? base
      const target = cur[to].filter((x) => x !== active.id)
      let at = target.length
      if (!isGroupId(over.id)) {
        const translated = active.rect.current.translated
        const below = translated && translated.top > over.rect.top + over.rect.height / 2
        at = Math.max(0, target.indexOf(String(over.id))) + (below ? 1 : 0)
      }
      movedGroup.current = true
      return { ...cur, [from]: cur[from].filter((x) => x !== active.id), [to]: [...target.slice(0, at), String(active.id), ...target.slice(at)] }
    })
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const id = String(active.id)
    const from = startGroup.current
    // a hidden column takes the drop as it is; otherwise the issue is wherever the live order put it
    const onParked = over && isGroupId(over.id) && parked.has(String(over.id).slice(GROUP.length))
    const to = onParked ? String(over.id).slice(GROUP.length) : groupOf(active.id)
    dropped.current = true
    setTimeout(() => (dropped.current = false))
    const issue = issues.get(id)
    if (!over || !from || !to || !issue) return reset()

    let ids = onParked ? [id] : orderRef.current[to]
    if (!onParked && !isGroupId(over.id) && over.id !== active.id && ids.includes(String(over.id))) ids = arrayMove(ids, ids.indexOf(id), ids.indexOf(String(over.id)))
    const group = groups.find((g) => g.key === to)
    const patch = from !== to && group ? changedOnly(issue, groupPatch(display.grouping, group.value)) : {}
    const manual = display.ordering === 'manual'
    const movedWithin = from === to && ids.indexOf(id) !== base[from].indexOf(id)

    if (!manual && movedWithin && !Object.keys(patch).length) {
      toast(`This list is sorted by ${ORDER_NAMES[display.ordering]}`, { description: 'To arrange issues by hand, choose Manual order under Display.' })
    }
    if (Object.keys(patch).length || (manual && (movedWithin || from !== to))) {
      // in a list, a sub-issue stays among its siblings and a top-level issue among top-level ones
      const parentHere = (x: string) => {
        const p = issues.get(x)?.parent
        return nest && p && ids.includes(p) ? p : null
      }
      const near = manual ? neighbours(ids, id, parentHere) : null
      moveIssue(id, { patch, place: near })
    }
    reset()
  }

  return {
    order,
    /** empty groups shown apart (board) */
    parked,
    activeId,
    issue: (id: string): Issue | undefined => issues.get(id),
    /** true right after a drop, so the click that ends a drag doesn't open the issue */
    justDropped: () => dropped.current,
    dnd: { sensors, collisionDetection, onDragStart, onDragOver, onDragEnd, onDragCancel: reset },
  }
}
