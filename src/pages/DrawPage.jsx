import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Canvas, PencilBrush, CircleBrush, SprayBrush, FabricImage, FabricText } from 'fabric'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import * as Sentry from '@sentry/react'
import { useAuthStore } from '../store/authStore'
import { useTransformStore } from '../store/useTransformStore'
import styles from './DrawPage.module.css'

const COLORS   = ['#E74C3C','#E67E22','#F1C40F','#27AE60','#2980B9','#8E44AD','#1A1A2E','#FFFFFF']
const SIZES    = [4, 8, 14, 22]
const STICKERS = ['⭐','❤️','🌈','🦋','🌸','🎈','🌟','☀️','🌙','🎵']
const MAX_HISTORY = 20
const MAX_OBJECTS = 150

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
  const openTransform = useTransformStore((s) => s.open)
  const [canvasSize]  = useState(() => Math.min(window.innerWidth - 40, 480))

  const [color, setColor]       = useState('#E74C3C')
  const [size, setSize]         = useState(8)
  const [isEraser, setIsEraser] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [mode, setMode]         = useState('draw')
  const [photoSelected, setPhotoSelected]   = useState(false)
  const [showCamera, setShowCamera]         = useState(false)
  const [cameraStream, setCameraStream]     = useState(null)
  const [drawTool, setDrawTool]             = useState('pencil')
  const [selectedSticker, setSelectedSticker] = useState('⭐')
  const [canUndo, setCanUndo]               = useState(false)
  const [msgIdx, setMsgIdx]                 = useState(0)

  // 동화 생성 중 페이지 이탈 차단
  useEffect(() => {
    if (!loading) return
    const handler = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [loading])

  // Fabric.js 초기화
  useEffect(() => {
    if (fabricRef.current) return
    const size = Math.min(window.innerWidth - 40, 480)
    const canvas = new Canvas(canvasEl.current, {
      isDrawingMode: true,
      backgroundColor: '#FFFFFF',
      width:  size,
      height: size,
      allowTouchScrolling: false,
      stopContextMenu: true,
      fireRightClick: false,
    })
    const brush = new PencilBrush(canvas)
    brush.color = '#E74C3C'
    brush.width = 8
    canvas.freeDrawingBrush = brush
    fabricRef.current = canvas

    historyRef.current = [JSON.stringify(canvas.toObject())]
    historyIdxRef.current = 0

    canvas.on('path:created', () => {
      if (canvas.getObjects().length > MAX_OBJECTS) {
        const dataUrl = canvas.toDataURL({ format: 'jpeg', quality: 0.85 })
        canvas.clear()
        canvas.backgroundColor = '#FFFFFF'
        FabricImage.fromURL(dataUrl).then((img) => {
          img.set({ selectable: false, evented: false })
          canvas.add(img)
          canvas.sendObjectToBack(img)
          canvas.renderAll()
        })
        historyRef.current = [JSON.stringify(canvas.toObject())]
        historyIdxRef.current = 0
        setCanUndo(false)
        return
      }
      const state = JSON.stringify(fabricRef.current.toObject())
      let arr = historyRef.current.slice(0, historyIdxRef.current + 1)
      arr.push(state)
      if (arr.length > MAX_HISTORY) arr = arr.slice(arr.length - MAX_HISTORY)
      historyRef.current = arr
      historyIdxRef.current = arr.length - 1
      setCanUndo(true)
    })

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
      let arr = historyRef.current.slice(0, historyIdxRef.current + 1)
      arr.push(state)
      if (arr.length > MAX_HISTORY) arr = arr.slice(arr.length - MAX_HISTORY)
      historyRef.current = arr
      historyIdxRef.current = arr.length - 1
      setCanUndo(true)
    })

    return () => { canvas.dispose(); fabricRef.current = null }
  }, [])

  // 브러시 설정
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
      brush.density = 10
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

  // 동화 생성 로딩 메시지 순환
  useEffect(() => {
    if (!loading) { setMsgIdx(0); return }
    const timer = setInterval(() => setMsgIdx((i) => (i + 1) % STORY_MESSAGES.length), 2500)
    return () => clearInterval(timer)
  }, [loading])

  // ref 동기화
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

  // ── AI 변환 모달 열기 ─────────────────────────
  const handleOpenTransform = () => {
    const canvas = fabricRef.current
    if (mode === 'draw' && (!canvas || canvas.getObjects().length === 0)) {
      toast.error('그림을 먼저 그려주세요! 🖍️'); return
    }
    if (mode === 'photo' && !photoSelected) {
      toast.error('사진을 먼저 선택해주세요! 📷'); return
    }
    const dataUrl = canvas.toDataURL({ format: 'png' })
    openTransform(dataUrl, mode, handleGenerate)
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
              { type: 'text', text: '이 그림을 보고 동화를 만들어주세요. 주인공: 수아, 오늘의 주제: 오늘의 이야기' },
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
      Sentry.captureException(err, { extra: { context: '동화 생성', mode, userId: user?.id } })
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
        style={mode === 'photo' && !photoSelected
          ? { height: 0, overflow: 'hidden', marginBottom: 0 }
          : { width: canvasSize, height: canvasSize }}
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
          <div className={styles.toolTabs}>
            {TOOLS.map((t) => (
              <button key={t.key}
                className={`${styles.toolTab} ${drawTool === t.key ? styles.toolTabActive : ''}`}
                onClick={() => handleDrawToolChange(t.key)}>{t.label}</button>
            ))}
          </div>

          {drawTool === 'sticker' && (
            <div className={styles.stickerRow}>
              {STICKERS.map((s) => (
                <button key={s}
                  className={`${styles.stickerBtn} ${selectedSticker === s ? styles.stickerBtnActive : ''}`}
                  onClick={() => setSelectedSticker(s)}>{s}</button>
              ))}
            </div>
          )}

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
      <button className={styles.transformBtn} onClick={handleOpenTransform} disabled={loading}>
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

      {/* 동화 생성 로딩 오버레이 */}
      {loading && createPortal(
        <div
          className={styles.loadingOverlay}
          onPointerDown={(e) => { e.stopPropagation(); e.preventDefault() }}
          onTouchStart={(e) => { e.stopPropagation(); e.preventDefault() }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.loadingCard}>
            <div className={styles.loadingIconWrap}>
              <span key={msgIdx} className={styles.loadingIcon}>{STORY_MESSAGES[msgIdx].icon}</span>
            </div>
            <div className={styles.loadingDots}>
              <span /><span /><span />
            </div>
            <p key={`txt-${msgIdx}`} className={styles.loadingText}>{STORY_MESSAGES[msgIdx].text}</p>
          </div>
        </div>
      , document.body)}
    </div>
  )
}
