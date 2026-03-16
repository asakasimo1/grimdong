import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '../store/authStore'
import { useDiaryStore } from '../store/useDiaryStore'
import { supabase } from '../lib/supabase'
import PhotoRequestModal from '../components/PhotoRequestModal'
import styles from './DiaryInputPage.module.css'

function formatDateKr(date = new Date()) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`
}

export default function DiaryInputPage() {
  const navigate  = useNavigate()
  const { user }  = useAuthStore()
  const { setDiaryText, setDiaryDate, setAnalyzedElements, setGeneratedImage } = useDiaryStore()

  const [text,      setText]      = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [elements,  setElements]  = useState(null)
  const [profile,   setProfile]   = useState(null)

  const dateLabel = formatDateKr()

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('name, photos').eq('id', user.id).single()
      .then(({ data }) => setProfile(data ?? {}))
  }, [user])

  const handleAnalyze = async () => {
    const trimmed = text.trim()
    if (trimmed.length < 10) { toast.error('일기를 조금 더 써주세요! ✏️'); return }

    setAnalyzing(true)
    try {
      const childName = profile?.name || '아이'
      const prompt = `아이의 일기를 분석해서 아래 JSON 형식으로만 답해줘 (마크다운·코드블록 없이 순수 JSON):

일기: "${trimmed}"
아이 이름: "${childName}"

추출:
1. "persons": 등장 인물 이름/호칭 배열 (예: ["${childName}", "엄마", "지유"])
2. "places": 등장 장소 배열 (예: ["놀이터", "공원"])
3. "imagePrompt": 이 일기의 주요 장면 영문 이미지 프롬프트 (60~80단어, warm child-friendly illustrated scene)
4. "mainPerson": 주인공 이름 (보통 아이 이름)

{"persons":[],"places":[],"imagePrompt":"","mainPerson":""}`

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 400,
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message ?? `Gemini ${res.status}`)

      const raw   = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('분석 실패')

      const result = JSON.parse(match[0])
      setDiaryText(trimmed)
      setDiaryDate(dateLabel)
      setAnalyzedElements(result)
      setElements(result)
      setShowModal(true)
    } catch (err) {
      console.error('[일기 분석 에러]', err)
      toast.error('분석에 실패했어요. 다시 시도해주세요! 🔄')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleGenerate = (imageData) => {
    setGeneratedImage(imageData)
    setShowModal(false)
    navigate('/diary-result')
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/select')}>← 홈</button>
        <h1 className={styles.title}>📝 일기 쓰기</h1>
        <div />
      </header>

      <div className={styles.body}>
        <div className={styles.dateBox}>
          <span className={styles.dateIcon}>📅</span>
          <span>{dateLabel}</span>
        </div>

        <div className={styles.textareaWrap}>
          <textarea
            className={styles.textarea}
            placeholder={`오늘 있었던 일을 써보세요!\n\n예) 오늘 놀이터에서 지유랑 미끄럼틀을 탔어요. 엄마가 벤치에 앉아서 응원해줬어요. 너무 재미있었어요.`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
          />
          <span className={`${styles.charCount} ${text.length > 450 ? styles.charWarn : ''}`}>
            {text.length} / 500
          </span>
        </div>

        <div className={styles.tip}>
          <span className={styles.tipIcon}>💡</span>
          <span>누가, 어디서, 무엇을 했는지 쓰면 더 멋진 그림이 나와요!</span>
        </div>
      </div>

      <div className={styles.footer}>
        <button
          className={styles.genBtn}
          onClick={handleAnalyze}
          disabled={analyzing || text.trim().length < 10}
        >
          {analyzing ? '분석 중... ✨' : '🎨 그림 만들기!'}
        </button>
      </div>

      {showModal && elements && (
        <PhotoRequestModal
          elements={elements}
          profile={profile}
          onClose={() => setShowModal(false)}
          onGenerate={handleGenerate}
        />
      )}
    </div>
  )
}
