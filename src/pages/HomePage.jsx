import { useEffect, useState, useCallback, useMemo } from 'react'
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

const MESSAGES = [
  '오늘도 멋진 그림 그려볼까? 🖍️',
  '어떤 그림을 그릴지 벌써 기대돼! 🎨',
  '오늘 하루도 그림으로 남겨보자! 📔',
  '네 그림이 일기가 되는 마법! ✨',
  '오늘은 어떤 이야기가 나올까? 🌟',
  '붓 들고 오늘의 주인공이 되자! 🌈',
]

const MONTH_NAMES = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

const formatDate = (iso) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

export default function HomePage() {
  const navigate  = useNavigate()
  const { user, signOut } = useAuthStore()
  const [childName, setChildName] = useState('')
  const [stories,   setStories]   = useState([])
  const [total,     setTotal]     = useState(0)
  const [page,      setPage]      = useState(0)
  const [loading,   setLoading]   = useState(true)

  // 달력 뷰
  const [viewMode,    setViewMode]    = useState('list')
  const [calYear,     setCalYear]     = useState(() => new Date().getFullYear())
  const [calMonth,    setCalMonth]    = useState(() => new Date().getMonth())
  const [calStories,  setCalStories]  = useState([])
  const [calLoading,  setCalLoading]  = useState(false)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  // 접속마다 랜덤 메시지 고정
  const message = useMemo(() => MESSAGES[Math.floor(Math.random() * MESSAGES.length)], [])

  // 프로필에서 아이 이름 로드
  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('name').eq('id', user.id).single()
      .then(({ data }) => setChildName(data?.name ?? ''))
  }, [user])

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

  // 달력 스토리 로드
  useEffect(() => {
    if (!user || viewMode !== 'calendar') return
    setCalLoading(true)
    const start = new Date(calYear, calMonth, 1).toISOString()
    const end   = new Date(calYear, calMonth + 1, 0, 23, 59, 59, 999).toISOString()
    supabase.from('stories')
      .select('id, emotion, created_at')
      .eq('user_id', user.id)
      .gte('created_at', start)
      .lte('created_at', end)
      .then(({ data }) => { setCalStories(data ?? []); setCalLoading(false) })
  }, [user, viewMode, calYear, calMonth])

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

  const handleCalPrev = () => {
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11) }
    else setCalMonth((m) => m - 1)
  }
  const handleCalNext = () => {
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0) }
    else setCalMonth((m) => m + 1)
  }

  const renderCalendar = () => {
    const firstDay    = new Date(calYear, calMonth, 1).getDay()
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
    const storyMap    = {}
    calStories.forEach((s) => {
      const d = new Date(s.created_at).getDate()
      if (!storyMap[d]) storyMap[d] = s
    })

    const cells = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)

    return (
      <div className={styles.calendar}>
        <div className={styles.calHeader}>
          <button className={styles.calNavBtn} onClick={handleCalPrev}>‹</button>
          <span className={styles.calMonthLabel}>{calYear}년 {MONTH_NAMES[calMonth]}</span>
          <button className={styles.calNavBtn} onClick={handleCalNext}>›</button>
        </div>
        <div className={styles.calWeekRow}>
          {['일','월','화','수','목','금','토'].map((d, i) => (
            <span key={d} className={`${styles.calWeekDay} ${i === 0 ? styles.sun : i === 6 ? styles.sat : ''}`}>{d}</span>
          ))}
        </div>
        {calLoading ? (
          <div className={styles.emptyBox} style={{ marginTop: 16 }}>불러오는 중...</div>
        ) : (
          <div className={styles.calGrid}>
            {cells.map((day, i) => {
              const story  = day ? storyMap[day] : null
              const isSun  = i % 7 === 0
              const isSat  = i % 7 === 6
              return (
                <div key={i}
                  className={`${styles.calCell} ${story ? styles.calCellHasStory : ''} ${!day ? styles.calCellEmpty : ''}`}
                  onClick={() => story && navigate(`/story/${story.id}`)}>
                  {day && (
                    <>
                      <span className={`${styles.calDayNum} ${isSun ? styles.sun : isSat ? styles.sat : ''}`}>{day}</span>
                      {story && <span className={styles.calEmoji}>{EMOTION_EMOJI[story.emotion] ?? '💛'}</span>}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const displayName = childName || user?.user_metadata?.name || '친구'

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <span className={styles.logoSmall}>아이<em>담</em></span>
        <div className={styles.headerActions}>
          <button className={styles.settingsBtn} onClick={() => navigate('/settings')}>⚙️</button>
          <button className={styles.outBtn} onClick={signOut}>로그아웃</button>
        </div>
      </header>

      <section className={styles.greeting}>
        <p className={styles.hi}>안녕, <strong>{displayName}</strong>! 👋</p>
        <p className={styles.sub}>오늘의 그림을 그려볼까요?</p>
        <p className={styles.message}>{message}</p>
      </section>

      <div className={styles.actionBtns}>
        <button className={styles.drawBtn} onClick={() => navigate('/draw')}>
          <span className={styles.drawIcon}>🎨</span>
          <span>그림 그리기</span>
        </button>
        <button className={styles.diaryBtn} onClick={() => navigate('/diary')}>
          <span className={styles.drawIcon}>📝</span>
          <span>일기 쓰기</span>
        </button>
      </div>

      <section className={styles.recentWrap}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            나의 그림일기
            {total > 0 && <span className={styles.totalCount}>{total}</span>}
          </h2>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewBtn} ${viewMode === 'list' ? styles.viewBtnActive : ''}`}
              onClick={() => setViewMode('list')}>📋</button>
            <button
              className={`${styles.viewBtn} ${viewMode === 'calendar' ? styles.viewBtnActive : ''}`}
              onClick={() => setViewMode('calendar')}>📅</button>
          </div>
        </div>

        {viewMode === 'calendar' ? renderCalendar() : (
          loading ? (
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
          )
        )}
      </section>
    </div>
  )
}
