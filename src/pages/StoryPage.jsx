import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import html2canvas from 'html2canvas'
import { supabase } from '../lib/supabase'
import styles from './StoryPage.module.css'

async function downloadBlob(blob, filename) {
  const file = new File([blob], filename, { type: blob.type || 'image/png' })
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return
    } catch (e) {
      if (e.name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function StoryPage() {
  const navigate        = useNavigate()
  const { id }          = useParams()
  const { state }       = useLocation()
  const storyCardRef    = useRef(null) // imgWrap + card 감싸는 wrapper
  const [story, setStory]       = useState(null)
  const [showSave, setShowSave] = useState(false)
  const [checks, setChecks]     = useState({ drawing: true, card: true })
  const [saving, setSaving]     = useState(false)

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
      // 내 그림: navigate state의 원본 캔버스 → 없으면 story.image_url fallback
      if (checks.drawing) {
        const originalDataUrl = state?.originalDataUrl ?? story.image_url
        let blob
        if (originalDataUrl.startsWith('data:')) {
          const res = await fetch(originalDataUrl)
          blob = await res.blob()
        } else {
          const res = await fetch(originalDataUrl)
          blob = await res.blob()
        }
        await downloadBlob(blob, `아이담_내그림_${story.title}.jpg`)
      }

      // 동화 카드: AI 변환 이미지 + 카드 텍스트 합쳐서 캡처
      if (checks.card) {
        const canvas = await html2canvas(storyCardRef.current, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#F5F6FA',
          logging: false,
        })
        await new Promise((resolve) => canvas.toBlob(async (blob) => {
          await downloadBlob(blob, `아이담_동화카드_${story.title}.png`)
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
      {/* 캡처 대상: AI 이미지 + 카드 텍스트 */}
      <div ref={storyCardRef} className={styles.captureArea}>
        <div className={styles.imgWrap}>
          <img
            src={story.image_url}
            alt="AI 변환 그림"
            className={styles.img}
            crossOrigin="anonymous"
          />
        </div>
        <div className={styles.card}>
          <div className={styles.emotionBadge}>{emoji} {story.emotion}</div>
          <h1 className={styles.title}>{story.title}</h1>
          <p className={styles.storyText}>{story.story}</p>
          <div className={styles.keywords}>
            {(story.keywords ?? []).map((k) => (
              <span key={k} className={styles.tag}># {k}</span>
            ))}
          </div>
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
              <span className={styles.checkIcon}>✏️</span>
              <div className={styles.checkText}>
                <span className={styles.checkLabel}>내 그림</span>
                <span className={styles.checkDesc}>내가 직접 그린 원본 그림</span>
              </div>
              {checks.drawing && <span className={styles.checkMark}>✓</span>}
            </label>

            <label className={`${styles.checkRow} ${checks.card ? styles.checkRowOn : ''}`}>
              <input type="checkbox" checked={checks.card} onChange={() => toggle('card')} />
              <span className={styles.checkIcon}>📖</span>
              <div className={styles.checkText}>
                <span className={styles.checkLabel}>동화 카드</span>
                <span className={styles.checkDesc}>AI 변환 그림 + 동화 내용</span>
              </div>
              {checks.card && <span className={styles.checkMark}>✓</span>}
            </label>

            <div className={styles.saveActions}>
              <button className={styles.cancelBtn} onClick={() => setShowSave(false)} disabled={saving}>취소</button>
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
