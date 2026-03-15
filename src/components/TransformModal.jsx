import { useState, useEffect } from 'react'
import * as Sentry from '@sentry/react'
import toast from 'react-hot-toast'
import { useTransformStore } from '../store/useTransformStore'
import styles from '../pages/DrawPage.module.css'

const TRANSFORM_STYLES = [
  {
    key: '지브리', label: '🏯 지브리 스타일',
    drawPrompt: 'Studio Ghibli anime illustration style, soft warm colors, painterly backgrounds, Hayao Miyazaki aesthetic, child-friendly,',
    photoPrompt: 'Transform this photo into Studio Ghibli anime style. Maintain the exact composition and all subjects. Apply Ghibli characteristic soft warm colors, painterly look, and Miyazaki aesthetic.',
  },
  {
    key: '풍경화', label: '🏞️ 풍경화',
    drawPrompt: 'beautiful landscape painting style, scenic nature background, lush greenery, blue sky, vibrant natural colors, impressionist landscape art,',
    photoPrompt: 'Transform this photo into a beautiful landscape painting. Maintain the exact composition and all subjects. Enrich the background with scenic nature elements, lush colors, and impressionist landscape painting style.',
  },
  {
    key: '스케치', label: '✏️ 스케치',
    drawPrompt: 'elegant pencil sketch portrait style, beautiful and attractive faces, refined fine line drawing, soft shading, professional fashion illustration quality,',
    photoPrompt: 'Convert this photo into an elegant pencil sketch portrait. Keep the original composition and all subjects. Maintain the overall facial structure and identity of each person, but apply subtle natural enhancement — slightly smoother skin, softened blemishes, gently refined features — while still looking like the same real person. Apply fine pencil line art with soft natural shading, realistic portrait sketch style.',
  },
  {
    key: '화보', label: '✨ 화보 스타일',
    drawPrompt: 'beautiful idealized portrait, attractive features, smooth skin, bright expressive eyes, elegant professional look,',
    photoPrompt: 'Enhance this photo into a professional magazine cover quality portrait. Maintain the exact same composition and subjects. Apply idealized attractive features, smooth glowing skin, bright expressive eyes, and elegant editorial enhancement.',
  },
]

const TRANSFORM_MESSAGES = [
  { icon: '🎨', text: 'AI가 그림을 보고 있어요...' },
  { icon: '✨', text: '마법 붓으로 칠하는 중...' },
  { icon: '🌟', text: '스타일을 입히고 있어요...' },
  { icon: '🎭', text: '거의 다 됐어요!' },
]

export default function TransformModal() {
  const {
    isOpen, canvasDataUrl, mode, style, transforming, transformedImg, onUseTransformed,
    close, setStyle, setTransforming, setTransformedImg,
  } = useTransformStore()

  const [msgIdx, setMsgIdx] = useState(0)

  // 변환 중 페이지 이탈 차단
  useEffect(() => {
    if (!transforming) return
    const handler = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [transforming])

  // 로딩 메시지 순환
  useEffect(() => {
    if (!transforming) { setMsgIdx(0); return }
    const timer = setInterval(() => setMsgIdx((i) => (i + 1) % TRANSFORM_MESSAGES.length), 2500)
    return () => clearInterval(timer)
  }, [transforming])

  // 모달이 닫혀있으면 렌더링 없음 (hooks는 항상 위에서 실행)
  if (!isOpen) return null

  const handleTransform = async () => {
    setTransforming(true)
    try {
      const styleObj = TRANSFORM_STYLES.find((s) => s.key === style)
      const mimeType = canvasDataUrl.startsWith('data:image/png') ? 'image/png' : 'image/jpeg'
      const b64 = canvasDataUrl.split(',')[1]

      // Hugging Face FLUX.1-schnell로 스타일 변환 이미지 생성
      const prompt = mode === 'draw' ? styleObj.drawPrompt : styleObj.photoPrompt
      const fullPrompt = `${prompt} Child-friendly, safe for kids, vibrant colors, high quality illustration.`

      const hfRes = await fetch('/api/transform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt }),
      })
      if (!hfRes.ok) {
        const err = await hfRes.json().catch(() => ({}))
        throw new Error(`이미지 생성 실패 (HTTP ${hfRes.status}): ${err.error ?? ''}`)
      }
      const blob = await hfRes.blob()
      setTransformedImg(URL.createObjectURL(blob))

    } catch (err) {
      console.error('[변환 에러]', err)
      Sentry.captureException(err, { extra: { context: 'AI 변환', mode, style } })
      toast.error(
        '변환에 실패했어요. 다시 시도해주세요! 🔄',
        { duration: 4000 }
      )
    } finally {
      setTransforming(false)
    }
  }

  const handleUseTransformed = async () => {
    const img = transformedImg
    close()
    const compressed = await new Promise((resolve) => {
      const image = new Image()
      image.onload = () => {
        const c = document.createElement('canvas')
        c.width = 800; c.height = 800
        const ctx = c.getContext('2d')
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, 800, 800)
        const scale = Math.min(800 / image.width, 800 / image.height)
        ctx.drawImage(image, (800 - image.width * scale) / 2, (800 - image.height * scale) / 2, image.width * scale, image.height * scale)
        resolve(c.toDataURL('image/jpeg', 0.85))
      }
      image.src = img
    })
    onUseTransformed?.(compressed)
  }

  return (
    <>
      {/* 변환 중 로딩 오버레이 */}
      {transforming && (
        <div
          className={styles.loadingOverlay}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => { e.stopPropagation(); e.preventDefault() }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.loadingCard}>
            <div className={styles.loadingIconWrap}>
              <span key={msgIdx} className={styles.loadingIcon}>{TRANSFORM_MESSAGES[msgIdx].icon}</span>
            </div>
            <div className={styles.loadingDots}><span /><span /><span /></div>
            <p key={`txt-${msgIdx}`} className={styles.loadingText}>{TRANSFORM_MESSAGES[msgIdx].text}</p>
          </div>
        </div>
      )}

      {/* AI 변환 모달 */}
      <div className={styles.modalBackdrop}>
        <div className={styles.modal}>
          <button className={styles.closeBtn} disabled={transforming} onClick={close}>✕</button>
          <h2 className={styles.modalTitle}>✨ AI 그림 변환</h2>
          {!transformedImg ? (
            <>
              <p className={styles.modalDesc}>어떤 스타일로 바꿔볼까요?</p>
              <div className={styles.styleGrid}>
                {TRANSFORM_STYLES.map((s) => (
                  <button key={s.key}
                    className={`${styles.styleBtn} ${style === s.key ? styles.styleBtnActive : ''}`}
                    onClick={() => setStyle(s.key)}>{s.label}</button>
                ))}
              </div>
              <button className={styles.doTransformBtn} onClick={handleTransform} disabled={transforming}>
                {transforming ? '변환 중... ✨' : '변환하기!'}
              </button>
            </>
          ) : (
            <>
              <img src={transformedImg} alt="변환된 그림" className={styles.transformedImg} />
              <div className={styles.modalActions}>
                <button className={styles.useImgBtn} onClick={handleUseTransformed}>📔 이걸로 그림일기 만들기</button>
                <button className={styles.retryBtn} onClick={() => setTransformedImg(null)}>🔄 다시 변환</button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
