/** The little number on the dragged issue when several picked issues move together. */
import { useSelection } from './selection'

export function CarryCount() {
  const n = useSelection((s) => (s.draggingMany ? s.ids.length : 0))
  if (!n) return null
  return <span className="absolute -top-2 -right-2 rounded-full bg-primary px-2 text-xs leading-5 font-semibold text-primary-foreground tabular-nums">{n}</span>
}
