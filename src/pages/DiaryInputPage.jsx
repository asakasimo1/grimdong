import { useState, useEffect, useRef } from 'react'
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

const MODES = [
  { id: 'text',  icon: '✏️', label: '직접 입력' },
  { id: 'photo', icon: '📷', label: '사진 인식' },
  { id: 'voice', icon: '🎤', label: '음성 입력' },
]

const WEATHERS = [
  { id: 'sunny',         icon: '☀️', label: '맑음' },
  { id: 'partly_cloudy', icon: '⛅', label: '구름조금' },
  { id: 'cloudy',        icon: '☁️', label: '흐림' },
  { id: 'rainy',         icon: '🌧️', label: '비' },
  { id: 'snowy',         icon: '❄️', label: '눈' },
  { id: 'thunder',       icon: '⛈️', label: '천둥번개' },
]

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function DiaryInputPage() {
  const navigate  = useNavigate()
  const { user }  = useAuthStore()
  const { setDiaryText, setDiaryDate, setDiaryWeather, setAnalyzedElements, setGeneratedImage } = useDiaryStore()

  const [mode,      setMode]      = useState('text')
  const [text,      setText]      = useState('')
  const [weather,   setWeather]   = useState(null)  // WEATHER item or null
  const [analyzing, setAnalyzing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [elements,  setElements]  = useState(null)
  const [profile,   setProfile]   = useState(null)

  // Photo OCR
  const [ocrLoading,   setOcrLoading]   = useState(false)
  const [photoPreview, setPhotoPreview] = useState(null)
  const cameraInputRef  = useRef(null)  // 카메라 직접 촬영
  const galleryInputRef = useRef(null)  // 갤러리 선택

  // Voice
  const [recording, setRecording] = useState(false)
  const [interim,   setInterim]   = useState('')
  const recognitionRef = useRef(null)
  const hasSpeechAPI = !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  const dateLabel = formatDateKr()

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('name, photos').eq('id', user.id).single()
      .then(({ data }) => setProfile(data ?? {}))
  }, [user])

  useEffect(() => {
    if (mode !== 'voice' && recording) {
      recognitionRef.current?.stop()
      setRecording(false)
      setInterim('')
    }
  }, [mode])

  // ── Photo OCR (카메라 / 갤러리 공통 핸들러) ──
  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setPhotoPreview(URL.createObjectURL(file))
    setOcrLoading(true)
    try {
      const base64   = await fileToBase64(file)
      const mimeType = file.type || 'image/jpeg'

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [
                { inlineData: { mimeType, data: base64 } },
                { text: '이 사진에서 어린이가 손으로 쓴 일기 텍스트를 읽어줘. 글씨체가 불분명해도 최대한 해석해서 순수 텍스트로만 출력해줘. 마크다운·설명 없이 일기 내용만 출력.' },
              ],
            }],
            generationConfig: {
              maxOutputTokens: 500,
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message ?? `Gemini ${res.status}`)

      const extracted = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (!extracted.trim()) throw new Error('텍스트를 인식하지 못했어요')
      setText(extracted.trim())
      toast.success('일기 내용을 인식했어요! ✨')
    } catch (err) {
      console.error('[OCR 에러]', err)
      toast.error('사진 인식에 실패했어요. 다시 시도해주세요!')
    } finally {
      setOcrLoading(false)
    }
  }

  // ── Voice ──
  const toggleRecording = () => {
    if (!hasSpeechAPI) { toast.error('이 브라우저에서는 음성 입력이 지원되지 않아요.'); return }
    if (recording) { recognitionRef.current?.stop(); return }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SpeechRecognition()
    rec.lang = 'ko-KR'
    rec.continuous = true
    rec.interimResults = true
    rec.onstart  = () => { setRecording(true); setInterim('') }
    rec.onend    = () => { setRecording(false); setInterim('') }
    rec.onerror  = (e) => {
      if (e.error !== 'aborted') toast.error('음성 인식 오류가 발생했어요.')
      setRecording(false); setInterim('')
    }
    rec.onresult = (e) => {
      let finalPart = '', interimPart = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalPart += e.results[i][0].transcript
        else interimPart += e.results[i][0].transcript
      }
      if (finalPart) setText((prev) => prev ? prev + ' ' + finalPart : finalPart)
      setInterim(interimPart)
    }
    recognitionRef.current = rec
    rec.start()
  }

  // ── Gemini 분석 ──
  const handleAnalyze = async () => {
    const trimmed = text.trim()
    if (trimmed.length < 10) { toast.error('일기를 조금 더 써주세요! ✏️'); return }

    setAnalyzing(true)
    try {
      const childName = profile?.name || '아이'
      const weatherDesc = weather ? ` 오늘 날씨: ${weather.label}.` : ''
      const prompt = `아이의 일기를 분석해서 아래 JSON 형식으로만 답해줘 (마크다운·코드블록 없이 순수 JSON):

일기: "${trimmed}"
아이 이름: "${childName}"${weatherDesc}

추출:
1. "persons": 등장 인물 이름/호칭 배열 (예: ["${childName}", "엄마", "지유"])
2. "places": 등장 장소 배열 (예: ["놀이터", "공원"])
3. "imagePrompt": 이 일기의 주요 장면 영문 이미지 프롬프트 (60~80단어). 장면 묘사에 집중하고 캐릭터·배경·행동·분위기를 구체적으로 묘사${weather ? `. 날씨: ${weather.label}` : ''}. (스타일 지정 불필요 — 별도 처리)
4. "mainPerson": 주인공 이름 (보통 아이 이름)

{"persons":[],"places":[],"imagePrompt":"","mainPerson":""}`

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 400, thinkingConfig: { thinkingBudget: 0 } },
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
      setDiaryWeather(weather)
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
        {/* 날짜 + 날씨 선택 */}
        <div className={styles.dateBox}>
          <div className={styles.dateLeft}>
            <span className={styles.dateIcon}>📅</span>
            <span>{dateLabel}</span>
            {weather && <span className={styles.selectedWeather}>{weather.icon}</span>}
          </div>
          <div className={styles.weatherRow}>
            {WEATHERS.map((w) => (
              <button
                key={w.id}
                className={`${styles.weatherBtn} ${weather?.id === w.id ? styles.weatherBtnActive : ''}`}
                onClick={() => setWeather(weather?.id === w.id ? null : w)}
                title={w.label}
              >
                {w.icon}
              </button>
            ))}
          </div>
        </div>

        {/* 입력 모드 선택 탭 */}
        <div className={styles.modeTabs}>
          {MODES.map(({ id, icon, label }) => (
            <button
              key={id}
              className={`${styles.modeTab} ${mode === id ? styles.modeTabActive : ''}`}
              onClick={() => setMode(id)}
            >
              <span className={styles.modeIcon}>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* 사진 인식 모드 */}
        {mode === 'photo' && (
          <div className={styles.photoSection}>
            {/* 카메라 / 갤러리 두 버튼 */}
            <div className={styles.photoButtons}>
              <button
                className={styles.photoUploadBtn}
                onClick={() => cameraInputRef.current?.click()}
                disabled={ocrLoading}
              >
                <span className={styles.photoUploadIcon}>📷</span>
                <span>카메라로 찍기</span>
              </button>
              <button
                className={`${styles.photoUploadBtn} ${styles.photoUploadBtnOutline}`}
                onClick={() => galleryInputRef.current?.click()}
                disabled={ocrLoading}
              >
                <span className={styles.photoUploadIcon}>🖼️</span>
                <span>갤러리에서 선택</span>
              </button>
            </div>

            {photoPreview && (
              <div className={styles.photoPreviewWrap}>
                <img src={photoPreview} alt="일기 사진" className={styles.photoPreview} />
                {ocrLoading && <div className={styles.ocrOverlay}><span className={styles.ocrSpinner} /></div>}
                {!ocrLoading && (
                  <button className={styles.retakeBtn} onClick={() => { setPhotoPreview(null); setText('') }}>✕ 다시 선택</button>
                )}
              </div>
            )}

            {/* 카메라 전용 input (capture=environment) */}
            <input ref={cameraInputRef}  type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handlePhotoSelect} />
            {/* 갤러리 전용 input (capture 없음) */}
            <input ref={galleryInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoSelect} />
          </div>
        )}

        {/* 음성 입력 모드 */}
        {mode === 'voice' && (
          <div className={styles.voiceSection}>
            {!hasSpeechAPI ? (
              <p className={styles.voiceUnsupported}>이 브라우저에서는 음성 입력이 지원되지 않아요.<br />Chrome 또는 Safari를 사용해주세요.</p>
            ) : (
              <>
                <button
                  className={`${styles.micBtn} ${recording ? styles.micBtnRecording : ''}`}
                  onClick={toggleRecording}
                >
                  <span className={styles.micIcon}>{recording ? '⏹' : '🎤'}</span>
                  <span className={styles.micLabel}>{recording ? '탭하여 중지' : '탭하여 말하기'}</span>
                </button>
                {recording && (
                  <div className={styles.recordingBadge}>
                    <span className={styles.recordingDot} />
                    <span>듣고 있어요...</span>
                  </div>
                )}
                {recording && interim && <p className={styles.interimText}>{interim}</p>}
              </>
            )}
          </div>
        )}

        {/* 공통 텍스트 입력 */}
        <div className={styles.textareaWrap}>
          {(mode === 'photo' || mode === 'voice') && text && (
            <p className={styles.editHint}>✏️ 인식된 내용이에요. 수정도 가능해요!</p>
          )}
          <textarea
            className={styles.textarea}
            placeholder={
              mode === 'photo' ? '사진을 찍으면 일기 내용이 여기에 나타나요!\n직접 수정도 가능해요.'
              : mode === 'voice' ? '말하면 일기 내용이 여기에 나타나요!\n직접 수정도 가능해요.'
              : `오늘 있었던 일을 써보세요!\n\n예) 오늘 놀이터에서 지유랑 미끄럼틀을 탔어요.`
            }
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
