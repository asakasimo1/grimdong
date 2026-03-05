import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Canvas, PencilBrush } from 'fabric'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import styles from './DrawPage.module.css'

const COLORS = ['#E74C3C','#E67E22','#F1C40F','#27AE60','#2980B9','#8E44AD','#1A1A2E','#FFFFFF']
const SIZES  = [4, 8, 14, 22]

export default function DrawPage() {
  const navigate    = useNavigate()
  const canvasEl    = useRef(null)
  const fabricRef   = useRef(null)
  const user        = useAuthStore((s) => s.user)
  const [color, setColor]   = useState('#E74C3C')
  const [size, setSize]     = useState(8)
  const [isEraser, setIsEraser] = useState(false)
  const [loading, setLoading]   = useState(false)

  // Fabric.js 초기화
  useEffect(() => {
    if (fabricRef.current) return   // StrictMode 이중 실행 방지

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

    return () => {
      canvas.dispose()
      fabricRef.current = null
    }
  }, [])

  // 색상·굵기 반영
  useEffect(() => {
    const c = fabricRef.current
    if (!c) return
    c.freeDrawingBrush.color = isEraser ? '#FFFFFF' : color
    c.freeDrawingBrush.width = isEraser ? size * 2.5 : size
  }, [color, size, isEraser])

  const handleClear = () => {
    fabricRef.current.clear()
    fabricRef.current.backgroundColor = '#FFFFFF'
    fabricRef.current.renderAll()
  }

  const handleGenerate = async () => {
    const canvas = fabricRef.current
    if (!canvas || canvas.getObjects().length === 0) {
      toast.error('그림을 먼저 그려주세요! 🖍️')
      return
    }
    setLoading(true)
    try {
      // 캔버스 → base64
      const dataUrl = canvas.toDataURL({ format: 'jpeg', quality: 0.85 })
      const b64 = dataUrl.split(',')[1]

      // AI 스토리 생성
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
        },
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
          max_tokens: 600,
          temperature: 0.85,
        }),
      })

      const data = await res.json()
      const raw  = data.choices?.[0]?.message?.content ?? ''
      const story = JSON.parse(raw)

      // 이미지 → Blob 변환 후 Supabase Storage 업로드
      const blob = await fetch(dataUrl).then((r) => r.blob())
      const fileName = `${user.id}/${Date.now()}.jpg`
      const { error: uploadError } = await supabase.storage
        .from('drawings')
        .upload(fileName, blob, { contentType: 'image/jpeg' })
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('drawings')
        .getPublicUrl(fileName)

      // Supabase stories 테이블에 저장
      const { data: saved, error: insertError } = await supabase
        .from('stories')
        .insert({
          user_id:    user.id,
          title:      story.title,
          story:      story.story,
          emotion:    story.emotion,
          keywords:   story.keywords,
          char_count: story.char_count,
          image_url:  publicUrl,
        })
        .select('id')
        .single()
      if (insertError) throw insertError

      navigate(`/story/${saved.id}`)

    } catch (err) {
      console.error(err)
      toast.error('동화 생성에 실패했어요. 다시 시도해 주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/home')}>← 홈</button>
        <h1 className={styles.title}>오늘의 그림</h1>
        <button className={styles.clearBtn} onClick={handleClear}>지우기</button>
      </header>

      {/* 캔버스 */}
      <div className={styles.canvasWrap}>
        <canvas ref={canvasEl} />
      </div>

      {/* 색상 팔레트 */}
      <div className={styles.palette}>
        {COLORS.map((c) => (
          <button
            key={c}
            className={`${styles.colorDot} ${!isEraser && color === c ? styles.active : ''}`}
            style={{ background: c, border: c === '#FFFFFF' ? '2px solid #ddd' : 'none' }}
            onClick={() => { setColor(c); setIsEraser(false) }}
          />
        ))}
        <button
          className={`${styles.eraserBtn} ${isEraser ? styles.active : ''}`}
          onClick={() => setIsEraser((v) => !v)}
          title="지우개"
        >⬜</button>
      </div>

      {/* 굵기 */}
      <div className={styles.sizes}>
        {SIZES.map((s) => (
          <button
            key={s}
            className={`${styles.sizeBtn} ${size === s ? styles.active : ''}`}
            onClick={() => setSize(s)}
          >
            <span style={{ width: s, height: s, borderRadius: '50%', background: '#1A1A2E', display: 'inline-block' }} />
          </button>
        ))}
      </div>

      {/* 동화 만들기 버튼 */}
      <button className={styles.genBtn} onClick={handleGenerate} disabled={loading}>
        {loading ? '동화 만드는 중... ✨' : '🪄 동화로 만들기!'}
      </button>
    </div>
  )
}
