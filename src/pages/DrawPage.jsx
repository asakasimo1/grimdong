import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Canvas, PencilBrush, CircleBrush, SprayBrush, FabricImage, FabricText, Shadow } from 'fabric'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import * as Sentry from '@sentry/react'
import { useAuthStore } from '../store/authStore'
import { useTransformStore } from '../store/useTransformStore'
import styles from './DrawPage.module.css'

// ── 지우개 SVG 아이콘 ─────────────────────────────────────────
const EraserIcon = () => (
  <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
    <rect x="0.75" y="0.75" width="18.5" height="12.5" rx="2.5" fill="#FFA8BA" stroke="#D4607A" strokeWidth="1.5"/>
    <rect x="0.75" y="0.75" width="7" height="12.5" rx="2.5" fill="#C8C8C8" stroke="#D4607A" strokeWidth="0"/>
    <line x1="7.5" y1="0.75" x2="7.5" y2="13.25" stroke="#D4607A" strokeWidth="1.5"/>
  </svg>
)

function buildPrompt(profile) {
  const name    = profile?.name    || '수아'
  const grade   = profile?.grade   || '1학년'
  const gender  = profile?.gender  || '여자'
  const likes   = profile?.likes?.length   ? profile.likes.join(', ')   : null
  const friends = profile?.friends?.length ? profile.friends.join(', ') : null
  const family  = profile?.family?.length  ? profile.family.join(', ')  : null
  const pet     = profile?.pet || null
  const gradeNum = grade.replace('학년', '')

  const info = [
    `이름: ${name}`, `학년: 초등학교 ${grade}`, `성별: ${gender}아이`,
    likes   ? `좋아하는 것: ${likes}`   : null,
    friends ? `친한 친구: ${friends}`   : null,
    family  ? `가족 구성: ${family}`    : null,
    pet     ? `반려동물: ${pet}`        : null,
  ].filter(Boolean).join('\n')

  return `당신은 초등학생 ${name}의 그림일기를 대신 써주는 선생님입니다.
${name}이(가) 그린 그림을 보고, ${name}의 실제 하루 이야기를 1인칭 그림일기로 JSON 반환하세요.

【아이 정보】
${info}

【JSON 형식 — 코드블록 없이 순수 JSON】
{"title":"일기 제목(8자 이내)","story":"일기 본문","emotion":"주요 감정 1단어","keywords":["요소1","요소2","요소3"],"char_count":글자수}

【story 규칙】
① 180~230자 (공백 포함) ② 문장 15자 이내 ③ 초등${gradeNum}학년 수준
④ "오늘은" 또는 "나는"으로 시작 ⑤ "~했어요"체
⑥ "나는"과 "${name}은/는"을 자연스럽게 번갈아 사용
⑦ 학교·친구·가족·음식·놀이 등 실제 일상 소재 사용${likes ? `\n⑦-1 좋아하는 것(${likes}) 중 하나를 소재로 활용` : ''}${friends ? `\n⑦-2 친구(${friends}) 중 하나를 자연스럽게 등장` : ''}${family ? `\n⑦-3 가족(${family}) 중 누군가를 자연스럽게 등장` : ''}${pet ? `\n⑦-4 반려동물 ${pet}을/를 소재로 활용 가능` : ''}
⑧ 의성어·의태어 1~2개 ⑨ 대화문 1개
⑩ 마법·요정·초능력 등 판타지 요소 절대 금지
⑪ 평범하지만 따뜻하고 뿌듯한 하루 마무리
⑫ 폭력·공포·슬픔 금지`
}

const COLORS = [
  '#FF1744','#FF5722','#FF9800','#FFC107',
  '#FFEB3B','#8BC34A','#4CAF50','#009688',
  '#2196F3','#3F51B5','#9C27B0','#E91E63',
  '#795548','#607D8B','#212121','#FFFFFF',
]
const SIZES    = [4, 8, 14, 22]
const MAX_HISTORY = 20
const MAX_OBJECTS = 150

