// Due dates are calendar dates ("YYYY-MM-DD"), not moments in time. These helpers never
// go through `new Date("2026-10-15")`, which means midnight UTC and can show the
// previous day in timezones west of UTC.

/** Today in the user's own timezone, as "YYYY-MM-DD" */
export function todayLocal(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** "YYYY-MM-DD" → a local-midnight Date, for formatting only */
function toLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const sameYear = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })
const otherYear = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' })
const full = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

/** "Oct 15", or "Oct 15, 2027" when it isn't this year */
export function formatDueDate(isoDate: string, now = new Date()): string {
  const date = toLocalDate(isoDate)
  return (date.getFullYear() === now.getFullYear() ? sameYear : otherYear).format(date)
}

/** "Thursday, October 15, 2026", for tooltips and screen readers */
export function formatDueDateLong(isoDate: string): string {
  return full.format(toLocalDate(isoDate))
}

/** Strictly before today: due today isn't overdue yet. ("YYYY-MM-DD" strings sort as dates) */
export function isOverdue(isoDate: string, now = new Date()): boolean {
  return isoDate < todayLocal(now)
}
