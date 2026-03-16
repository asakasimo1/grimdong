import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import html2canvas from 'html2canvas'
import toast from 'react-hot-toast'
import * as Sentry from '@sentry/react'
import { useAuthStore } from '../store/authStore'
import { useDiaryStore } from '../store/useDiaryStore'
import { supabase } from '../lib/supabase'
import styles from './DiaryResultPage.module.css'

async function shareOrDownload(blob, filename) {
  const file = new File([blob], filename, { type: blob.type || 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return } catch (e) {
      if (e.name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function DiaryResultPage() {
  const navigate  = useNavigate()
  const { user }  = useAuthStore()
  const { diaryText, diaryDate, analyzedElements, generatedImage, reset } = useDiaryStore()

  const cardRef   = useRef(null)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  useEffect(() => {
    if (!generatedImage) navigate('/diary', { replace: true })
  }, [generatedImage, navigate])

  if (!generatedImage) return null

  // html2canvas로 카드 캡처 → Blob 반환
  const captureCard = async () => {
    const canvas = await html2canvas(cardRef.current, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#FFFDF7',
      logging: false,
    })
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'))
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      const blob     = await captureCard()
      const filename = `diary_${user.id}_${Date.now()}.png`

      // Supabase Storage 업로드
      const { error: upErr } = await supabase.storage
        .from('drawings')
        .upload(filename, blob, { contentType: 'image/png', upsert: false })
      if (upErr) throw upErr

      const { data: { publicUrl } } = supabase.storage.from('drawings').getPublicUrl(filename)

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
    try {
      const blob = await captureCard()
      await shareOrDownload(blob, `아이담_그림일기_${diaryDate}.png`)
    } catch (err) {
      if (err.name !== 'AbortError') toast.error('공유에 실패했어요.')
    }
  }

  const handleNew = () => { reset(); navigate('/diary') }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/select')}>← 홈</button>
        <h1 className={styles.title}>📔 나의 그림일기</h1>
        <div />
      </header>

      {/* 캡처 대상 — 그림일기 카드 */}
      <div className={styles.scrollArea}>
        <div ref={cardRef} className={styles.diaryCard}>
          {/* 카드 헤더 */}
          <div className={styles.cardHeader}>
            <span className={styles.cardDate}>{diaryDate}</span>
            <span className={styles.cardDeco}>✦</span>
          </div>

          {/* 삽화 */}
          <div className={styles.illustWrap}>
            <img src={generatedImage} alt="AI 그림일기 삽화" className={styles.illust} />
          </div>

          {/* 일기 텍스트 — 줄 노트 스타일 */}
          <div className={styles.textArea}>
            <p className={styles.diaryText}>{diaryText}</p>
          </div>

          {/* 카드 푸터 */}
          <div className={styles.cardFooter}>
            <span className={styles.footerBrand}>아이담 ✦</span>
          </div>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className={styles.footer}>
        <button className={styles.shareBtn} onClick={handleShare}>📤 공유</button>
        <button
          className={styles.saveBtn}
          onClick={handleSave}
          disabled={saving || saved}
        >
          {saved ? '✅ 저장 완료' : saving ? '저장 중...' : '💾 저장하기'}
        </button>
        <button className={styles.newBtn} onClick={handleNew}>✏️ 새 일기</button>
      </div>
    </div>
  )
}
