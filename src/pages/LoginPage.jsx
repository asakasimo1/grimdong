import styles from './LoginPage.module.css'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const handleKakaoLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}/auth/kakao/callback`,
        scopes: 'profile_nickname profile_image',
      },
    })
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        {/* 로고 */}
        <div className={styles.logo}>
          <svg width="56" height="46" viewBox="0 0 44 36" fill="none">
            <defs>
              <linearGradient id="lc1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FF6B6B"/><stop offset="100%" stopColor="#C0392B"/></linearGradient>
              <linearGradient id="lc2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FF9F43"/><stop offset="100%" stopColor="#E67E22"/></linearGradient>
              <linearGradient id="lc3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FDA7A7"/><stop offset="100%" stopColor="#E88"/></linearGradient>
              <linearGradient id="lc4" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#55EFC4"/><stop offset="100%" stopColor="#00B894"/></linearGradient>
              <linearGradient id="lc5" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#74B9FF"/><stop offset="100%" stopColor="#0984E3"/></linearGradient>
            </defs>
            {[
              { id:'lc1', r:-14 }, { id:'lc2', r:-7 }, { id:'lc3', r:0 },
              { id:'lc4', r:7 },  { id:'lc5', r:14 },
            ].map(({ id, r }) => (
              <g key={id} transform={`rotate(${r} 22 30)`}>
                <rect x="19.5" y="4" width="5" height="22" rx="2.5" fill={`url(#${id})`}/>
                <polygon points="19.5,26 24.5,26 22,30" fill={`url(#${id})`}/>
              </g>
            ))}
            <circle cx="22" cy="30" r="4" fill="#FFD700" opacity="0.9"/>
            <text x="22" y="33" textAnchor="middle" fontSize="5" fill="#fff">★</text>
          </svg>
          <span className={styles.logoText}>아이<em>담</em></span>
        </div>

        <p className={styles.tagline}>오늘의 그림이 내일의 동화가 됩니다</p>

        <button className={styles.kakaoBtn} onClick={handleKakaoLogin}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path fillRule="evenodd" clipRule="evenodd"
              d="M10 0C4.477 0 0 3.582 0 8c0 2.83 1.67 5.315 4.207 6.81-.185.69-.669 2.498-.766 2.888-.12.49.178.484.374.352.153-.102 2.435-1.65 3.42-2.32.576.08 1.163.122 1.765.122 5.523 0 10-3.582 10-8S15.523 0 10 0z"
              fill="#000000"/>
          </svg>
          카카오로 시작하기
        </button>

        <p className={styles.notice}>
          초등 1~2학년 어린이를 위한<br/>AI 그림동화 플랫폼
        </p>
      </div>
    </div>
  )
}
