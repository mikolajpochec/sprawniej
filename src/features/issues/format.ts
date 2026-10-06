const MONTH = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })
const MONTH_YEAR = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' })

/** "Oct 2", or "Oct 2, 2025" when it's not this year */
export function shortDate(iso: string, now = new Date()): string {
  const d = new Date(iso)
  return d.getFullYear() === now.getFullYear() ? MONTH.format(d) : MONTH_YEAR.format(d)
}
