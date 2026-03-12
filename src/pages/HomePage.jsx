import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import styles from './HomePage.module.css'

const EMOTION_EMOJI = {
  행복: '😊', 설렘: '💫', 신기함: '✨', 즐거움: '🎉',
  따뜻함: '🌸', 뿌듯함: '🌟', 신남: '🎈',
}

const formatDate = (iso) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

export default function HomePage() {
  const navigate  = useNavigate()
  const { user, signOut } = useAuthStore()
  const nickname  = user?.user_metadata?.name ?? '어린이'
  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('stories')
      .select('id, title, emotion, image_url, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setStories(data ?? [])
        setLoading(false)
      })
  }, [user])

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

      {/* 그림일기 목록 */}
      <section className={styles.recentWrap}>
        <h2 className={styles.sectionTitle}>최근 나의 그림일기</h2>
        {loading ? (
          <div className={styles.emptyBox}>불러오는 중...</div>
        ) : stories.length === 0 ? (
          <div className={styles.emptyBox}>
            <p>아직 그림일기가 없어요.</p>
            <p>첫 그림을 그려보세요! ✨</p>
          </div>
        ) : (
          <ul className={styles.storyList}>
            {stories.map((s) => (
              <li key={s.id} className={styles.storyItem} onClick={() => navigate(`/story/${s.id}`)}>
                <img src={s.image_url} alt={s.title} className={styles.storyThumb} />
                <div className={styles.storyInfo}>
                  <span className={styles.storyTitle}>{s.title}</span>
                  <span className={styles.storySub}>
                    {EMOTION_EMOJI[s.emotion] ?? '💛'} {s.emotion} · {formatDate(s.created_at)}
                  </span>
                </div>
                <span className={styles.storyArrow}>›</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
