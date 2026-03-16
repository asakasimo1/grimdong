import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import styles from './SettingsPage.module.css'

const FAMILY_OPTIONS = ['엄마', '아빠', '오빠', '언니', '남동생', '여동생', '할머니', '할아버지']

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [name,    setName]    = useState('')
  const [age,     setAge]     = useState('8')
  const [gender,  setGender]  = useState('여자')
  const [likes,   setLikes]   = useState([])
  const [friends, setFriends] = useState([])
  const [family,  setFamily]  = useState([])
  const [pet,     setPet]     = useState('')
  const [likeInput,   setLikeInput]   = useState('')
  const [friendInput, setFriendInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('*').eq('id', user.id).single()
      .then(({ data }) => {
        if (!data) return
        setName(data.name ?? '')
        setAge(data.age ?? '8')
        setGender(data.gender ?? '여자')
        setLikes(data.likes ?? [])
        setFriends(data.friends ?? [])
        setFamily(data.family ?? [])
        setPet(data.pet ?? '')
      })
  }, [user])

  const addTag = (val, list, setList, max) => {
    const v = val.trim()
    if (!v || list.includes(v) || list.length >= max) return
    setList([...list, v])
  }

  const removeTag = (val, list, setList) => setList(list.filter((t) => t !== val))

  const toggleFamily = (member) =>
    setFamily((prev) =>
      prev.includes(member) ? prev.filter((m) => m !== member) : [...prev, member]
    )

  const handleSave = async () => {
    if (!name.trim()) { toast.error('이름을 입력해주세요!'); return }
    setSaving(true)
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      name: name.trim(),
      age,
      gender,
      likes,
      friends,
      family,
      pet: pet.trim(),
      updated_at: new Date().toISOString(),
    })
    setSaving(false)
    if (error) { toast.error('저장 실패: ' + error.message); return }
    toast.success('저장됐어요! 🎉')
    navigate('/home')
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/home')}>← 홈</button>
        <h1 className={styles.title}>아이 정보 설정</h1>
        <div />
      </header>

      <div className={styles.body}>

        {/* 이름 */}
        <div className={styles.field}>
          <label className={styles.label}>👤 이름 <span className={styles.required}>*</span></label>
          <input
            className={styles.input}
            placeholder="아이 이름을 입력해주세요"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={10}
          />
        </div>

        {/* 나이 */}
        <div className={styles.field}>
          <label className={styles.label}>🎂 나이</label>
          <div className={styles.btnGroup}>
            {['5', '6', '7', '8', '9', '10'].map((a) => (
              <button
                key={a}
                className={`${styles.optionBtn} ${age === a ? styles.optionBtnActive : ''}`}
                onClick={() => setAge(a)}
              >{a}세</button>
            ))}
          </div>
        </div>

        {/* 성별 */}
        <div className={styles.field}>
          <label className={styles.label}>🧒 성별</label>
          <div className={styles.btnGroup}>
            {['여자', '남자'].map((g) => (
              <button
                key={g}
                className={`${styles.optionBtn} ${gender === g ? styles.optionBtnActive : ''}`}
                onClick={() => setGender(g)}
              >{g}아이</button>
            ))}
          </div>
        </div>

        {/* 좋아하는 것 */}
        <div className={styles.field}>
          <label className={styles.label}>❤️ 좋아하는 것 <span className={styles.hint}>최대 5개</span></label>
          <div className={styles.tagInputRow}>
            <input
              className={styles.input}
              placeholder="예: 공룡, 그림, 축구"
              value={likeInput}
              onChange={(e) => setLikeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { addTag(likeInput, likes, setLikes, 5); setLikeInput('') }
              }}
              maxLength={10}
            />
            <button className={styles.addBtn} onClick={() => { addTag(likeInput, likes, setLikes, 5); setLikeInput('') }}>추가</button>
          </div>
          <div className={styles.tagRow}>
            {likes.map((t) => (
              <span key={t} className={styles.tag}>{t} <button onClick={() => removeTag(t, likes, setLikes)}>×</button></span>
            ))}
          </div>
        </div>

        {/* 친한 친구 */}
        <div className={styles.field}>
          <label className={styles.label}>👫 친한 친구 이름 <span className={styles.hint}>최대 3명</span></label>
          <div className={styles.tagInputRow}>
            <input
              className={styles.input}
              placeholder="예: 지훈, 서연"
              value={friendInput}
              onChange={(e) => setFriendInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { addTag(friendInput, friends, setFriends, 3); setFriendInput('') }
              }}
              maxLength={6}
            />
            <button className={styles.addBtn} onClick={() => { addTag(friendInput, friends, setFriends, 3); setFriendInput('') }}>추가</button>
          </div>
          <div className={styles.tagRow}>
            {friends.map((t) => (
              <span key={t} className={styles.tag}>{t} <button onClick={() => removeTag(t, friends, setFriends)}>×</button></span>
            ))}
          </div>
        </div>

        {/* 가족 구성 */}
        <div className={styles.field}>
          <label className={styles.label}>👨‍👩‍👧 가족 구성</label>
          <div className={styles.checkGrid}>
            {FAMILY_OPTIONS.map((m) => (
              <button
                key={m}
                className={`${styles.checkBtn} ${family.includes(m) ? styles.checkBtnActive : ''}`}
                onClick={() => toggleFamily(m)}
              >{family.includes(m) ? '✓ ' : ''}{m}</button>
            ))}
          </div>
        </div>

        {/* 반려동물 */}
        <div className={styles.field}>
          <label className={styles.label}>🐾 반려동물 이름 <span className={styles.hint}>없으면 비워두세요</span></label>
          <input
            className={styles.input}
            placeholder="예: 뭉치, 나비"
            value={pet}
            onChange={(e) => setPet(e.target.value)}
            maxLength={10}
          />
        </div>

      </div>

      <div className={styles.footer}>
        <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? '저장 중...' : '💾 저장하기'}
        </button>
      </div>
    </div>
  )
}
