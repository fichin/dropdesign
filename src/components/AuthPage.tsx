import { useState, type FormEvent, type MouseEvent } from 'react'
import { ApiError } from '../api/client'
import ThemeToggle from './ThemeToggle'
import './AuthPage.css'

type Mode = 'login' | 'register'
type Field = 'email' | 'password' | 'confirmPassword'
interface Values {
  email: string
  password: string
  /** Register only; checked here and never sent to the server */
  confirmPassword: string
}

interface AuthPageProps {
  mode: Mode
  /** Shown above the form, e.g. "Your session has ended" */
  notice?: string
  onSubmit: (email: string, password: string) => Promise<void>
  onSwitchMode: (mode: Mode) => void
}

const PRODUCT_NAME = 'DropDesign'

// "Log in" rather than "Sign in", to match the "Log out" button and the session-ended message
const COPY = {
  login: {
    title: 'Welcome back',
    subtitle: 'Log in to pick up where your team left off.',
    submit: 'Log in',
    submitting: 'Logging in…',
    switchText: "Don't have an account?",
    switchLink: 'Create one',
  },
  register: {
    title: 'Create your account',
    subtitle: 'Plan, track and finish work together, all on one board.',
    submit: 'Create account',
    submitting: 'Creating account…',
    switchText: 'Already have an account?',
    switchLink: 'Log in',
  },
} as const

/** Same rules as the API (plus the register-only confirmation), checked before any request */
function validate(mode: Mode, { email, password, confirmPassword }: Values): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {}
  if (!email.trim()) errors.email = 'Enter your email address'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Enter a valid email address'

  if (!password) errors.password = 'Enter your password'
  else if (mode === 'register' && password.length < 8) errors.password = 'Use at least 8 characters'
  else if (mode === 'register' && new TextEncoder().encode(password).length > 72) errors.password = 'Use at most 72 bytes'

  if (mode === 'register' && password) {
    if (!confirmPassword) errors.confirmPassword = 'Confirm your password'
    else if (confirmPassword !== password) errors.confirmPassword = "Passwords don't match"
  }
  return errors
}

function ErrorIcon() {
  return (
    <svg className="auth-error-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M10 1.75a8.25 8.25 0 1 0 0 16.5 8.25 8.25 0 0 0 0-16.5ZM10 5.5a.9.9 0 0 1 .9.9v4.2a.9.9 0 1 1-1.8 0V6.4a.9.9 0 0 1 .9-.9Zm0 9.1a1.05 1.05 0 1 1 0-2.1 1.05 1.05 0 0 1 0 2.1Z"
      />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg className="auth-error-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M10 1.75a8.25 8.25 0 1 0 0 16.5 8.25 8.25 0 0 0 0-16.5Zm0 3.65a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1Zm.9 9.2a.9.9 0 1 1-1.8 0V9.4a.9.9 0 1 1 1.8 0v5.2Z"
      />
    </svg>
  )
}

/** The planet mark used in the app header, at logo size */
function LogoMark({ className }: { className?: string }) {
  return <span className={`auth-logo-mark ${className ?? ''}`} aria-hidden="true" />
}

/**
 * Abstract board motif for the brand panel: three columns of cards, one card
 * lifted as if mid-drag. Decorative only, so it's hidden from screen readers.
 */
function BoardMotif() {
  return (
    <svg className="auth-motif" viewBox="0 0 360 280" aria-hidden="true" focusable="false">
      {/* Columns */}
      {[0, 124, 248].map((x) => (
        <rect key={x} x={x} y="0" width="112" height="280" rx="16" className="motif-column" />
      ))}
      {/* Column headers: status dot + title bar */}
      {[
        { x: 0, dot: 'motif-dot-todo' },
        { x: 124, dot: 'motif-dot-progress' },
        { x: 248, dot: 'motif-dot-done' },
      ].map(({ x, dot }) => (
        <g key={x}>
          <circle cx={x + 18} cy="22" r="4" className={dot} />
          <rect x={x + 30} y="18" width="44" height="8" rx="4" className="motif-line" />
        </g>
      ))}
      {/* Cards: x, y, height, progress fraction */}
      {[
        [8, 40, 70, 0.15],
        [8, 118, 56, 0],
        [8, 182, 70, 0.1],
        [132, 40, 70, 0.55],
        [256, 40, 56, 1],
        [256, 104, 70, 1],
        [256, 182, 56, 1],
      ].map(([x, y, h, progress]) => (
        <g key={`${x}-${y}`}>
          <rect x={x} y={y} width="96" height={h} rx="10" className="motif-card" />
          <rect x={x + 10} y={y + 12} width="34" height="7" rx="3.5" className="motif-pill" />
          <rect x={x + 10} y={y + 26} width="62" height="6" rx="3" className="motif-line-dark" />
          <rect x={x + 10} y={y + h - 16} width="76" height="4" rx="2" className="motif-track" />
          {progress > 0 && (
            <rect x={x + 10} y={y + h - 16} width={76 * progress} height="4" rx="2" className="motif-progress" />
          )}
        </g>
      ))}
      {/* The dashed gap the dragged card will drop into, then the card itself, tilted and lifted */}
      <rect x="132" y="122" width="96" height="62" rx="10" className="motif-slot" />
      <g className="motif-dragged">
        <rect x="140" y="132" width="96" height="70" rx="10" className="motif-card motif-card-lifted" />
        <rect x="150" y="144" width="34" height="7" rx="3.5" className="motif-pill-accent" />
        <rect x="150" y="158" width="62" height="6" rx="3" className="motif-line-dark" />
        <rect x="150" y="186" width="76" height="4" rx="2" className="motif-track" />
        <rect x="150" y="186" width="30" height="4" rx="2" className="motif-progress" />
      </g>
    </svg>
  )
}

