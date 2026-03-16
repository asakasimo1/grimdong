import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import styles from './SelectPage.module.css'

export default function SelectPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuthStore()
  const [childName, setChildName] = useState('')

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('name').eq('id', user.id).single()
      .then(({ data }) => setChildName(data?.name ?? ''))
  }, [user])

  const displayName = childName || user?.user_metadata?.name || '친구'

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <span className={styles.logo}>아이<em>담</em></span>
        <div className={styles.headerActions}>
          <button className={styles.iconBtn} onClick={() => navigate('/settings')}>⚙️</button>
          <button className={styles.iconBtn} onClick={signOut} title="로그아웃">🚪</button>
        </div>
      </header>

      <section className={styles.greeting}>
        <p className={styles.hi}>안녕, <strong>{displayName}</strong>! 👋</p>
        <p className={styles.sub}>오늘은 어떤 걸 만들어볼까요?</p>
      </section>

      <div className={styles.cards}>
        {/* 그려서 일기 만들기 */}
        <button className={`${styles.card} ${styles.cardDraw}`} onClick={() => navigate('/draw')}>
          <div className={styles.cardIcon}>🎨</div>
          <div className={styles.cardBody}>
            <span className={styles.cardTitle}>그려서 일기 만들기</span>
            <span className={styles.cardDesc}>내가 그린 그림이{'\n'}멋진 그림일기가 돼요!</span>
          </div>
          <span className={styles.cardArrow}>›</span>
        </button>

        {/* 일기로 그림 만들기 */}
        <button className={`${styles.card} ${styles.cardDiary}`} onClick={() => navigate('/diary')}>
          <div className={styles.cardIcon}>📝</div>
          <div className={styles.cardBody}>
            <span className={styles.cardTitle}>일기로 그림 만들기</span>
            <span className={styles.cardDesc}>오늘 일기를 쓰면{'\n'}AI가 그림을 그려줘요!</span>
          </div>
          <span className={styles.cardArrow}>›</span>
        </button>
      </div>

      <button className={styles.historyBtn} onClick={() => navigate('/home')}>
        📚 내 그림일기 보기
      </button>
    </div>
  )
}
