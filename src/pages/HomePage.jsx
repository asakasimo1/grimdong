import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import styles from './HomePage.module.css'

// ── 오늘의 주제 ───────────────────────────────────────────────────────────────
const DAILY_TOPICS = [
  { emoji: '🐶', text: '내가 제일 좋아하는 동물을 그려봐!' },
  { emoji: '🍕', text: '오늘 먹고 싶은 음식을 그려봐!' },
  { emoji: '🌸', text: '벚꽃이 흩날리는 공원을 그려봐!' },
  { emoji: '🦁', text: '용감한 사자 왕을 그려봐!' },
  { emoji: '🚀', text: '우주여행을 하는 내 모습을 그려봐!' },
  { emoji: '👨‍👩‍👧', text: '우리 가족이 소풍 가는 장면을 그려봐!' },
  { emoji: '🍰', text: '생일 케이크를 멋지게 꾸며봐!' },
  { emoji: '🦋', text: '예쁜 나비가 꽃밭에서 노는 모습을 그려봐!' },
  { emoji: '🏰', text: '내가 사는 멋진 성을 그려봐!' },
  { emoji: '⛄', text: '눈사람을 만드는 내 모습을 그려봐!' },
  { emoji: '🐬', text: '바닷속에서 헤엄치는 돌고래를 그려봐!' },
  { emoji: '🎮', text: '내가 좋아하는 게임 캐릭터를 그려봐!' },
  { emoji: '🌊', text: '파도가 치는 여름 바닷가를 그려봐!' },
  { emoji: '🧙', text: '마법사가 된 내 모습을 그려봐!' },
  { emoji: '🍜', text: '뜨끈한 라면 한 그릇을 그려봐!' },
  { emoji: '🦸', text: '슈퍼히어로가 된 내 모습을 그려봐!' },
  { emoji: '🌈', text: '비 온 뒤 무지개가 뜬 하늘을 그려봐!' },
  { emoji: '🛝', text: '놀이터에서 신나게 노는 장면을 그려봐!' },
  { emoji: '🦄', text: '반짝이는 유니콘을 그려봐!' },
  { emoji: '🍓', text: '딸기랑 수박이 가득한 과일바구니를 그려봐!' },
  { emoji: '✈️', text: '비행기를 타고 여행가는 장면을 그려봐!' },
  { emoji: '🐉', text: '착한 용이랑 친구가 된 장면을 그려봐!' },
  { emoji: '🌻', text: '키 큰 해바라기 밭을 그려봐!' },
  { emoji: '⚽', text: '친구들이랑 축구하는 장면을 그려봐!' },
  { emoji: '🧜', text: '바닷속 인어 왕국을 그려봐!' },
  { emoji: '⭐', text: '반짝이는 별이 가득한 밤하늘을 그려봐!' },
  { emoji: '🎪', text: '신나는 놀이공원을 그려봐!' },
  { emoji: '🦊', text: '숲속에 사는 여우를 그려봐!' },
  { emoji: '🍦', text: '맛있는 아이스크림 가게를 그려봐!' },
  { emoji: '🏊', text: '수영장에서 물놀이하는 장면을 그려봐!' },
  { emoji: '🌙', text: '달빛이 비치는 조용한 마을을 그려봐!' },
  { emoji: '🤝', text: '친한 친구랑 같이 노는 모습을 그려봐!' },
  { emoji: '🚂', text: '달리는 기차 안 풍경을 그려봐!' },
  { emoji: '🐸', text: '연못에 앉아 있는 개구리를 그려봐!' },
  { emoji: '🎂', text: '가족이 모여 생일 파티하는 장면을 그려봐!' },
  { emoji: '🛸', text: '외계인 친구를 만난 장면을 그려봐!' },
  { emoji: '🍂', text: '알록달록 단풍잎이 떨어지는 숲을 그려봐!' },
  { emoji: '🎸', text: '기타를 치는 내 모습을 그려봐!' },
  { emoji: '🌍', text: '내가 만든 상상의 섬을 그려봐!' },
  { emoji: '📚', text: '학교 교실 안 풍경을 그려봐!' },
  { emoji: '🪞', text: '내 얼굴을 자세히 그려봐!' },
  { emoji: '🚢', text: '큰 배를 타고 바다 여행하는 장면을 그려봐!' },
  { emoji: '🐰', text: '귀여운 토끼가 당근을 먹는 장면을 그려봐!' },
  { emoji: '🎭', text: '학예회에서 공연하는 장면을 그려봐!' },
  { emoji: '🍩', text: '달콤한 도넛 가게를 그려봐!' },
  { emoji: '👴', text: '할머니 할아버지 댁에 놀러 간 장면을 그려봐!' },
  { emoji: '🚁', text: '헬리콥터를 타고 하늘을 나는 모습을 그려봐!' },
  { emoji: '🌛', text: '자기 전에 내가 하는 일을 그려봐!' },
  { emoji: '🎵', text: '내가 좋아하는 노래를 부르는 모습을 그려봐!' },
  { emoji: '🏰', text: '공주(왕자)가 사는 동화 나라를 그려봐!' },
  { emoji: '🐧', text: '남극에 사는 펭귄 가족을 그려봐!' },
  { emoji: '🌺', text: '예쁜 꽃들이 가득한 정원을 그려봐!' },
  { emoji: '🎒', text: '학교 갈 준비를 하는 내 모습을 그려봐!' },
]

