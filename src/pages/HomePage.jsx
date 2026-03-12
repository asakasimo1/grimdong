import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import styles from './HomePage.module.css'

const EMOTION_EMOJI = {
  행복: '😊', 설렘: '💫', 신기함: '✨', 즐거움: '🎉',
  따뜻함: '🌸', 뿌듯함: '🌟', 신남: '🎈',
}

const PAGE_SIZE = 10

const formatDate = (iso) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

export default function HomePage() {
  const navigate  = useNavigate()
  const { user, signOut } = useAuthStore()
  const nickname  = user?.user_metadata?.name ?? '어린이'
  const [stories, setStories] = useState([])
  const [total, setTotal]     = useState(0)
  const [page, setPage]       = useState(0)
  const [loading, setLoading] = useState(true)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const fetchStories = useCallback(async (p) => {
    if (!user) return
    setLoading(true)
    const from = p * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1
    const [{ count }, { data }] = await Promise.all([
      supabase.from('stories').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('stories')
        .select('id, title, emotion, image_url, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, to),
    ])
    setTotal(count ?? 0)
    setStories(data ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { fetchStories(page) }, [fetchStories, page])

  const handleDelete = async (e, story) => {
    e.stopPropagation()
    if (!window.confirm(`"${story.title}" 일기를 삭제할까요?`)) return

    const { error } = await supabase.from('stories').delete().eq('id', story.id)
    if (error) {
      console.error('[삭제 에러]', error)
      toast.error(`삭제 실패: ${error.message}`)
      return
    }

    try {
      const path = new URL(story.image_url).pathname.split('/drawings/')[1]
      if (path) await supabase.storage.from('drawings').remove([path])
    } catch {}

    fetchStories(page)
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <span className={styles.logoSmall}>아이<em>담</em></span>
        <button className={styles.outBtn} onClick={signOut}>로그아웃</button>
      </header>

      <section className={styles.greeting}>
        <p className={styles.hi}>안녕, <strong>{nickname}</strong>! 👋</p>
        <p className={styles.sub}>오늘의 그림을 그려볼까요?</p>
        <p style={{ marginTop: '10px', fontSize: '0.95rem', color: '#3D5AFE', fontWeight: 500 }}>
          수아야, 아빠가 너를 위해 만들었어! 마음껏 그려봐 🖍️
        </p>
      </section>

      <button className={styles.drawBtn} onClick={() => navigate('/draw')}>
        <span className={styles.drawIcon}>🎨</span>
        <span>그림 그리기 시작!</span>
      </button>

      <section className={styles.recentWrap}>
        <h2 className={styles.sectionTitle}>
          최근 나의 그림일기
          {total > 0 && <span className={styles.totalCount}>{total}</span>}
        </h2>
        {loading ? (
          <div className={styles.emptyBox}>불러오는 중...</div>
        ) : stories.length === 0 ? (
          <div className={styles.emptyBox}>
            <p>아직 그림일기가 없어요.</p>
            <p>첫 그림을 그려보세요! ✨</p>
          </div>
        ) : (
          <>
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
                  <button className={styles.deleteBtn} onClick={(e) => handleDelete(e, s)}>🗑️</button>
                </li>
              ))}
            </ul>
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button className={styles.pageBtn} onClick={() => setPage((p) => p - 1)} disabled={page === 0}>‹</button>
                <span className={styles.pageInfo}>{page + 1} / {totalPages}</span>
                <button className={styles.pageBtn} onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1}>›</button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
