import { Navigate, Route, Routes } from 'react-router'
import { AuthPage } from './features/auth/AuthPage'
import { useAuth } from './features/auth/useAuth'
import { HomePage } from './features/lobby/HomePage'
import { SessionPage } from './features/lobby/SessionPage'

export default function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center text-slate-400">
        Loading…
      </div>
    )
  }

  if (session === null) {
    return (
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<HomePage session={session} />} />
      <Route path="/play/:sessionId" element={<SessionPage session={session} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