const TOPIC_COLORS = [
  { bg: '#FFF0F3', accent: '#E91E63', text: '#880E4F' },
  { bg: '#FFFDE7', accent: '#F9A825', text: '#E65100' },
  { bg: '#E8F5E9', accent: '#2E7D32', text: '#1B5E20' },
  { bg: '#E3F2FD', accent: '#1565C0', text: '#0D47A1' },
  { bg: '#EDE7F6', accent: '#6A1B9A', text: '#4A148C' },
  { bg: '#FFF3E0', accent: '#E65100', text: '#BF360C' },
  { bg: '#E0F7FA', accent: '#00695C', text: '#004D40' },
]

const getTodayTopic = () => {
  const dayIdx = Math.floor(Date.now() / 86400000)
  return {
    ...DAILY_TOPICS[dayIdx % DAILY_TOPICS.length],
    color: TOPIC_COLORS[dayIdx % TOPIC_COLORS.length],
  }
}

// ── 배지 정의 ─────────────────────────────────────────────────────────────────
const BADGES = [
  { id: 'first',     icon: '🌱', label: '첫 작품',   desc: '첫 번째 그림이나 일기',   condition: ({ total })        => total >= 1     },
  { id: 'streak3',   icon: '🔥', label: '3일 연속',  desc: '3일 연속으로 만들었어요',  condition: ({ streak })       => streak >= 3    },
  { id: 'streak7',   icon: '⭐', label: '일주일 연속', desc: '일주일 연속!',           condition: ({ streak })       => streak >= 7    },
  { id: 'stories10', icon: '🎨', label: '그림 10개', desc: '그림 10개 완성',          condition: ({ totalStories }) => totalStories >= 10 },
  { id: 'diaries10', icon: '📔', label: '일기 10개', desc: '일기 10개 완성',          condition: ({ totalDiaries }) => totalDiaries >= 10 },
  { id: 'streak30',  icon: '💎', label: '한 달 연속', desc: '30일 연속 대단해요!',     condition: ({ streak })       => streak >= 30   },
  { id: 'total50',   icon: '🌟', label: '50개 달성', desc: '그림+일기 합계 50개',     condition: ({ total })        => total >= 50    },
]

// ── 공통 상수 ─────────────────────────────────────────────────────────────────
const EMOTION_EMOJI = {
  행복: '😊', 설렘: '💫', 신기함: '✨', 즐거움: '🎉',
  따뜻함: '🌸', 뿌듯함: '🌟', 신남: '🎈',
}

const PAGE_SIZE = 6

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

const formatDiaryDate = (iso) => {
  const [, m, d] = iso.split('-')
  return `${+m}월 ${+d}일`
}

