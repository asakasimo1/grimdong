import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Canvas, PencilBrush, FabricImage } from 'fabric'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import styles from './DrawPage.module.css'

const COLORS = ['#E74C3C','#E67E22','#F1C40F','#27AE60','#2980B9','#8E44AD','#1A1A2E','#FFFFFF']
const SIZES  = [4, 8, 14, 22]

const TRANSFORM_STYLES = [
  { key: '동화', label: '📖 동화책', prompt: 'fairy tale book illustration style, soft magical colors, child-friendly,' },
  { key: '만화', label: '🎨 귀여운 만화', prompt: 'cute cartoon illustration style, bright cheerful colors, suitable for children,' },
  { key: '수채화', label: '🖌️ 수채화', prompt: 'delicate watercolor painting style, soft flowing colors,' },
  { key: '실사', label: '📸 실사 사진', prompt: 'realistic photograph style, colorful and child-friendly,' },
]

export default function DrawPage() {
  const navigate      = useNavigate()
  const canvasEl      = useRef(null)
  const fabricRef     = useRef(null)
  const videoRef      = useRef(null)
  const galleryRef    = useRef(null)
  const user          = useAuthStore((s) => s.user)

  const [color, setColor]   = useState('#E74C3C')
  const [size, setSize]     = useState(8)
  const [isEraser, setIsEraser] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [mode, setMode]         = useState('draw')
  const [photoSelected, setPhotoSelected] = useState(false)
  const [showCamera, setShowCamera]       = useState(false)
  const [cameraStream, setCameraStream]   = useState(null)
  const [showTransform, setShowTransform]   = useState(false)
  const [transformStyle, setTransformStyle] = useState('동화')
  const [transforming, setTransforming]     = useState(false)
  const [transformedImg, setTransformedImg] = useState(null)

  // Fabric.js 초기화
  useEffect(() => {
    if (fabricRef.current) return
    const canvas = new Canvas(canvasEl.current, {
      isDrawingMode: true,
      backgroundColor: '#FFFFFF',
      width:  Math.min(window.innerWidth - 40, 480),
      height: Math.min(window.innerWidth - 40, 480),
    })
    const brush = new PencilBrush(canvas)
    brush.color = color
    brush.width = size
    canvas.freeDrawingBrush = brush
    fabricRef.current = canvas
    return () => { canvas.dispose(); fabricRef.current = null }
  }, [])

  // 색상·굵기 반영
  useEffect(() => {
    const c = fabricRef.current
    if (!c) return
    c.freeDrawingBrush.color = isEraser ? '#FFFFFF' : color
    c.freeDrawingBrush.width = isEraser ? size * 2.5 : size
  }, [color, size, isEraser])

  // 카메라 스트림 video 연결
  useEffect(() => {
    if (showCamera && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream
    }
  }, [showCamera, cameraStream])

  // ── 캔버스 공통 ──────────────────────────────
  const clearCanvas = () => {
    const c = fabricRef.current
    if (!c) return
    c.clear(); c.backgroundColor = '#FFFFFF'; c.renderAll()
  }

  const handleClear = () => { clearCanvas(); setPhotoSelected(false) }

  const handleModeSwitch = (newMode) => {
    if (newMode === mode) return
    clearCanvas(); setPhotoSelected(false); setIsEraser(false); setMode(newMode)
    if (fabricRef.current) fabricRef.current.isDrawingMode = newMode === 'draw'
  }

  // 이미지 → Fabric 캔버스 로드 (카메라·갤러리 공용)
  const loadPhotoToCanvas = async (dataUrl) => {
    const canvas = fabricRef.current
    clearCanvas()
    try {
      const img = await FabricImage.fromURL(dataUrl)
      const scale = Math.min(canvas.getWidth() / img.width, canvas.getHeight() / img.height)
      img.set({ scaleX: scale, scaleY: scale, selectable: false, evented: false })
      canvas.add(img); canvas.centerObject(img); canvas.renderAll()
      setPhotoSelected(true)
    } catch {
      toast.error('사진을 불러오지 못했어요.')
    }
  }

  // ── 카메라 (WebRTC — 페이지 이탈 없음) ──────
  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      setCameraStream(stream)
      setShowCamera(true)
    } catch {
      toast.error('카메라 권한을 허용해주세요.')
    }
  }

  const closeCamera = () => {
    cameraStream?.getTracks().forEach((t) => t.stop())
    setCameraStream(null); setShowCamera(false)
  }

  const capturePhoto = () => {
    const video = videoRef.current
    const c = document.createElement('canvas')
    c.width = video.videoWidth; c.height = video.videoHeight
    c.getContext('2d').drawImage(video, 0, 0)
    const dataUrl = c.toDataURL('image/jpeg', 0.9)
    closeCamera()
    loadPhotoToCanvas(dataUrl)
  }

  // ── 갤러리 (file input) ───────────────────────
  const handleGallerySelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => loadPhotoToCanvas(ev.target.result)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // ── AI 변환 ──────────────────────────────────
  const handleTransform = async () => {
    const canvas = fabricRef.current
    if (mode === 'draw' && (!canvas || canvas.getObjects().length === 0)) {
      toast.error('그림을 먼저 그려주세요! 🖍️'); return
    }
    if (mode === 'photo' && !photoSelected) {
      toast.error('사진을 먼저 선택해주세요! 📷'); return
    }
    setTransforming(true)
    try {
      const dataUrl = canvas.toDataURL({ format: 'jpeg', quality: 0.9 })
      const b64 = dataUrl.split(',')[1]
      const style = TRANSFORM_STYLES.find((s) => s.key === transformStyle)
      const openaiHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
      }

      const visionRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', headers: openaiHeaders,
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: [
            { type: 'text', text: 'Describe this drawing in detail for image generation. Include all subjects, colors, composition, and characters. Be specific. Reply in English only, within 100 words.' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}`, detail: 'low' } },
          ]}],
          max_tokens: 200,
        }),
      })
      const visionData = await visionRes.json()
      const description = visionData.choices?.[0]?.message?.content ?? ''
      if (!description) throw new Error('그림 묘사 실패')

      const dalleRes = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST', headers: openaiHeaders,
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: `${style.prompt} ${description}. Child-friendly, safe for kids.`,
          size: '1024x1024', quality: 'standard', n: 1, response_format: 'b64_json',
        }),
      })
      const dalleData = await dalleRes.json()
      if (!dalleRes.ok) throw new Error(dalleData.error?.message ?? `HTTP ${dalleRes.status}`)
      const b64img = dalleData.data?.[0]?.b64_json
      if (!b64img) throw new Error('이미지 생성 실패')
      setTransformedImg(`data:image/png;base64,${b64img}`)
    } catch (err) {
      console.error('[변환 에러]', err)
      toast.error(`변환 실패: ${err.message}`)
    } finally {
      setTransforming(false)
    }
  }

  const handleUseTransformed = async () => {
    const img = transformedImg
    setShowTransform(false); setTransformedImg(null)
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
    handleGenerate(compressed)
  }

  // ── 동화 생성 ─────────────────────────────────
  const handleGenerate = async (overrideDataUrl = null) => {
    const canvas = fabricRef.current
    if (!overrideDataUrl) {
      if (mode === 'draw' && (!canvas || canvas.getObjects().length === 0)) {
        toast.error('그림을 먼저 그려주세요! 🖍️'); return
      }
      if (mode === 'photo' && !photoSelected) {
        toast.error('사진을 먼저 선택해주세요! 📷'); return
      }
    }
    setLoading(true)
    try {
      const dataUrl = overrideDataUrl ?? canvas.toDataURL({ format: 'jpeg', quality: 0.85 })
      const b64 = dataUrl.split(',')[1]

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: 'gpt-4o',
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: `당신은 어린이 그림책 작가 겸 편집자입니다.
아이가 그린 그림을 보고, 따뜻하고 생동감 있는 동화를 JSON으로 반환하세요.

【JSON 형식 — 코드블록 없이 순수 JSON】
{"title":"동화 제목(8자 이내)","story":"동화 본문","emotion":"주요 감정 1단어","keywords":["요소1","요소2","요소3"],"char_count":글자수}

【story 규칙】
① 180~230자 (공백 포함) ② 문장 15자 이내 ③ 초등1~2학년 수준
④ "~했어요"체 ⑤ 의성어·의태어 1~2개 ⑥ 대화문 1개 ⑦ 마법 같은 행복한 결말
⑧ 폭력·공포·슬픔 금지` },
            { role: 'user', content: [
              { type: 'text', text: '이 그림을 보고 동화를 만들어주세요. 주인공: 친구, 오늘의 주제: 오늘의 이야기' },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}`, detail: 'low' } },
            ]},
          ],
          max_tokens: 600, temperature: 0.85,
        }),
      })
      const data = await res.json()
      const story = JSON.parse(data.choices?.[0]?.message?.content ?? '')

      const blob = await fetch(dataUrl).then((r) => r.blob())
      const fileName = `${user.id}/${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage.from('drawings').upload(fileName, blob, { contentType: 'image/jpeg' })
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from('drawings').getPublicUrl(fileName)

      const { data: saved, error: insertError } = await supabase.from('stories')
        .insert({ user_id: user.id, title: story.title, story: story.story, emotion: story.emotion, keywords: story.keywords, char_count: story.char_count, image_url: publicUrl })
        .select('id').single()
      if (insertError) throw insertError

      navigate(`/story/${saved.id}`)
    } catch (err) {
      console.error('[동화 생성 에러]', err)
      toast.error(`동화 생성 실패: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // ── 렌더 ─────────────────────────────────────
  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/home')}>← 홈</button>
        <h1 className={styles.title}>오늘의 그림</h1>
        <button className={styles.clearBtn} onClick={handleClear}>지우기</button>
      </header>

      {/* 모드 탭 */}
      <div className={styles.modeTabs}>
        <button className={`${styles.modeTab} ${mode === 'draw' ? styles.modeTabActive : ''}`} onClick={() => handleModeSwitch('draw')}>✏️ 직접 그리기</button>
        <button className={`${styles.modeTab} ${mode === 'photo' ? styles.modeTabActive : ''}`} onClick={() => handleModeSwitch('photo')}>📷 사진 불러오기</button>
      </div>

      {/* 갤러리 hidden input */}
      <input
        id="galleryFileInput"
        ref={galleryRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleGallerySelect}
      />

      {/* 사진 선택 UI — canvas 위가 아닌 별도 영역 (Fabric.js upper-canvas 간섭 방지) */}
      {mode === 'photo' && !photoSelected && (
        <div className={styles.photoPickerArea}>
          <span className={styles.photoIcon}>📸</span>
          <p className={styles.photoPickerText}>사진을 선택해주세요</p>
          <div className={styles.overlayButtons}>
            <button className={styles.overlayBtn} onClick={openCamera}>📷 카메라</button>
            <label htmlFor="galleryFileInput" className={styles.overlayBtn}>🖼️ 갤러리</label>
          </div>
        </div>
      )}

      {/* 캔버스 — 항상 DOM에 유지, 사진 미선택 시 높이 0으로 숨김 */}
      <div
        className={styles.canvasWrap}
        style={mode === 'photo' && !photoSelected ? { height: 0, overflow: 'hidden', marginBottom: 0 } : {}}
      >
        <canvas ref={canvasEl} />
      </div>

      {/* 사진 선택 완료 후 변경 버튼 */}
      {mode === 'photo' && photoSelected && (
        <div className={styles.photoButtons}>
          <button className={styles.changePhotoBtn} onClick={openCamera}>📷 다시 찍기</button>
          <label htmlFor="galleryFileInput" className={styles.changePhotoBtn}>🖼️ 다른 사진</label>
        </div>
      )}

      {/* 그리기 모드 도구 */}
      {mode === 'draw' && (
        <>
          <div className={styles.palette}>
            {COLORS.map((c) => (
              <button key={c} className={`${styles.colorDot} ${!isEraser && color === c ? styles.active : ''}`}
                style={{ background: c, border: c === '#FFFFFF' ? '2px solid #ddd' : 'none' }}
                onClick={() => { setColor(c); setIsEraser(false) }} />
            ))}
            <button className={`${styles.eraserBtn} ${isEraser ? styles.active : ''}`} onClick={() => setIsEraser((v) => !v)} title="지우개">⬜</button>
          </div>
          <div className={styles.sizes}>
            {SIZES.map((s) => (
              <button key={s} className={`${styles.sizeBtn} ${size === s ? styles.active : ''}`} onClick={() => setSize(s)}>
                <span style={{ width: s, height: s, borderRadius: '50%', background: '#1A1A2E', display: 'inline-block' }} />
              </button>
            ))}
          </div>
        </>
      )}

      {/* AI 변환 */}
      <button className={styles.transformBtn} onClick={() => setShowTransform(true)} disabled={loading}>
        ✨ AI로 그림 변환하기
      </button>

      {/* 동화 만들기 */}
      <button className={styles.genBtn} onClick={() => handleGenerate()} disabled={loading}>
        {loading ? '동화 만드는 중... ✨' : '🪄 동화로 만들기!'}
      </button>

      {/* 카메라 모달 (WebRTC) */}
      {showCamera && (
        <div className={styles.cameraModal}>
          <video ref={videoRef} autoPlay playsInline muted className={styles.cameraVideo} />
          <div className={styles.cameraActions}>
            <button className={styles.cameraCancelBtn} onClick={closeCamera}>취소</button>
            <button className={styles.cameraShutterBtn} onClick={capturePhoto}>📷</button>
          </div>
        </div>
      )}

      {/* AI 변환 모달 */}
      {showTransform && (
        <div className={styles.modalBackdrop} onClick={() => { setShowTransform(false); setTransformedImg(null) }}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeBtn} onClick={() => { setShowTransform(false); setTransformedImg(null) }}>✕</button>
            <h2 className={styles.modalTitle}>✨ AI 그림 변환</h2>
            {!transformedImg ? (
              <>
                <p className={styles.modalDesc}>어떤 스타일로 바꿔볼까요?</p>
                <div className={styles.styleGrid}>
                  {TRANSFORM_STYLES.map((s) => (
                    <button key={s.key} className={`${styles.styleBtn} ${transformStyle === s.key ? styles.styleBtnActive : ''}`}
                      onClick={() => setTransformStyle(s.key)}>{s.label}</button>
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
                  <button className={styles.useImgBtn} onClick={handleUseTransformed}>🪄 이걸로 동화 만들기</button>
                  <button className={styles.retryBtn} onClick={() => setTransformedImg(null)}>🔄 다시 변환</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
