import { useEffect, useRef, type ReactNode } from 'react'
import './StatePage.css'

interface StatePageProps {
  /** Small label above the heading, e.g. "404" */
  eyebrow?: string
  title: string
  children: ReactNode
  /** Buttons/links under the text */
  actions: ReactNode
  /** role="alert" for errors, so screen readers announce them at once */
  alert?: boolean
}

/**
 * A full-page message (page not found, something went wrong). The heading takes focus on
 * mount so screen readers announce the new page, as they would after a real navigation.
 */
function StatePage({ eyebrow, title, children, actions, alert = false }: StatePageProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => headingRef.current?.focus(), [])

  return (
    <main className="state-page">
      <div className="state-panel" role={alert ? 'alert' : undefined}>
        <span className="state-logo" aria-hidden="true" />
        {eyebrow && <p className="state-eyebrow">{eyebrow}</p>}
        <h1 ref={headingRef} className="state-title" tabIndex={-1}>
          {title}
        </h1>
        <div className="state-text">{children}</div>
        <div className="state-actions">{actions}</div>
      </div>
    </main>
  )
}

export default StatePage
