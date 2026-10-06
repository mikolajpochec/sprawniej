const MONTH = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })
const MONTH_YEAR = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' })

/** "Oct 2", or "Oct 2, 2025" when it's not this year */
export function shortDate(iso: string, now = new Date()): string {
  // a plain date (a project's target) is a day here, not midnight in London
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00` : iso)
  return d.getFullYear() === now.getFullYear() ? MONTH.format(d) : MONTH_YEAR.format(d)
}

/** a Date as a plain day in this browser's time zone */
export function toDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const fromDay = (day: string) => new Date(`${day}T00:00`)
export const addDays = (n: number, from = new Date()) => toDay(new Date(from.getFullYear(), from.getMonth(), from.getDate() + n))

/** "Today", "Tomorrow", "Yesterday", else "Oct 31" */
export function dayName(day: string, today = toDay(new Date())): string {
  const now = fromDay(today)
  if (day === today) return 'Today'
  if (day === addDays(1, now)) return 'Tomorrow'
  if (day === addDays(-1, now)) return 'Yesterday'
  return shortDate(day, now)
}

/** overdue (red), due within two days (amber), or later */
export function dueTone(day: string, today = toDay(new Date())): 'overdue' | 'soon' | 'later' {
  if (day < today) return 'overdue'
  return day <= addDays(2, fromDay(today)) ? 'soon' : 'later'
}

export function estimateName(points: number): string {
  return `${points} ${points === 1 ? 'point' : 'points'}`
}
