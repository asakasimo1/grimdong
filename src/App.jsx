import { useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigationType } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuthStore } from './store/authStore'

import LoginPage      from './pages/LoginPage'
import KakaoCallback  from './pages/KakaoCallback'
import HomePage       from './pages/HomePage'
import DrawPage       from './pages/DrawPage'
import StoryPage      from './pages/StoryPage'
import SettingsPage   from './pages/SettingsPage'
import SelectPage      from './pages/SelectPage'
import DiaryInputPage  from './pages/DiaryInputPage'
import DiaryResultPage from './pages/DiaryResultPage'
import DiaryDetailPage from './pages/DiaryDetailPage'
import AudioPlayer    from './components/AudioPlayer'
import TransformModal from './components/TransformModal'

// 페이지 깊이 — 숫자가 클수록 "안쪽" 화면
const PAGE_DEPTH = {
  '/login':                 0,
  '/auth/kakao/callback':   0,
  '/select':                1,
  '/home':                  1,
  '/settings':              2,
  '/draw':                  2,
  '/diary':                 2,
  '/diary-result':          3,
  '/diary/':                3,
  '/story':                 3,
}

function getDepth(pathname) {
  const key = Object.keys(PAGE_DEPTH).find((k) => pathname.startsWith(k))
  return key != null ? PAGE_DEPTH[key] : 0
}

// ── 전환 variants ────────────────────────────────────────────────────────────
// custom: true → push(앞으로), false → pop(뒤로)
const variants = {
  initial: (isPush) => ({
    x: isPush ? '100%' : '-28%',
    opacity: isPush ? 1 : 0.82,
    scale: isPush ? 1 : 0.97,
  }),
  animate: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 370,
      damping: 38,
      mass: 0.85,
      opacity: { duration: 0.18 },
    },
  },
  exit: (isPush) => ({
    x: isPush ? '-28%' : '100%',
    opacity: isPush ? 0.82 : 1,
    scale: isPush ? 0.97 : 1,
    transition: {
      type: 'spring',
      stiffness: 370,
      damping: 38,
      mass: 0.85,
      opacity: { duration: 0.18 },
    },
  }),
}

const fadeVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit:    { opacity: 0, transition: { duration: 0.15 } },
}

const pageStyle = {
  position: 'fixed',
  inset: 0,
  overflowY: 'auto',
  overflowX: 'hidden',
  background: 'var(--color-bg)',
  willChange: 'transform',
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuthStore()
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100svh', fontSize:'1.2rem', color:'var(--color-muted)' }}>
      불러오는 중...
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  const init         = useAuthStore((s) => s.init)
  const location     = useLocation()
  const navType      = useNavigationType()   // 'PUSH' | 'POP' | 'REPLACE'
  const prevDepthRef = useRef(getDepth(location.pathname))

  useEffect(() => { init() }, [init])

  // REPLACE(리다이렉트)는 방향 없음 — depth 기반으로 대체
  const currentDepth = getDepth(location.pathname)
  const isPush = navType === 'PUSH'
    ? true
    : navType === 'POP'
      ? false
      : currentDepth >= prevDepthRef.current  // REPLACE fallback

  useEffect(() => {
    prevDepthRef.current = currentDepth
  })

  // REPLACE 전환은 fade만 (리다이렉트 등)
  const isReplace = navType === 'REPLACE'

  return (
    <>
      <TransformModal />
      <AudioPlayer />
      <AnimatePresence mode="sync" custom={isPush} initial={false}>
        <motion.div
          key={location.key}
          custom={isPush}
          variants={isReplace ? fadeVariants : variants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={pageStyle}
        >
          <Routes location={location}>
            <Route path="/login"               element={<LoginPage />} />
            <Route path="/auth/kakao/callback" element={<KakaoCallback />} />
            <Route path="/select"              element={<PrivateRoute><SelectPage /></PrivateRoute>} />
            <Route path="/home"                element={<PrivateRoute><HomePage /></PrivateRoute>} />
            <Route path="/settings"            element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
            <Route path="/draw"                element={<PrivateRoute><DrawPage /></PrivateRoute>} />
            <Route path="/story/:id"           element={<PrivateRoute><StoryPage /></PrivateRoute>} />
            <Route path="/diary"               element={<PrivateRoute><DiaryInputPage /></PrivateRoute>} />
            <Route path="/diary-result"        element={<PrivateRoute><DiaryResultPage /></PrivateRoute>} />
            <Route path="/diary/:id"           element={<PrivateRoute><DiaryDetailPage /></PrivateRoute>} />
            <Route path="*"                    element={<Navigate to="/select" replace />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </>
  )
}
