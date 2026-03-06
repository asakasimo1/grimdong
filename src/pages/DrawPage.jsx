import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Canvas, PencilBrush, CircleBrush, SprayBrush, FabricImage, FabricText } from 'fabric'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import styles from './DrawPage.module.css'

const COLORS   = ['#E74C3C','#E67E22','#F1C40F','#27AE60','#2980B9','#8E44AD','#1A1A2E','#FFFFFF']
const SIZES    = [4, 8, 14, 22]
const STICKERS = ['⭐','❤️','🌈','🦋','🌸','🎈','🌟','☀️','🌙','🎵']

const TOOLS = [
  { key: 'pencil',  label: '🖊️ 연필' },
  { key: 'circle',  label: '🔵 원형붓' },
  { key: 'spray',   label: '💨 스프레이' },
  { key: 'sticker', label: '⭐ 스티커' },
]

const STORY_MESSAGES = [
  { icon: '🖍️', text: '그림을 살펴보고 있어요...' },
  { icon: '✨', text: '주인공을 떠올리는 중...' },
  { icon: '📖', text: '동화를 써내려가고 있어요...' },
  { icon: '🌈', text: '마법을 걸고 있어요...' },
  { icon: '🎉', text: '거의 다 됐어요!' },
]

const TRANSFORM_MESSAGES = [
  { icon: '🎨', text: 'AI가 그림을 보고 있어요...' },
  { icon: '✨', text: '마법 붓으로 칠하는 중...' },
  { icon: '🌟', text: '스타일을 입히고 있어요...' },
  { icon: '🎭', text: '거의 다 됐어요!' },
]

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

