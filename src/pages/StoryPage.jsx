import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import html2canvas from 'html2canvas'
import { supabase } from '../lib/supabase'
import styles from './StoryPage.module.css'

async function downloadBlob(blob, filename) {
  const file = new File([blob], filename, { type: blob.type || 'image/png' })
  // 모바일: Web Share API로 갤러리 저장 유도
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return
    } catch (e) {
      if (e.name === 'AbortError') return // 사용자가 취소
    }
  }
  // PC / 폴백: 파일 다운로드
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function StoryPage() {
  const navigate  = useNavigate()
  const { id }    = useParams()
  const cardRef   = useRef(null)
  const [story, setStory]         = useState(null)
  const [showSave, setShowSave]   = useState(false)
  const [checks, setChecks]       = useState({ drawing: true, card: true })
  const [saving, setSaving]       = useState(false)

  useEffect(() => {
    supabase.from('stories').select('*').eq('id', id).single()
      .then(({ data, error }) => {
        if (error || !data) return navigate('/home')
        setStory(data)
      })
  }, [id, navigate])

  if (!story) return null

  const emotionEmoji = {
    행복:'😊', 설렘:'💫', 신기함:'✨', 즐거움:'🎉',
    따뜻함:'🌸', 뿌듯함:'🌟', 신남:'🎈',
  }
  const emoji = emotionEmoji[story.emotion] ?? '💛'

  const toggle = (key) => setChecks((prev) => ({ ...prev, [key]: !prev[key] }))

  const handleSave = async () => {
    if (!checks.drawing && !checks.card) return
    setSaving(true)
    try {
      if (checks.drawing) {
        const res = await fetch(story.image_url)
        const blob = await res.blob()
        await downloadBlob(blob, `아이담_그림_${story.title}.png`)
      }
      if (checks.card) {
        const canvas = await html2canvas(cardRef.current, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
        })
        await new Promise((resolve) => canvas.toBlob(async (blob) => {
          await downloadBlob(blob, `아이담_동화_${story.title}.png`)
          resolve()
        }, 'image/png'))
      }
      setShowSave(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.wrap}>
      {/* 그림 */}
      <div className={styles.imgWrap}>
        <img src={story.image_url} alt="내 그림" className={styles.img} />
      </div>

      {/* 동화 카드 */}
      <div className={styles.card} ref={cardRef}>
        <div className={styles.emotionBadge}>{emoji} {story.emotion}</div>
        <h1 className={styles.title}>{story.title}</h1>
        <p className={styles.storyText}>{story.story}</p>
        <div className={styles.keywords}>
          {(story.keywords ?? []).map((k) => (
            <span key={k} className={styles.tag}># {k}</span>
          ))}
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className={styles.actions}>
        <button className={styles.homeBtn} onClick={() => navigate('/home')}>홈으로</button>
        <button className={styles.saveBtn} onClick={() => setShowSave(true)}>💾 저장</button>
        <button className={styles.drawAgainBtn} onClick={() => navigate('/draw')}>다시 그리기 🎨</button>
      </div>

      {/* 저장 팝업 */}
      {showSave && (
        <div className={styles.backdrop} onClick={() => !saving && setShowSave(false)}>
          <div className={styles.saveModal} onClick={(e) => e.stopPropagation()}>
            <p className={styles.saveTitle}>저장할 항목을 선택하세요</p>

            <label className={`${styles.checkRow} ${checks.drawing ? styles.checkRowOn : ''}`}>
              <input type="checkbox" checked={checks.drawing} onChange={() => toggle('drawing')} />
              <span className={styles.checkIcon}>🖼️</span>
              <span className={styles.checkLabel}>내 그림</span>
              {checks.drawing && <span className={styles.checkMark}>✓</span>}
            </label>

            <label className={`${styles.checkRow} ${checks.card ? styles.checkRowOn : ''}`}>
              <input type="checkbox" checked={checks.card} onChange={() => toggle('card')} />
              <span className={styles.checkIcon}>📖</span>
              <span className={styles.checkLabel}>동화 카드</span>
              {checks.card && <span className={styles.checkMark}>✓</span>}
            </label>

            <div className={styles.saveActions}>
              <button className={styles.cancelBtn} onClick={() => setShowSave(false)} disabled={saving}>
                취소
              </button>
              <button
                className={styles.confirmBtn}
                onClick={handleSave}
                disabled={saving || (!checks.drawing && !checks.card)}
              >
                {saving ? '저장 중...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
