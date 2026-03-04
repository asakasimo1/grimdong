import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'

import LoginPage     from './pages/LoginPage'
import KakaoCallback from './pages/KakaoCallback'
import HomePage      from './pages/HomePage'
import DrawPage      from './pages/DrawPage'
import StoryPage     from './pages/StoryPage'

function PrivateRoute({ children }) {
  const { user, loading } = useAuthStore()
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontSize:'1.2rem', color:'var(--color-muted)' }}>
      불러오는 중...
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  const init = useAuthStore((s) => s.init)
  useEffect(() => { init() }, [init])

  return (
    <Routes>
      <Route path="/login"               element={<LoginPage />} />
      <Route path="/auth/kakao/callback" element={<KakaoCallback />} />
      <Route path="/home"                element={<PrivateRoute><HomePage /></PrivateRoute>} />
      <Route path="/draw"                element={<PrivateRoute><DrawPage /></PrivateRoute>} />
      <Route path="/story/:id"           element={<PrivateRoute><StoryPage /></PrivateRoute>} />
      <Route path="*"                    element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