export default function DrawPage() {
  const navigate      = useNavigate()
  const canvasEl      = useRef(null)
  const fabricRef     = useRef(null)
  const videoRef      = useRef(null)
  const galleryRef    = useRef(null)
  const drawToolRef   = useRef('pencil')
  const stickerRef    = useRef('⭐')
  const historyRef    = useRef([])
  const historyIdxRef = useRef(-1)
  const user          = useAuthStore((s) => s.user)

  const [color, setColor]     = useState('#E74C3C')
  const [size, setSize]       = useState(8)
  const [isEraser, setIsEraser] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [mode, setMode]         = useState('draw')
  const [photoSelected, setPhotoSelected] = useState(false)
  const [showCamera, setShowCamera]       = useState(false)
  const [cameraStream, setCameraStream]   = useState(null)
  const [showTransform, setShowTransform]   = useState(false)
  const [transformStyle, setTransformStyle] = useState('지브리')
  const [transforming, setTransforming]     = useState(false)
  const [transformedImg, setTransformedImg] = useState(null)
  const [drawTool, setDrawTool]             = useState('pencil')
  const [selectedSticker, setSelectedSticker] = useState('⭐')
  const [canUndo, setCanUndo]               = useState(false)
  const [msgIdx, setMsgIdx]                 = useState(0)

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
    brush.color = '#E74C3C'
    brush.width = 8
    canvas.freeDrawingBrush = brush
    fabricRef.current = canvas

    // 초기 히스토리
    historyRef.current = [JSON.stringify(canvas.toObject())]
    historyIdxRef.current = 0

    // 드로잉 완료 → 히스토리 저장
    canvas.on('path:created', () => {
      const state = JSON.stringify(fabricRef.current.toObject())
      const arr = historyRef.current.slice(0, historyIdxRef.current + 1)
      arr.push(state)
      historyRef.current = arr
      historyIdxRef.current = arr.length - 1
      setCanUndo(true)
    })

    // 스티커 배치: 빈 영역 탭 → 이모지 추가
    canvas.on('mouse:up', (e) => {
      if (drawToolRef.current !== 'sticker') return
      if (e.target) return
      const pos = canvas.getScenePoint(e.e)
      const emoji = new FabricText(stickerRef.current, {
        left: pos.x, top: pos.y,
        fontSize: 52, originX: 'center', originY: 'center',
        selectable: true, hasControls: true,
      })
      canvas.add(emoji)
      canvas.setActiveObject(emoji)
      canvas.renderAll()
      const state = JSON.stringify(canvas.toObject())
      const arr = historyRef.current.slice(0, historyIdxRef.current + 1)
      arr.push(state)
      historyRef.current = arr
      historyIdxRef.current = arr.length - 1
      setCanUndo(true)
    })

    return () => { canvas.dispose(); fabricRef.current = null }
  }, [])

  // 브러시 설정 통합 (모드·툴·색상·굵기·지우개)
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return

    if (mode === 'photo' || drawTool === 'sticker') {
      canvas.isDrawingMode = false
      canvas.selection = false
      return
    }

    canvas.isDrawingMode = true
    canvas.selection = false
    const col = isEraser ? '#FFFFFF' : color
    const w   = isEraser ? size * 2.5 : size

    let brush
    if (drawTool === 'spray') {
      brush = new SprayBrush(canvas)
      brush.color   = col
      brush.width   = Math.max(w * 3, 24)
      brush.density = 25
    } else if (drawTool === 'circle') {
      brush = new CircleBrush(canvas)
      brush.color = col
      brush.width = w
    } else {
      brush = new PencilBrush(canvas)
      brush.color = col
      brush.width = w
    }
    canvas.freeDrawingBrush = brush
  }, [mode, drawTool, color, size, isEraser])

  // 로딩 메시지 순환
  useEffect(() => {
    if (!loading && !transforming) { setMsgIdx(0); return }
    const msgs = loading ? STORY_MESSAGES : TRANSFORM_MESSAGES
    const timer = setInterval(() => setMsgIdx((i) => (i + 1) % msgs.length), 2500)
    return () => clearInterval(timer)
  }, [loading, transforming])

  // ref 동기화 (canvas 이벤트 핸들러용)
  useEffect(() => { drawToolRef.current = drawTool }, [drawTool])
  useEffect(() => { stickerRef.current = selectedSticker }, [selectedSticker])

  // 카메라 스트림 연결
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

  const handleClear = () => {
    clearCanvas()
    setPhotoSelected(false)
    const state = JSON.stringify(fabricRef.current?.toObject() ?? {})
    historyRef.current = [state]
    historyIdxRef.current = 0
    setCanUndo(false)
  }

  const handleUndo = async () => {
    if (historyIdxRef.current <= 0) return
    historyIdxRef.current--
    const canvas = fabricRef.current
    await canvas.loadFromJSON(JSON.parse(historyRef.current[historyIdxRef.current]))
    canvas.backgroundColor = '#FFFFFF'
    canvas.getObjects().forEach((obj) => {
      if (obj.type === 'image') { obj.selectable = false; obj.evented = false }
    })
    canvas.renderAll()
    setCanUndo(historyIdxRef.current > 0)
    if (canvas.getObjects().length === 0) setPhotoSelected(false)
  }

  const handleModeSwitch = (newMode) => {
    if (newMode === mode) return
    clearCanvas(); setPhotoSelected(false); setIsEraser(false); setMode(newMode)
  }

  const handleDrawToolChange = (tool) => {
    setDrawTool(tool)
    if (tool !== 'sticker') setIsEraser(false)
  }

  // ── 이미지 → Fabric 캔버스 ────────────────────
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

  // ── 카메라 (WebRTC) ───────────────────────────
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
    closeCamera()
    loadPhotoToCanvas(c.toDataURL('image/jpeg', 0.9))
  }

  // ── 갤러리 ────────────────────────────────────
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
      const style = TRANSFORM_STYLES.find((s) => s.key === transformStyle)
      const authHeader = `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`

      if (mode === 'draw') {
        const pngDataUrl = canvas.toDataURL({ format: 'png' })
        const pngBlob = await fetch(pngDataUrl).then((r) => r.blob())
        const file = new File([pngBlob], 'drawing.png', { type: 'image/png' })
        const formData = new FormData()
        formData.append('image', file)
        formData.append('prompt', `${style.drawPrompt} Child-friendly, safe for kids, vibrant colors.`)
        formData.append('model', 'gpt-image-1')
        formData.append('n', '1')
        formData.append('size', '1024x1024')

        const editRes = await fetch('https://api.openai.com/v1/images/edits', {
          method: 'POST',
          headers: { 'Authorization': authHeader },
          body: formData,
        })
        const editData = await editRes.json()
        if (!editRes.ok) throw new Error(editData.error?.message ?? `HTTP ${editRes.status}`)
        const b64img = editData.data?.[0]?.b64_json
        const imgUrl = editData.data?.[0]?.url
        if (b64img) setTransformedImg(`data:image/png;base64,${b64img}`)
        else if (imgUrl) setTransformedImg(imgUrl)
        else throw new Error('이미지 없음')

      } else {
        const pngDataUrl = canvas.toDataURL({ format: 'png' })
        const pngBlob = await fetch(pngDataUrl).then((r) => r.blob())
        const file = new File([pngBlob], 'photo.png', { type: 'image/png' })
        const formData = new FormData()
        formData.append('image', file)
        formData.append('prompt', style.photoPrompt)
        formData.append('model', 'gpt-image-1')
        formData.append('n', '1')
        formData.append('size', '1024x1024')

        const editRes = await fetch('https://api.openai.com/v1/images/edits', {
          method: 'POST',
          headers: { 'Authorization': authHeader },
          body: formData,
        })
        const editData = await editRes.json()
        if (!editRes.ok) throw new Error(editData.error?.message ?? `HTTP ${editRes.status}`)
        const b64img = editData.data?.[0]?.b64_json
        const imgUrl = editData.data?.[0]?.url
        if (b64img) setTransformedImg(`data:image/png;base64,${b64img}`)
        else if (imgUrl) setTransformedImg(imgUrl)
        else throw new Error('이미지 없음')
      }
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
        <div className={styles.headerActions}>
          {mode === 'draw' && (
            <button className={styles.undoBtn} onClick={handleUndo} disabled={!canUndo} title="실행취소">↩️</button>
          )}
          <button className={styles.clearBtn} onClick={handleClear}>지우기</button>
        </div>
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

      {/* 사진 선택 UI */}
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

      {/* 캔버스 */}
      <div
        className={styles.canvasWrap}
        style={mode === 'photo' && !photoSelected ? { height: 0, overflow: 'hidden', marginBottom: 0 } : {}}
      >
        <canvas ref={canvasEl} />
      </div>

      {/* 사진 변경 버튼 */}
      {mode === 'photo' && photoSelected && (
        <div className={styles.photoButtons}>
          <button className={styles.changePhotoBtn} onClick={openCamera}>📷 다시 찍기</button>
          <label htmlFor="galleryFileInput" className={styles.changePhotoBtn}>🖼️ 다른 사진</label>
        </div>
      )}

      {/* 그리기 도구 */}
      {mode === 'draw' && (
        <>
          {/* 툴 선택 */}
          <div className={styles.toolTabs}>
            {TOOLS.map((t) => (
              <button key={t.key}
                className={`${styles.toolTab} ${drawTool === t.key ? styles.toolTabActive : ''}`}
                onClick={() => handleDrawToolChange(t.key)}>{t.label}</button>
            ))}
          </div>

          {/* 스티커 선택 */}
          {drawTool === 'sticker' && (
            <div className={styles.stickerRow}>
              {STICKERS.map((s) => (
                <button key={s}
                  className={`${styles.stickerBtn} ${selectedSticker === s ? styles.stickerBtnActive : ''}`}
                  onClick={() => setSelectedSticker(s)}>{s}</button>
              ))}
            </div>
          )}

          {/* 색상 팔레트 */}
          {drawTool !== 'sticker' && (
            <div className={styles.palette}>
              {COLORS.map((c) => (
                <button key={c} className={`${styles.colorDot} ${!isEraser && color === c ? styles.active : ''}`}
                  style={{ background: c, border: c === '#FFFFFF' ? '2px solid #ddd' : 'none' }}
                  onClick={() => { setColor(c); setIsEraser(false) }} />
              ))}
              <button className={`${styles.eraserBtn} ${isEraser ? styles.active : ''}`}
                onClick={() => setIsEraser((v) => !v)} title="지우개">⬜</button>
            </div>
          )}

          {/* 굵기 */}
          {drawTool !== 'sticker' && (
            <div className={styles.sizes}>
              {SIZES.map((s) => (
                <button key={s} className={`${styles.sizeBtn} ${size === s ? styles.active : ''}`} onClick={() => setSize(s)}>
                  <span style={{ width: s, height: s, borderRadius: '50%', background: '#1A1A2E', display: 'inline-block' }} />
                </button>
              ))}
            </div>
          )}
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

      {/* 카메라 모달 */}
      {showCamera && (
        <div className={styles.cameraModal}>
          <video ref={videoRef} autoPlay playsInline muted className={styles.cameraVideo} />
          <div className={styles.cameraActions}>
            <button className={styles.cameraCancelBtn} onClick={closeCamera}>취소</button>
            <button className={styles.cameraShutterBtn} onClick={capturePhoto}>📷</button>
          </div>
        </div>
      )}

      {/* 로딩 오버레이 */}
      {(loading || transforming) && (() => {
        const msgs = loading ? STORY_MESSAGES : TRANSFORM_MESSAGES
        const cur = msgs[msgIdx]
        return (
          <div className={styles.loadingOverlay}>
            <div className={styles.loadingCard}>
              <div className={styles.loadingIconWrap}>
                <span key={msgIdx} className={styles.loadingIcon}>{cur.icon}</span>
              </div>
              <div className={styles.loadingDots}>
                <span /><span /><span />
              </div>
              <p key={`txt-${msgIdx}`} className={styles.loadingText}>{cur.text}</p>
            </div>
          </div>
        )
      })()}

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
                    <button key={s.key}
                      className={`${styles.styleBtn} ${transformStyle === s.key ? styles.styleBtnActive : ''}`}
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
