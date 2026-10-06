import { useEffect, type MouseEvent } from 'react'
import StatePage from './StatePage'

interface NotFoundPageProps {
  path: string
  signedIn: boolean
  onNavigate: (to: string) => void
}

/** Any path other than /, /login and /register */
function NotFoundPage({ path, signedIn, onNavigate }: NotFoundPageProps) {
  useEffect(() => {
    const previous = document.title
    document.title = 'Page not found · DropDesign'
    return () => {
      document.title = previous
    }
  }, [])

  const target = signedIn ? { to: '/', label: 'Go to the board' } : { to: '/login', label: 'Go to the login page' }
  // A real link (open in a new tab, copy the address) that navigates in-app on a plain click
  function go(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    event.preventDefault()
    onNavigate(target.to)
  }

  return (
    <StatePage
      eyebrow="404"
      title="Page not found"
      actions={
        <a href={target.to} className="button-primary" onClick={go}>
          {target.label}
        </a>
      }
    >
      <p>
        There's nothing at <code>{path}</code>. It may have moved, or the link may be mistyped.
      </p>
    </StatePage>
  )
}

export default NotFoundPage
