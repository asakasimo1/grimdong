import { useState, useEffect } from 'react'
import * as Sentry from '@sentry/react'
import toast from 'react-hot-toast'
import { useTransformStore } from '../store/useTransformStore'
import styles from '../pages/DrawPage.module.css'

const TRANSFORM_STYLES = [
  {
    key: '지브리', label: '🏯 지브리 스타일',
    prompt: 'Studio Ghibli anime illustration style, soft warm colors, painterly backgrounds, Hayao Miyazaki aesthetic, child-friendly, beautiful,',
  },
  {
    key: '풍경화', label: '🏞️ 풍경화',
    prompt: 'beautiful impressionist landscape painting style, scenic nature, lush greenery, blue sky, vibrant natural colors, fine art quality,',
  },
  {
    key: '스케치', label: '✏️ 스케치',
    prompt: 'elegant pencil sketch illustration, fine line drawing, soft shading, professional art quality, detailed,',
  },
  {
    key: '화보', label: '✨ 화보 스타일',
    prompt: 'professional magazine cover quality, beautiful portrait, smooth glowing skin, bright expressive eyes, elegant editorial photography style,',
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

      // Step 1: Gemini로 그림/사진 묘사
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [
              { text: 'Describe this image in detail for AI image generation. Include all subjects, characters, colors, and scene composition. Reply in English only, under 80 words.' },
              { inline_data: { mime_type: mimeType, data: b64 } },
            ]}],
            generationConfig: { maxOutputTokens: 150, temperature: 0.3 },
          }),
        }
      )
      const geminiData = await geminiRes.json()
      if (!geminiRes.ok) throw new Error(geminiData.error?.message ?? `Gemini HTTP ${geminiRes.status}`)
      const description = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
        ?? "a colorful children's drawing with simple shapes"

      // Step 2: Pollinations.ai로 스타일 변환 이미지 생성 (무료)
      const fullPrompt = `${styleObj.prompt} ${description}. Child-friendly, safe for kids, vibrant, high quality.`
      const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=1024&height=1024&seed=${Date.now()}&nologo=true&enhance=true`

      // 이미지 로드 확인
      await new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = resolve
        img.onerror = () => reject(new Error('이미지 생성 실패'))
        img.src = imgUrl
      })
      setTransformedImg(imgUrl)

    } catch (err) {
      console.error('[변환 에러]', err)
      Sentry.captureException(err, { extra: { context: 'AI 변환', mode, style } })
      toast.error('변환에 실패했어요. 다시 시도해주세요! 🔄', { duration: 4000 })
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