// 지우개를 마지막 도구로 통합
const TOOLS = [
  { key: 'pencil',  label: '연필',    emoji: '🖊️' },
  { key: 'circle',  label: '원형붓',  emoji: '🔵' },
  { key: 'spray',   label: '스프레이',emoji: '💨' },
  { key: 'rainbow', label: '무지개',  emoji: '🌈' },
  { key: 'glitter', label: '반짝이',  emoji: '✨' },
  { key: 'sticker', label: '스티커',  emoji: '⭐' },
  { key: 'eraser',  label: '지우개',  emoji: null }, // SVG 아이콘 사용
]

const LINE_STYLES = [
  { key: 'solid', label: '━',  desc: '실선' },
  { key: 'dash',  label: '╌',  desc: '긴점선' },
  { key: 'dot',   label: '┄',  desc: '짧은점선' },
  { key: 'neon',  label: '✦',  desc: '네온' },
]

const STICKER_CATEGORIES = {
  동물: ['🐶','🐱','🐰','🐻','🐼','🦊','🐯','🐸','🐧','🦄'],
  음식: ['🍎','🍕','🍔','🍩','🍦','🍰','🍓','🧁','🥐','🍜'],
  날씨: ['☀️','🌙','⭐','🌈','☁️','🌧️','❄️','🌸','🌺','🍂'],
  하트: ['❤️','🧡','💛','💚','💙','💜','🤍','💕','💖','🎀'],
}

const FRAME_DATA = {
  flower:     { emoji: '🌸', color: '#FFB7C5', label: '벚꽃' },
  sunflower:  { emoji: '🌻', color: '#FFD700', label: '해바라기' },
  strawberry: { emoji: '🍓', color: '#FF4757', label: '딸기' },
  butterfly:  { emoji: '🦋', color: '#C084FC', label: '나비' },
  paw:        { emoji: '🐾', color: '#C0855A', label: '발자국' },
  star:       { emoji: '⭐', color: '#FFC300', label: '별' },
  space:      { emoji: '🚀', color: '#1A237E', label: '우주' },
  snow:       { emoji: '❄️', color: '#74B9FF', label: '눈꽃' },
  balloon:    { emoji: '🎈', color: '#FF6B81', label: '풍선' },
  candy:      { emoji: '🍭', color: '#FD79A8', label: '사탕' },
  wave:       { emoji: '🌊', color: '#0984E3', label: '파도' },
  unicorn:    { emoji: '🦄', color: null,      label: '유니콘' },
  rainbow:    { emoji: '🌈', color: null,      label: '무지개' },
}