function AuthPage({ mode, notice, onSubmit, onSwitchMode }: AuthPageProps) {
  const copy = COPY[mode]
  const [values, setValues] = useState<Values>({ email: '', password: '', confirmPassword: '' })
  const { email, password, confirmPassword } = values
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Field, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Errors appear after the first submit, then update as you type
  const [attempted, setAttempted] = useState(false)

  function update(field: Field, value: string) {
    const next = { ...values, [field]: value }
    setValues(next)
    // Re-checks every field, so fixing either password clears a mismatch
    if (attempted) setFieldErrors(validate(mode, next))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setAttempted(true)
    setFormError(null)
    const errors = validate(mode, values)
    setFieldErrors(errors)
    if (Object.keys(errors).length) return

    setSubmitting(true)
    try {
      await onSubmit(email.trim(), password)
      // On success the app navigates to the board, which unmounts this page
    } catch (error) {
      if (!(error instanceof ApiError)) setFormError('Something went wrong. Please try again.')
      else if (error.unreachable) setFormError("Can't reach the server. Check your connection and try again.")
      else if (error.status === 409) setFieldErrors({ email: 'An account with this email already exists' })
      else if (error.status === 400 && error.issues.length) {
        const fromServer: Partial<Record<Field, string>> = {}
        for (const issue of error.issues) {
          const field = issue.path[0]
          if ((field === 'email' || field === 'password') && !fromServer[field]) fromServer[field] = issue.message
        }
        setFieldErrors(fromServer)
      } else setFormError(error.message)
      setSubmitting(false)
    }
  }

  function switchMode(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    onSwitchMode(mode === 'login' ? 'register' : 'login')
  }

  const errorId = (field: Field) => `${field}-error`

  return (
    <div className="auth-page">
      {/* Brand panel: decorative graphic plus the product name and tagline. Nothing focusable,
          so keyboard focus goes straight to the form. Hidden on narrow screens. */}
      <aside className="auth-brand">
        <div className="auth-brand-name">
          <LogoMark className="auth-logo-mark-light" />
          <span>{PRODUCT_NAME}</span>
        </div>
        <BoardMotif />
        <p className="auth-tagline">Every task, every stage, one board.</p>
      </aside>

      <main className="auth-main">
        <div className="auth-panel">
          {/* On narrow screens the brand panel is hidden; this keeps the product identity */}
          <div className="auth-compact-brand" aria-hidden="true">
            <LogoMark />
            <span>{PRODUCT_NAME}</span>
          </div>

          <h1 className="auth-title">{copy.title}</h1>
          <p className="auth-subtitle">{copy.subtitle}</p>

          {notice && (
            <p className="auth-banner auth-banner-info" role="status">
              <InfoIcon />
              <span>{notice}</span>
            </p>
          )}
          {formError && (
            <p className="auth-banner auth-banner-error" role="alert">
              <ErrorIcon />
              <span>{formError}</span>
            </p>
          )}

          <form className="auth-form" onSubmit={handleSubmit} noValidate aria-busy={submitting}>
            <div className="auth-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => update('email', event.target.value)}
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? errorId('email') : undefined}
                autoFocus
              />
              {fieldErrors.email && (
                <p id={errorId('email')} className="auth-field-error">
                  <ErrorIcon />
                  <span>{fieldErrors.email}</span>
                </p>
              )}
            </div>

            <div className="auth-field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(event) => update('password', event.target.value)}
                aria-invalid={!!fieldErrors.password}
                aria-describedby={
                  fieldErrors.password ? errorId('password') : mode === 'register' ? 'password-hint' : undefined
                }
              />
              {fieldErrors.password ? (
                <p id={errorId('password')} className="auth-field-error">
                  <ErrorIcon />
                  <span>{fieldErrors.password}</span>
                </p>
              ) : (
                mode === 'register' && (
                  <p id="password-hint" className="auth-field-hint">
                    At least 8 characters
                  </p>
                )
              )}
            </div>

            {mode === 'register' && (
              <div className="auth-field">
                <label htmlFor="confirm-password">Confirm password</label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => update('confirmPassword', event.target.value)}
                  aria-invalid={!!fieldErrors.confirmPassword}
                  aria-describedby={fieldErrors.confirmPassword ? errorId('confirmPassword') : undefined}
                />
                {fieldErrors.confirmPassword && (
                  <p id={errorId('confirmPassword')} className="auth-field-error">
                    <ErrorIcon />
                    <span>{fieldErrors.confirmPassword}</span>
                  </p>
                )}
              </div>
            )}

            <button type="submit" className="auth-submit" disabled={submitting}>
              {submitting && <span className="auth-spinner" aria-hidden="true" />}
              {submitting ? copy.submitting : copy.submit}
            </button>
          </form>

          <p className="auth-switch">
            {copy.switchText}{' '}
            <a href={mode === 'login' ? '/register' : '/login'} onClick={switchMode}>
              {copy.switchLink}
            </a>
          </p>
        </div>

        {/* Top-right corner, but last in the tab order: the form comes first */}
        <ThemeToggle className="auth-theme-toggle" />
      </main>
    </div>
  )
}

export default AuthPage
