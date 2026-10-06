import { useEffect } from 'react'
import AuthPage from './components/AuthPage'
import BoardScreen from './components/BoardScreen'
import NotFoundPage from './components/NotFoundPage'
import { usePath } from './routing'
import { useAuth } from './state/useAuth'

const AUTH_PATHS = { '/login': 'login', '/register': 'register' } as const

function App() {
  const { auth, login, register, tryDemo, logout, sessionEnded } = useAuth()
  const { path, navigate } = usePath()
  const authMode = AUTH_PATHS[path as keyof typeof AUTH_PATHS]
  const isBoard = path === '/'

  // Signed out → the login page; signed in → away from login/register. Any other path shows
  // the 404 page instead of redirecting, so a mistyped link says so
  useEffect(() => {
    if (auth.status === 'signedOut' && isBoard) navigate('/login', { replace: true })
    else if (auth.status === 'signedIn' && authMode) navigate('/', { replace: true })
  }, [auth.status, authMode, isBoard, navigate])

  if (!authMode && !isBoard) {
    return <NotFoundPage path={path} signedIn={auth.status === 'signedIn'} onNavigate={navigate} />
  }

  if (authMode) {
    if (auth.status === 'signedIn') return null // redirecting to the board
    return (
      <AuthPage
        key={authMode}
        mode={authMode}
        notice={auth.status === 'signedOut' ? auth.reason : undefined}
        onSubmit={authMode === 'login' ? login : register}
        onSwitchMode={(mode) => navigate(`/${mode}`)}
        onTryDemo={tryDemo}
      />
    )
  }

  if (auth.status === 'signedOut') return null // redirecting to login

  // While the session is still being checked (or the server is unreachable) the board
  // screen loads in parallel: it shows the cached copy at once, and a 401 from it
  // means the session has ended
  return (
    <BoardScreen
      user={auth.status === 'signedIn' ? auth.user : undefined}
      onLogout={logout}
      onUnauthorized={sessionEnded}
    />
  )
}

export default App
