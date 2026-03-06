import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'

import LoginPage     from './pages/LoginPage'
import KakaoCallback from './pages/KakaoCallback'
import HomePage      from './pages/HomePage'
import DrawPage      from './pages/DrawPage'
import StoryPage     from './pages/StoryPage'

function PrivateRoute({ children }) {
  // [테스트 모드] 인증 우회 — 카카오 로그인 없이 자유 접속
  return children

  // eslint-disable-next-line no-unreachable
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
      {/* [테스트 모드] 로그인 페이지 → 홈으로 바로 이동 */}
      <Route path="/login"               element={<Navigate to="/home" replace />} />
      <Route path="/auth/kakao/callback" element={<KakaoCallback />} />
      <Route path="/home"                element={<PrivateRoute><HomePage /></PrivateRoute>} />
      <Route path="/draw"                element={<PrivateRoute><DrawPage /></PrivateRoute>} />
      <Route path="/story/:id"           element={<PrivateRoute><StoryPage /></PrivateRoute>} />
      <Route path="*"                    element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
