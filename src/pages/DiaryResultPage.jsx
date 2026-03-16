import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import * as Sentry from '@sentry/react'
import { useAuthStore } from '../store/authStore'
import { useDiaryStore } from '../store/useDiaryStore'
import { supabase } from '../lib/supabase'
import styles from './DiaryResultPage.module.css'

export default function DiaryResultPage() {
  const navigate = useNavigate()
  const { user }  = useAuthStore()
  const { diaryText, diaryDate, analyzedElements, generatedImage, reset } = useDiaryStore()

  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  // 이미지 없으면 입력 페이지로
  useEffect(() => {
    if (!generatedImage) navigate('/diary', { replace: true })
  }, [generatedImage, navigate])

  const handleSave = async () => {
    if (!user || !generatedImage) return
    setSaving(true)
    try {
      // base64 → Blob
      const res      = await fetch(generatedImage)
      const blob     = await res.blob()
      const filename = `diary_${user.id}_${Date.now()}.jpg`

      // Supabase Storage 업로드 (drawings 버킷 재활용)
      const { error: upErr } = await supabase.storage
        .from('drawings')
        .upload(filename, blob, { contentType: 'image/jpeg', upsert: false })
      if (upErr) throw upErr

      const { data: { publicUrl } } = supabase.storage
        .from('drawings')
        .getPublicUrl(filename)

      // diaries 테이블 저장
      const { error: dbErr } = await supabase.from('diaries').insert({
        user_id:    user.id,
        date:       new Date().toISOString().split('T')[0],
        diary_text: diaryText,
        image_url:  publicUrl,
        elements:   analyzedElements ?? {},
      })
      if (dbErr) throw dbErr

      setSaved(true)
      toast.success('그림일기가 저장됐어요! 🎉')
    } catch (err) {
      console.error('[저장 에러]', err)
      Sentry.captureException(err)
      toast.error('저장에 실패했어요. 다시 시도해주세요! 🔄')
    } finally {
      setSaving(false)
    }
  }

  const handleShare = async () => {
    if (!generatedImage) return
    try {
      // 이미지 + 텍스트 공유 (Web Share API)
      const res  = await fetch(generatedImage)
      const blob = await res.blob()
      const file = new File([blob], 'diary.jpg', { type: 'image/jpeg' })

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: diaryDate, text: diaryText })
      } else {
        // fallback: 다운로드
        const a = document.createElement('a')
        a.href = generatedImage
        a.download = 'diary.jpg'
        a.click()
        toast.success('이미지가 다운로드됐어요!')
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        toast.error('공유에 실패했어요.')
      }
    }
  }

  const handleNew = () => {
    reset()
    navigate('/diary')
  }

  if (!generatedImage) return null

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/select')}>← 홈</button>
        <h1 className={styles.title}>📔 나의 그림일기</h1>
        <div />
      </header>

      <div className={styles.body}>
        {/* 날짜 */}
        <div className={styles.dateBox}>{diaryDate}</div>

        {/* 생성된 이미지 */}
        <div className={styles.imageWrap}>
          <img src={generatedImage} alt="AI 생성 삽화" className={styles.diaryImage} />
        </div>

        {/* 일기 텍스트 */}
        <div className={styles.textBox}>
          <p className={styles.diaryText}>{diaryText}</p>
        </div>

        {/* 태그 */}
        {analyzedElements?.persons?.length > 0 && (
          <div className={styles.tagRow}>
            {analyzedElements.persons.map((p) => (
              <span key={p} className={styles.tag}>👤 {p}</span>
            ))}
            {analyzedElements.places?.map((pl) => (
              <span key={pl} className={styles.tag}>📍 {pl}</span>
            ))}
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <button className={styles.shareBtn} onClick={handleShare}>
          📤 공유
        </button>
        <button
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={saving || saved}
        >
          {saved ? '✅ 저장 완료' : saving ? '저장 중...' : '💾 저장하기'}
        </button>
        <button className={styles.newBtn} onClick={handleNew}>
          ✏️ 새 일기
        </button>
      </div>
    </div>
  )
}
