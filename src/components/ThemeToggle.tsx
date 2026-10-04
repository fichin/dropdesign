import { setTheme, useTheme } from '../state/theme'
import { MoonIcon, SunIcon } from './icons'

/** Light/dark switch; shows the theme it switches to */
function ThemeToggle({ className }: { className: string }) {
  const theme = useTheme()
  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      className={className}
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
      onClick={() => setTheme(nextTheme)}
    >
      {nextTheme === 'dark' ? <MoonIcon /> : <SunIcon />}
    </button>
  )
}

export default ThemeToggle
