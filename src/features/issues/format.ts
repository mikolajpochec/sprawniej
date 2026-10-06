const MONTH = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })
const MONTH_YEAR = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' })

/** "Oct 2", or "Oct 2, 2025" when it's not this year */
export function shortDate(iso: string, now = new Date()): string {
  // a plain date (a project's target) is a day here, not midnight in London
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00` : iso)
  return d.getFullYear() === now.getFullYear() ? MONTH.format(d) : MONTH_YEAR.format(d)
}
