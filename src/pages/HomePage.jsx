import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import styles from './HomePage.module.css'

export default function HomePage() {
  const navigate  = useNavigate()
  const { user, signOut } = useAuthStore()
  const nickname  = user?.user_metadata?.name ?? '어린이'

  return (
    <div className={styles.wrap}>
      {/* 상단 바 */}
      <header className={styles.header}>
        <span className={styles.logoSmall}>아이<em>담</em></span>
        <button className={styles.outBtn} onClick={signOut}>로그아웃</button>
      </header>

      {/* 인사말 */}
      <section className={styles.greeting}>
        <p className={styles.hi}>안녕, <strong>{nickname}</strong>! 👋</p>
        <p className={styles.sub}>오늘의 그림을 그려볼까요?</p>
        <p style={{ marginTop: '10px', fontSize: '0.95rem', color: '#3D5AFE', fontWeight: 500 }}>
          수아야, 아빠가 너를 위해 만들었어! 마음껏 그려봐 🖍️
        </p>
      </section>

      {/* 그리기 시작 버튼 */}
      <button className={styles.drawBtn} onClick={() => navigate('/draw')}>
        <span className={styles.drawIcon}>🎨</span>
        <span>그림 그리기 시작!</span>
      </button>

      {/* 최근 동화 (추후 구현) */}
      <section className={styles.recentWrap}>
        <h2 className={styles.sectionTitle}>최근 나의 동화</h2>
        <div className={styles.emptyBox}>
          <p>아직 동화가 없어요.</p>
          <p>첫 그림을 그려보세요! ✨</p>
        </div>
      </section>
    </div>
  )
}