const STORY_MESSAGES = [
  { icon: '🖍️', text: '그림을 살펴보고 있어요...' },
  { icon: '✏️', text: '오늘 하루를 떠올리는 중...' },
  { icon: '📔', text: '일기를 써내려가고 있어요...' },
  { icon: '🌸', text: '마무리하고 있어요...' },
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
  const rainbowHueRef = useRef(0)
  const sizeRef       = useRef(8)
  const lineStyleRef  = useRef('solid')
  const colorRef      = useRef('#FF1744')
  const user          = useAuthStore((s) => s.user)
  const openTransform = useTransformStore((s) => s.open)
  const [canvasSize]  = useState(() => Math.min(window.innerWidth - 40, 480))

  const [profile,         setProfile]         = useState(null)
  const [color,           setColor]           = useState('#FF1744')
  const [size,            setSize]            = useState(8)
  const [loading,         setLoading]         = useState(false)
  const [mode,            setMode]            = useState('draw')
  const [photoSelected,   setPhotoSelected]   = useState(false)
  const [showCamera,      setShowCamera]      = useState(false)
  const [cameraStream,    setCameraStream]    = useState(null)
  const [drawTool,        setDrawTool]        = useState('pencil')
  const [selectedSticker, setSelectedSticker] = useState('⭐')
  const [canUndo,         setCanUndo]         = useState(false)
  const [msgIdx,          setMsgIdx]          = useState(0)
  const [frame,           setFrame]           = useState(null)
  const [stickerCat,      setStickerCat]      = useState('동물')
  const [lineStyle,       setLineStyle]       = useState('solid')
  const [activePanel,     setActivePanel]     = useState(null) // null | 'draw' | 'frame'

  // 지우개 여부를 drawTool에서 파생
  const isEraser = drawTool === 'eraser'

  // 프로필 로드
  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('*').eq('id', user.id).single()
      .then(({ data }) => setProfile(data ?? null))
  }, [user])

  useEffect(() => {
    if (!loading) return
    const handler = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [loading])

  // Fabric.js 초기화
  useEffect(() => {
    if (fabricRef.current) return
    const sz = Math.min(window.innerWidth - 40, 480)
    const canvas = new Canvas(canvasEl.current, {
      isDrawingMode: true, backgroundColor: '#FFFFFF',
      width: sz, height: sz,
      allowTouchScrolling: false, stopContextMenu: true, fireRightClick: false,
    })
    const brush = new PencilBrush(canvas)
    brush.color = '#FF1744'; brush.width = 8
    canvas.freeDrawingBrush = brush
    fabricRef.current = canvas
    historyRef.current = [JSON.stringify(canvas.toObject())]
    historyIdxRef.current = 0

    canvas.on('path:created', async (e) => {
      // ① MAX_OBJECTS 초과 → 래스터 병합
      if (canvas.getObjects().length > MAX_OBJECTS) {
        const dataUrl = canvas.toDataURL({ format: 'jpeg', quality: 0.85 })
        canvas.clear(); canvas.backgroundColor = '#FFFFFF'
        FabricImage.fromURL(dataUrl).then((img) => {
          img.set({ selectable:false, evented:false }); canvas.add(img)
          canvas.sendObjectToBack(img); canvas.renderAll()
        })
        historyRef.current = [JSON.stringify(canvas.toObject())]; historyIdxRef.current = 0; setCanUndo(false); return
      }
      // ③ 선 스타일 적용
      const style = lineStyleRef.current
      if (style === 'dash') { e.path.set({ strokeDashArray: [24, 8] }); canvas.renderAll() }
      else if (style === 'dot') { e.path.set({ strokeDashArray: [4, 8] }); canvas.renderAll() }
      else if (style === 'neon') { e.path.set({ shadow: new Shadow({ color: colorRef.current, blur: 14, offsetX:0, offsetY:0 }) }); canvas.renderAll() }
      // ④ 히스토리
      const state = JSON.stringify(canvas.toObject())
      let arr = historyRef.current.slice(0, historyIdxRef.current + 1)
      arr.push(state); if (arr.length > MAX_HISTORY) arr = arr.slice(arr.length - MAX_HISTORY)
      historyRef.current = arr; historyIdxRef.current = arr.length - 1; setCanUndo(true)
    })

    canvas.on('mouse:up', (e) => {
      if (drawToolRef.current !== 'sticker') return
      if (e.target) return
      const pos = canvas.getScenePoint(e.e)
      const emoji = new FabricText(stickerRef.current, {
        left: pos.x, top: pos.y, fontSize: 52, originX: 'center', originY: 'center',
        selectable: true, hasControls: true,
      })
      canvas.add(emoji); canvas.setActiveObject(emoji); canvas.renderAll()
      const state = JSON.stringify(canvas.toObject())
      let arr = historyRef.current.slice(0, historyIdxRef.current + 1)
      arr.push(state); if (arr.length > MAX_HISTORY) arr = arr.slice(arr.length - MAX_HISTORY)
      historyRef.current = arr; historyIdxRef.current = arr.length - 1; setCanUndo(true)
    })

    // 지우개: mouse:down/move/up 으로 직접 좌표 수집 → destination-out
    const eraserState = { active: false, points: [] }
    const onEraserDown = (e) => {
      if (drawToolRef.current !== 'eraser') return
      eraserState.active = true
      eraserState.points = [canvas.getScenePoint(e.e)]
    }
    const onEraserMove = (e) => {
      if (!eraserState.active) return
      const pt = canvas.getScenePoint(e.e)
      eraserState.points.push(pt)
      const uctx = canvas.upperCanvasEl?.getContext('2d')
      if (!uctx) return
      uctx.clearRect(0, 0, canvas.getWidth(), canvas.getHeight())
      uctx.globalCompositeOperation = 'source-over'
      uctx.strokeStyle = 'rgba(130,130,130,0.55)'
      uctx.lineWidth = sizeRef.current * 2.5
      uctx.lineCap = 'round'; uctx.lineJoin = 'round'
      uctx.beginPath()
      uctx.moveTo(eraserState.points[0].x, eraserState.points[0].y)
      eraserState.points.forEach((p) => uctx.lineTo(p.x, p.y))
      uctx.stroke()
    }
    const onEraserUp = async () => {
      if (!eraserState.active) return
      eraserState.active = false
      const uctx = canvas.upperCanvasEl?.getContext('2d')
      if (uctx) uctx.clearRect(0, 0, canvas.getWidth(), canvas.getHeight())
      const pts = eraserState.points
      eraserState.points = []
      if (drawToolRef.current !== 'eraser' || pts.length < 1) return
      const w = canvas.getWidth(); const h = canvas.getHeight()
      const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 1 })
      const off = document.createElement('canvas')
      off.width = w; off.height = h
      const ctx = off.getContext('2d')
      await new Promise((res) => { const img = new Image(); img.onload = () => { ctx.drawImage(img, 0, 0); res() }; img.src = dataUrl })
      ctx.globalCompositeOperation = 'destination-out'
      ctx.lineWidth = sizeRef.current * 2.5
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
      ctx.fillStyle = 'rgba(0,0,0,1)'
      ctx.beginPath()
      if (pts.length === 1) {
        ctx.arc(pts[0].x, pts[0].y, sizeRef.current * 1.25, 0, Math.PI * 2); ctx.fill()
      } else {
        ctx.moveTo(pts[0].x, pts[0].y)
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
        ctx.stroke()
      }
      const newUrl = off.toDataURL('image/png')
      canvas.clear(); canvas.backgroundColor = '#FFFFFF'
      const img2 = await FabricImage.fromURL(newUrl)
      img2.set({ left:0, top:0, scaleX:1, scaleY:1, selectable:false, evented:false, originX:'left', originY:'top' })
      canvas.add(img2); canvas.renderAll()
      const state = JSON.stringify(canvas.toObject())
      let arr = historyRef.current.slice(0, historyIdxRef.current + 1)
      arr.push(state); if (arr.length > MAX_HISTORY) arr = arr.slice(arr.length - MAX_HISTORY)
      historyRef.current = arr; historyIdxRef.current = arr.length - 1; setCanUndo(true)
    }
    canvas.on('mouse:down', onEraserDown)
    canvas.on('mouse:move', onEraserMove)
    canvas.on('mouse:up',   onEraserUp)

    return () => { canvas.dispose(); fabricRef.current = null }
  }, [])

  // 브러시 설정
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    if (mode === 'photo' || drawTool === 'sticker' || drawTool === 'glitter') {
      canvas.isDrawingMode = false; canvas.selection = false; return
    }
    canvas.isDrawingMode = true; canvas.selection = false
    if (isEraser) {
      canvas.isDrawingMode = false; canvas.selection = false; return
    }
    let brush
    if (drawTool === 'spray') {
      brush = new SprayBrush(canvas); brush.color = color; brush.width = Math.max(size*3, 24); brush.density = 10
    } else if (drawTool === 'circle') {
      brush = new CircleBrush(canvas); brush.color = color; brush.width = Math.max(Math.round(size / 2), 2)
    } else if (drawTool === 'rainbow') {
      brush = new PencilBrush(canvas); brush.color = `hsl(${rainbowHueRef.current},100%,55%)`; brush.width = Math.max(size, 6)
    } else {
      brush = new PencilBrush(canvas); brush.color = color; brush.width = size
    }
    canvas.freeDrawingBrush = brush
  }, [mode, drawTool, color, size, isEraser])

  // 무지개 색상 순환
  useEffect(() => {
    if (drawTool !== 'rainbow') return
    const canvas = fabricRef.current
    const interval = setInterval(() => {
      rainbowHueRef.current = (rainbowHueRef.current + 10) % 360
      if (canvas?.freeDrawingBrush) canvas.freeDrawingBrush.color = `hsl(${rainbowHueRef.current},100%,55%)`
    }, 60)
    return () => clearInterval(interval)
  }, [drawTool])

  // 반짝이 드로잉
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas || drawTool !== 'glitter') return
    let isDown = false
    const onDown = () => { isDown = true }
    const onUp = () => {
      if (!isDown) return; isDown = false
      const state = JSON.stringify(canvas.toObject())
      let arr = historyRef.current.slice(0, historyIdxRef.current + 1)
      arr.push(state); if (arr.length > MAX_HISTORY) arr = arr.slice(arr.length - MAX_HISTORY)
      historyRef.current = arr; historyIdxRef.current = arr.length - 1; setCanUndo(true)
    }
    const onMove = (e) => {
      if (!isDown) return
      const pos = canvas.getScenePoint(e.e)
      for (let i = 0; i < 5; i++) {
        const angle = Math.random() * Math.PI * 2; const dist = Math.random() * (size + 8)
        canvas.add(new FabricText('✦', {
          left: pos.x + Math.cos(angle)*dist, top: pos.y + Math.sin(angle)*dist,
          fontSize: 6 + Math.random()*10, fill: `hsl(${Math.floor(Math.random()*360)},100%,65%)`,
          originX:'center', originY:'center', selectable:false, evented:false, opacity: 0.7+Math.random()*0.3,
        }))
      }
      canvas.renderAll()
    }
    canvas.on('mouse:down', onDown); canvas.on('mouse:up', onUp); canvas.on('mouse:move', onMove)
    return () => { canvas.off('mouse:down', onDown); canvas.off('mouse:up', onUp); canvas.off('mouse:move', onMove) }
  }, [drawTool, size])

  useEffect(() => { if (!loading) { setMsgIdx(0); return }; const t = setInterval(() => setMsgIdx((i) => (i+1)%STORY_MESSAGES.length), 2500); return () => clearInterval(t) }, [loading])
  useEffect(() => { drawToolRef.current   = drawTool   }, [drawTool])
  useEffect(() => { stickerRef.current    = selectedSticker }, [selectedSticker])
  useEffect(() => { sizeRef.current      = size        }, [size])
  useEffect(() => { lineStyleRef.current  = lineStyle  }, [lineStyle])
  useEffect(() => { colorRef.current      = color      }, [color])
  useEffect(() => { if (showCamera && cameraStream && videoRef.current) videoRef.current.srcObject = cameraStream }, [showCamera, cameraStream])

  const clearCanvas = () => { const c = fabricRef.current; if (!c) return; c.clear(); c.backgroundColor='#FFFFFF'; c.renderAll() }
  const handleClear = () => {
    clearCanvas(); setPhotoSelected(false)
    const state = JSON.stringify(fabricRef.current?.toObject() ?? {})
    historyRef.current = [state]; historyIdxRef.current = 0; setCanUndo(false)
  }
  const handleUndo = async () => {
    if (historyIdxRef.current <= 0) return
    historyIdxRef.current--
    const canvas = fabricRef.current
    await canvas.loadFromJSON(JSON.parse(historyRef.current[historyIdxRef.current]))
    canvas.backgroundColor = '#FFFFFF'
    canvas.getObjects().forEach((obj) => { if (obj.type==='image') { obj.selectable=false; obj.evented=false } })
    canvas.renderAll(); setCanUndo(historyIdxRef.current > 0)
    if (canvas.getObjects().length === 0) setPhotoSelected(false)
  }
  const handleModeSwitch = (newMode) => {
    if (newMode === mode) return
    clearCanvas(); setPhotoSelected(false); setMode(newMode)
  }
  const handleDrawToolChange = (tool) => { setDrawTool(tool) }

  const loadPhotoToCanvas = async (dataUrl) => {
    const canvas = fabricRef.current; clearCanvas()
    try {
      const img = await FabricImage.fromURL(dataUrl)
      const scale = Math.min(canvas.getWidth()/img.width, canvas.getHeight()/img.height)
      img.set({ scaleX:scale, scaleY:scale, selectable:false, evented:false })
      canvas.add(img); canvas.centerObject(img); canvas.renderAll(); setPhotoSelected(true)
    } catch { toast.error('사진을 불러오지 못했어요.') }
  }

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode:'environment', width:{ideal:1280}, height:{ideal:720} } })
      setCameraStream(stream); setShowCamera(true)
    } catch { toast.error('카메라 권한을 허용해주세요.') }
  }
  const closeCamera = () => { cameraStream?.getTracks().forEach((t) => t.stop()); setCameraStream(null); setShowCamera(false) }
  const capturePhoto = () => {
    const video = videoRef.current; const c = document.createElement('canvas')
    c.width = video.videoWidth; c.height = video.videoHeight
    c.getContext('2d').drawImage(video, 0, 0); closeCamera()
    loadPhotoToCanvas(c.toDataURL('image/jpeg', 0.9))
  }
  const handleGallerySelect = (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => loadPhotoToCanvas(ev.target.result); reader.readAsDataURL(file); e.target.value = ''
  }

  const handleOpenTransform = () => {
    const canvas = fabricRef.current
    if (mode==='draw' && (!canvas || canvas.getObjects().length===0)) { toast.error('그림을 먼저 그려주세요! 🖍️'); return }
    if (mode==='photo' && !photoSelected) { toast.error('사진을 먼저 선택해주세요! 📷'); return }
    openTransform(canvas.toDataURL({ format:'png' }), mode, handleGenerate)
  }

  const handleGenerate = async (overrideDataUrl = null) => {
    if (!user) { toast.error('로그인이 필요해요.'); navigate('/login'); return }
    const canvas = fabricRef.current
    if (!overrideDataUrl) {
      if (mode==='draw' && (!canvas || canvas.getObjects().length===0)) { toast.error('그림을 먼저 그려주세요! 🖍️'); return }
      if (mode==='photo' && !photoSelected) { toast.error('사진을 먼저 선택해주세요! 📷'); return }
    }
    setLoading(true)
    try {
      const dataUrl = overrideDataUrl ?? canvas.toDataURL({ format:'jpeg', quality:0.85 })
      const b64 = dataUrl.split(',')[1]
      // Gemini 2.5 Flash — Vision + 그림일기 생성
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: buildPrompt(profile) }] },
            contents: [{
              role: 'user',
              parts: [
                { text: `이 그림을 보고 ${profile?.name||'수아'}의 오늘 하루 그림일기를 써주세요.` },
                { inline_data: { mime_type: 'image/jpeg', data: b64 } },
              ],
            }],
            generationConfig: {
              temperature: 0.85,
              maxOutputTokens: 1200,
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        }
      )
      const data = await res.json()
      console.log('[Gemini 응답 전체]', JSON.stringify(data, null, 2))
      if (!res.ok) throw new Error(data.error?.message ?? `Gemini ${res.status}`)
      const candidate = data.candidates?.[0]
      const finishReason = candidate?.finishReason
      const rawText = candidate?.content?.parts?.[0]?.text ?? ''
      console.log('[Gemini finishReason]', finishReason, '[rawText]', rawText)
      if (!rawText) throw new Error(`Gemini 응답 없음 (finishReason: ${finishReason})`)
      const match = rawText.match(/\{[\s\S]*\}/)
      if (!match) throw new Error(`JSON 파싱 실패. 원문: ${rawText.slice(0, 200)}`)
      const story = JSON.parse(match[0])
      const blob = await fetch(dataUrl).then((r) => r.blob())
      const fileName = `${user.id}/${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage.from('drawings').upload(fileName, blob, { contentType:'image/jpeg' })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('drawings').getPublicUrl(fileName)
      const { data: saved, error: insertError } = await supabase.from('stories')
        .insert({ user_id:user.id, title:story.title, story:story.story, emotion:story.emotion, keywords:story.keywords, char_count:story.char_count, image_url:publicUrl })
        .select('id').single()
      if (insertError) throw insertError
      navigate(`/story/${saved.id}`, { state:{ originalDataUrl: canvas.toDataURL({ format:'jpeg', quality:0.85 }) } })
    } catch (err) {
      console.error('[동화 생성 에러]', err)
      Sentry.captureException(err, { extra:{ context:'동화 생성', mode, userId:user?.id } })
      toast.error(`동화 생성 실패: ${err.message}`)
    } finally { setLoading(false) }
  }

  // ── 렌더 ─────────────────────────────────────────────────────
  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/home')}>← 홈</button>
        <h1 className={styles.title}>오늘의 그림</h1>
        <div className={styles.headerActions}>
          {mode === 'draw' && (
            <button className={styles.undoBtn} onClick={handleUndo} disabled={!canUndo}>↩️</button>
          )}
          <button className={styles.clearBtn} onClick={handleClear}>지우기</button>
        </div>
      </header>

      {/* 모드 탭 */}
      <div className={styles.modeTabs}>
        <button className={`${styles.modeTab} ${mode==='draw' ? styles.modeTabActive : ''}`} onClick={() => handleModeSwitch('draw')}>✏️ 직접 그리기</button>
        <button className={`${styles.modeTab} ${mode==='photo' ? styles.modeTabActive : ''}`} onClick={() => handleModeSwitch('photo')}>📷 사진 불러오기</button>
      </div>

      <input id="galleryFileInput" ref={galleryRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleGallerySelect} />

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
        style={mode==='photo' && !photoSelected ? {height:0, overflow:'hidden', marginBottom:0} : {width:canvasSize, height:canvasSize}}
      >
        <canvas ref={canvasEl} />
        {frame && (
          <div
            className={[styles.frameOverlay, frame==='rainbow' ? styles.frameRainbow : '', frame==='unicorn' ? styles.frameUnicorn : ''].join(' ')}
            style={FRAME_DATA[frame].color ? {borderColor:FRAME_DATA[frame].color} : {}}
          >
            <span className={styles.fc}>{FRAME_DATA[frame].emoji}</span>
            <span className={styles.fc}>{FRAME_DATA[frame].emoji}</span>
            <span className={styles.fc}>{FRAME_DATA[frame].emoji}</span>
            <span className={styles.fc}>{FRAME_DATA[frame].emoji}</span>
          </div>
        )}
      </div>

      {/* 사진 변경 */}
      {mode === 'photo' && photoSelected && (
        <div className={styles.photoButtons}>
          <button className={styles.changePhotoBtn} onClick={openCamera}>📷 다시 찍기</button>
          <label htmlFor="galleryFileInput" className={styles.changePhotoBtn}>🖼️ 다른 사진</label>
        </div>
      )}

      {/* ── 그리기 도구 (접이식 패널) ── */}
      {mode === 'draw' && (
        <>
          {/* 패널 토글 바 */}
          <div className={styles.panelBar}>
            <button
              className={`${styles.panelToggle} ${activePanel==='draw' ? styles.panelToggleOpen : ''}`}
              onClick={() => setActivePanel((p) => p==='draw' ? null : 'draw')}>
              <span>🖊️ 도구 · 색상</span>
              <span className={styles.chevron}>{activePanel==='draw' ? '▲' : '▼'}</span>
            </button>
            <button
              className={`${styles.panelToggle} ${activePanel==='frame' ? styles.panelToggleOpen : ''}`}
              onClick={() => setActivePanel((p) => p==='frame' ? null : 'frame')}>
              <span>🖼️ 액자</span>
              <span className={styles.chevron}>{activePanel==='frame' ? '▲' : '▼'}</span>
            </button>
          </div>

          {/* 도구 · 색상 패널 */}
          {activePanel === 'draw' && (
            <div className={styles.panelContent}>

              {/* 도구 선택 */}
              <div className={styles.toolGrid}>
                {TOOLS.map((t) => (
                  <button key={t.key}
                    className={`${styles.toolChip} ${drawTool===t.key ? styles.toolChipActive : ''}`}
                    onClick={() => handleDrawToolChange(t.key)}>
                    <span className={styles.toolChipIcon}>
                      {t.emoji ?? <EraserIcon />}
                    </span>
                    <span className={styles.toolChipLabel}>{t.label}</span>
                  </button>
                ))}
              </div>

              {/* 스티커 카테고리 */}
              {drawTool === 'sticker' && (
                <>
                  <div className={styles.stickerCatTabs}>
                    {Object.keys(STICKER_CATEGORIES).map((cat) => (
                      <button key={cat}
                        className={`${styles.stickerCatTab} ${stickerCat===cat ? styles.stickerCatTabActive : ''}`}
                        onClick={() => setStickerCat(cat)}>{cat}</button>
                    ))}
                  </div>
                  <div className={styles.stickerRow}>
                    {STICKER_CATEGORIES[stickerCat].map((s) => (
                      <button key={s}
                        className={`${styles.stickerBtn} ${selectedSticker===s ? styles.stickerBtnActive : ''}`}
                        onClick={() => setSelectedSticker(s)}>{s}</button>
                    ))}
                  </div>
                </>
              )}

              {/* 색상 팔레트 */}
              {drawTool !== 'sticker' && drawTool !== 'rainbow' && drawTool !== 'glitter' && drawTool !== 'eraser' && (
                <div className={styles.paletteCompact}>
                  {COLORS.map((c) => (
                    <button key={c}
                      className={`${styles.colorDot} ${color===c ? styles.active : ''}`}
                      style={{background:c, border:c==='#FFFFFF' ? '2px solid #ddd' : 'none'}}
                      onClick={() => setColor(c)} />
                  ))}
                  <label htmlFor="colorPickerInput" className={`${styles.colorDot} ${styles.colorPickerBtn}`}>
                    <span className={styles.colorPickerRainbow} />
                  </label>
                  <input id="colorPickerInput" type="color" value={color}
                    onChange={(e) => setColor(e.target.value)} style={{display:'none'}} />
                </div>
              )}

              {/* 선 종류 (연필만) */}
              {drawTool === 'pencil' && (
                <div className={styles.lineStyleRow}>
                  {LINE_STYLES.map((s) => (
                    <button key={s.key}
                      className={`${styles.lineStyleBtn} ${lineStyle===s.key ? styles.lineStyleBtnActive : ''}`}
                      onClick={() => setLineStyle(s.key)}>
                      <span className={styles.lineStyleIcon}>{s.label}</span>
                      <span className={styles.lineStyleDesc}>{s.desc}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* 크기 */}
              {drawTool !== 'sticker' && (
                <div className={styles.sizesCompact}>
                  <span className={styles.sizesLabel}>크기</span>
                  {SIZES.map((s) => (
                    <button key={s} className={`${styles.sizeBtn} ${size===s ? styles.active : ''}`} onClick={() => setSize(s)}>
                      <span style={{width:s, height:s, borderRadius:'50%', background: isEraser ? '#999' : '#1A1A2E', display:'inline-block'}} />
                    </button>
                  ))}
                </div>
              )}

            </div>
          )}

          {/* 액자 패널 */}
          {activePanel === 'frame' && (
            <div className={styles.panelContent}>
              <div className={styles.frameGrid}>
                <button
                  className={`${styles.frameBtn} ${frame===null ? styles.frameBtnActive : ''}`}
                  onClick={() => setFrame(null)}>
                  <span className={styles.frameBtnEmoji}>✕</span>
                  <span className={styles.frameBtnLabel}>없음</span>
                </button>
                {Object.entries(FRAME_DATA).map(([key, data]) => (
                  <button key={key}
                    className={`${styles.frameBtn} ${frame===key ? styles.frameBtnActive : ''}`}
                    onClick={() => setFrame(frame===key ? null : key)}>
                    <span className={styles.frameBtnEmoji}>{data.emoji}</span>
                    <span className={styles.frameBtnLabel}>{data.label}</span>
                  </button>
                ))}
              </div>
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
        {loading ? '그림일기 쓰는 중... ✏️' : '📔 그림일기로 만들기!'}
      </button>

      {/* 카메라 모달 */}
      {showCamera && createPortal(
        <div className={styles.cameraModal}>
          <video ref={videoRef} autoPlay playsInline muted className={styles.cameraVideo} />
          <div className={styles.cameraActions}>
            <button className={styles.cameraCancelBtn} onClick={closeCamera}>취소</button>
            <button className={styles.cameraShutterBtn} onClick={capturePhoto} aria-label="촬영">
              <span className={styles.cameraShutterInner} />
            </button>
            <div className={styles.cameraBalancer} />
          </div>
        </div>
      , document.body)}

      {/* 로딩 오버레이 */}
      {loading && createPortal(
        <div className={styles.loadingOverlay}
          onPointerDown={(e) => { e.stopPropagation(); e.preventDefault() }}
          onTouchStart={(e) => { e.stopPropagation(); e.preventDefault() }}
          onClick={(e) => e.stopPropagation()}>
          <div className={styles.loadingCard}>
            <div className={styles.loadingIconWrap}>
              <span key={msgIdx} className={styles.loadingIcon}>{STORY_MESSAGES[msgIdx].icon}</span>
            </div>
            <div className={styles.loadingDots}><span /><span /><span /></div>
            <p key={`txt-${msgIdx}`} className={styles.loadingText}>{STORY_MESSAGES[msgIdx].text}</p>
          </div>
        </div>
      , document.body)}
    </div>
  )
}