const getLocalDateStr = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────
export default function HomePage() {
  const navigate  = useNavigate()
  const { user, signOut } = useAuthStore()
  const [childName, setChildName] = useState('')
  const [stories,   setStories]   = useState([])
  const [total,     setTotal]     = useState(0)
  const [page,      setPage]      = useState(0)
  const [loading,   setLoading]   = useState(true)

  // 일기 목록
  const [diaries,      setDiaries]      = useState([])
  const [diaryTotal,   setDiaryTotal]   = useState(0)
  const [diaryPage,    setDiaryPage]    = useState(0)
  const [diaryLoading, setDiaryLoading] = useState(true)

  // 스트릭 / 배지
  const [streak,       setStreak]       = useState(0)
  const [earnedBadges, setEarnedBadges] = useState([])

  // 달력 뷰
  const [viewMode,   setViewMode]   = useState('list')
  const [calYear,    setCalYear]    = useState(() => new Date().getFullYear())
  const [calMonth,   setCalMonth]   = useState(() => new Date().getMonth())
  const [calStories, setCalStories] = useState([])
  const [calLoading, setCalLoading] = useState(false)

  const totalPages      = Math.ceil(total / PAGE_SIZE)
  const diaryTotalPages = Math.ceil(diaryTotal / PAGE_SIZE)

  const message    = useMemo(() => MESSAGES[Math.floor(Math.random() * MESSAGES.length)], [])
  const todayTopic = useMemo(() => getTodayTopic(), [])

  // 프로필 이름
  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('name').eq('id', user.id).single()
      .then(({ data }) => setChildName(data?.name ?? ''))
  }, [user])

  // 그림 이야기 목록
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

  // 일기 목록
  const fetchDiaries = useCallback(async (p) => {
    if (!user) return
    setDiaryLoading(true)
    const from = p * PAGE_SIZE
    const to   = from + PAGE_SIZE - 1
    const [{ count }, { data }] = await Promise.all([
      supabase.from('diaries').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('diaries')
        .select('id, date, diary_text, image_url, created_at')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .range(from, to),
    ])
    setDiaryTotal(count ?? 0)
    setDiaries(data ?? [])
    setDiaryLoading(false)
  }, [user])

  useEffect(() => { fetchDiaries(diaryPage) }, [fetchDiaries, diaryPage])

  // 스트릭 / 배지 계산
  const fetchStreakAndBadges = useCallback(async () => {
    if (!user) return
    const [{ data: storyDates }, { data: diaryDates }] = await Promise.all([
      supabase.from('stories').select('created_at').eq('user_id', user.id),
      supabase.from('diaries').select('date').eq('user_id', user.id),
    ])

    const dateSet = new Set([
      ...(storyDates ?? []).map(s => getLocalDateStr(new Date(s.created_at))),
      ...(diaryDates ?? []).map(d => d.date),
    ])

    const todayStr    = getLocalDateStr()
    const startOffset = dateSet.has(todayStr) ? 0 : 1
    let streakCount   = 0
    for (let i = startOffset; i <= 365; i++) {
      const d = new Date(); d.setDate(d.getDate() - i)
      if (dateSet.has(getLocalDateStr(d))) streakCount++
      else break
    }

    const totalStories  = storyDates?.length ?? 0
    const totalDiaries  = diaryDates?.length ?? 0
    const total         = totalStories + totalDiaries
    const earned = BADGES
      .filter(b => b.condition({ streak: streakCount, totalStories, totalDiaries, total }))
      .map(b => b.id)

    setStreak(streakCount)
    setEarnedBadges(earned)
  }, [user])

  useEffect(() => { fetchStreakAndBadges() }, [fetchStreakAndBadges])

  // 달력 스토리
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
    if (error) { toast.error(`삭제 실패: ${error.message}`); return }
    try {
      const path = new URL(story.image_url).pathname.split('/drawings/')[1]
      if (path) await supabase.storage.from('drawings').remove([path])
    } catch {}
    fetchStories(page)
  }

  const handleDiaryDelete = async (e, diary) => {
    e.stopPropagation()
    if (!window.confirm(`${formatDiaryDate(diary.date)} 일기를 삭제할까요?`)) return
    const { error } = await supabase.from('diaries').delete().eq('id', diary.id)
    if (error) { toast.error(`삭제 실패: ${error.message}`); return }
    try {
      const path = new URL(diary.image_url).pathname.split('/drawings/')[1]
      if (path) await supabase.storage.from('drawings').remove([path])
    } catch {}
    fetchDiaries(diaryPage)
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
              const story = day ? storyMap[day] : null
              const isSun = i % 7 === 0
              const isSat = i % 7 === 6
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
          <button className={styles.backToSelect} onClick={() => navigate('/select')}>← 홈</button>
          <button className={styles.settingsBtn} onClick={() => navigate('/settings')}>⚙️</button>
          <button className={styles.outBtn} onClick={signOut}>로그아웃</button>
        </div>
      </header>

      <section className={styles.greeting}>
        <p className={styles.hi}>안녕, <strong>{displayName}</strong>! 👋</p>
        <p className={styles.sub}>오늘의 그림을 그려볼까요?</p>
        <p className={styles.message}>{message}</p>
      </section>

      {/* ── 스트릭 + 배지 ── */}
      <div className={styles.streakSection}>
        <div className={styles.streakRow}>
          <span className={styles.streakFire}>🔥</span>
          <span className={styles.streakLabel}>
            {streak > 0 ? `${streak}일 연속 도전 중!` : '오늘 첫 작품을 만들어봐요!'}
          </span>
        </div>
        <div className={styles.badgeScroll}>
          {BADGES.map((badge) => {
            const earned = earnedBadges.includes(badge.id)
            return (
              <div key={badge.id} className={`${styles.badgeItem} ${earned ? styles.badgeEarned : styles.badgeLocked}`} title={badge.desc}>
                <span className={styles.badgeIcon}>{badge.icon}</span>
                <span className={styles.badgeLabel}>{badge.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 오늘의 주제 카드 ── */}
      <div
        className={styles.topicCard}
        style={{ background: todayTopic.color.bg, borderColor: todayTopic.color.accent }}
      >
        <span className={styles.topicChip} style={{ background: todayTopic.color.accent }}>✏️ 오늘의 주제</span>
        <div className={styles.topicBody}>
          <span className={styles.topicEmoji}>{todayTopic.emoji}</span>
          <p className={styles.topicText} style={{ color: todayTopic.color.text }}>{todayTopic.text}</p>
        </div>
        <button
          className={styles.topicBtn}
          style={{ background: todayTopic.color.accent }}
          onClick={() => navigate('/draw')}
        >
          🎨 그려볼까요!
        </button>
      </div>

      {/* ── 액션 버튼 ── */}
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

      {/* ── 나의 그림 이야기 ── */}
      <section className={styles.recentWrap}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            나의 그림 이야기
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
              <p>아직 그림이 없어요.</p>
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

      {/* ── 나의 일기 ── */}
      <section className={styles.recentWrap} style={{ marginTop: 32 }}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            나의 일기
            {diaryTotal > 0 && <span className={styles.totalCount}>{diaryTotal}</span>}
          </h2>
          <button className={styles.diaryShortcut} onClick={() => navigate('/diary')}>+ 새 일기</button>
        </div>

        {diaryLoading ? (
          <div className={styles.emptyBox}>불러오는 중...</div>
        ) : diaries.length === 0 ? (
          <div className={styles.emptyBox}>
            <p>아직 저장된 일기가 없어요.</p>
            <p>일기를 써보세요! 📔</p>
          </div>
        ) : (
          <>
            <ul className={styles.storyList}>
              {diaries.map((d) => (
                <li key={d.id} className={styles.storyItem} onClick={() => navigate(`/diary/${d.id}`)}>
                  <img src={d.image_url} alt="일기 카드" className={styles.diaryThumb} />
                  <div className={styles.storyInfo}>
                    <span className={styles.storyTitle}>{formatDiaryDate(d.date)}</span>
                    <span className={styles.storySub}>{d.diary_text?.slice(0, 40)}{d.diary_text?.length > 40 ? '…' : ''}</span>
                  </div>
                  <button className={styles.deleteBtn} onClick={(e) => handleDiaryDelete(e, d)}>🗑️</button>
                </li>
              ))}
            </ul>
            {diaryTotalPages > 1 && (
              <div className={styles.pagination}>
                <button className={styles.pageBtn} onClick={() => setDiaryPage((p) => p - 1)} disabled={diaryPage === 0}>‹</button>
                <span className={styles.pageInfo}>{diaryPage + 1} / {diaryTotalPages}</span>
                <button className={styles.pageBtn} onClick={() => setDiaryPage((p) => p + 1)} disabled={diaryPage >= diaryTotalPages - 1}>›</button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
