import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import styles from './DiaryDetailPage.module.css'

async function shareOrDownload(url, filename) {
  try {
    const res  = await fetch(url)
    const blob = await res.blob()
    const file = new File([blob], filename, { type: blob.type || 'image/png' })
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: filename }); return }
      catch (e) { if (e.name === 'AbortError') return }
    }
    const objUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objUrl; a.download = filename; a.click()
    URL.revokeObjectURL(objUrl)
  } catch {
    toast.error('공유에 실패했어요.')
  }
}

const formatDate = (iso) => {
  const [y, m, d] = iso.split('-')
  return `${y}년 ${+m}월 ${+d}일`
}

export default function DiaryDetailPage() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [diary,   setDiary]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !id) return
    supabase
      .from('diaries')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          toast.error('일기를 찾을 수 없어요.')
          navigate('/home', { replace: true })
          return
        }
        setDiary(data)
        setLoading(false)
      })
  }, [id, user, navigate])

  const handleDelete = async () => {
    if (!window.confirm('이 일기를 삭제할까요?')) return
    const { error } = await supabase.from('diaries').delete().eq('id', id)
    if (error) { toast.error('삭제에 실패했어요.'); return }
    try {
      const path = new URL(diary.image_url).pathname.split('/drawings/')[1]
      if (path) await supabase.storage.from('drawings').remove([path])
    } catch {}
    toast.success('일기가 삭제됐어요.')
    navigate('/home', { replace: true })
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100svh', color: 'var(--color-muted)' }}>
      불러오는 중...
    </div>
  )

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/home')}>← 뒤로</button>
        <h1 className={styles.title}>📔 그림일기</h1>
        <button className={styles.deleteBtn} onClick={handleDelete}>🗑️</button>
      </header>

      <div className={styles.dateLabel}>
        {formatDate(diary.date)}
        {diary.elements?.weather?.icon && (
          <span className={styles.weatherIcon}>{diary.elements.weather.icon}</span>
        )}
      </div>

      <div className={styles.cardWrap}>
        <img src={diary.image_url} alt="그림일기" className={styles.cardImg} />
      </div>

      <div className={styles.footer}>
        <button
          className={styles.shareBtn}
          onClick={() => shareOrDownload(diary.image_url, `아이담_그림일기_${diary.date}.png`)}
        >
          📤 공유하기
        </button>
        <button className={styles.newBtn} onClick={() => navigate('/diary')}>
          ✏️ 새 일기
        </button>
      </div>
    </div>
  )
}
