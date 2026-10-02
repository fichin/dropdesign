// How a signed-in account appears as a person (comment author). Shared so the backend
// creates exactly what the frontend shows while a new comment is still being sent.

/** "ana.petrova+work@example.com" → "Ana Petrova" */
export function nameFromEmail(email: string): string {
  const local = email.split('@')[0].split('+')[0]
  const words = local.split(/[._-]+/).filter(Boolean)
  const name = words.map((word) => word[0].toUpperCase() + word.slice(1)).join(' ')
  return (name || email).slice(0, 100)
}

/**
 * An avatar made locally: initials on the app's indigo, as an inline SVG data URL.
 * Deliberately not a third-party avatar service, which would receive the user's email.
 */
export function initialsAvatar(name: string): string {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0] ?? '')
    .join('')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" fill="#e0e7ff"/>` +
    `<text x="32" y="32" dy=".35em" text-anchor="middle" fill="#4338ca" ` +
    `font-family="system-ui,sans-serif" font-size="26" font-weight="600">${initials || '?'}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
