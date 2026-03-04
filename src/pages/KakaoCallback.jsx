import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function KakaoCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    if (!code) return navigate('/login')

    supabase.auth.exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error) {
          console.error('카카오 로그인 오류:', error)
          navigate('/login')
        } else {
          navigate('/home')
        }
      })
  }, [navigate])

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:'16px' }}>
      <div style={{ fontSize:'2.5rem' }}>🎨</div>
      <p style={{ color:'var(--color-muted)' }}>로그인 처리 중...</p>
    </div>
  )
}
