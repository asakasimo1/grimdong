import { useState, useRef } from 'react'
import toast from 'react-hot-toast'
import * as Sentry from '@sentry/react'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import styles from './PhotoRequestModal.module.css'

// 이미지 압축 → Blob
function compressImage(file, size = 800) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const c = document.createElement('canvas')
        c.width = size; c.height = size
        const ctx = c.getContext('2d')
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, size, size)
        const scale = Math.min(size / img.width, size / img.height)
        ctx.drawImage(img, (size - img.width * scale) / 2, (size - img.height * scale) / 2, img.width * scale, img.height * scale)
        c.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85)
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

// 분석된 인물 이름 → photos 키 매핑
function resolvePhotoKey(personName, childName) {
  if (!personName) return null
  const n = personName.trim()
  if (n === childName || n === '나' || n === '저') return '아이'
  if (n === '엄마' || n === '어머니') return '엄마'
  if (n === '아빠' || n === '아버지') return '아빠'
  if (['할머니', '할아버지', '오빠', '언니', '남동생', '여동생'].includes(n)) return n
  return n  // 친구 등 그 외 이름
}

const GENERATE_MESSAGES = [
  { icon: '🎨', text: '일기를 그림으로 바꾸는 중...' },
  { icon: '✨', text: '마법 붓으로 칠하는 중...' },
  { icon: '🌟', text: '거의 다 됐어요!' },
]

export default function PhotoRequestModal({ elements, profile, onClose, onGenerate }) {
  const { user } = useAuthStore()

  // 현재 등록된 사진 (로컬 상태로 관리 — 모달 내 업로드 반영)
  const [photos, setPhotos] = useState(() => ({
    persons: profile?.photos?.persons ?? {},
    places:  profile?.photos?.places  ?? {},
  }))

  const [generating, setGenerating] = useState(false)
  const [msgIdx,     setMsgIdx]     = useState(0)
  const [uploading,  setUploading]  = useState(null)  // 업로드 중인 키

  const fileInputRef = useRef(null)
  const pendingKeyRef = useRef(null)   // 파일 선택 후 저장할 키

  const childName = profile?.name || '아이'

  // 등장 인물 목록 (중복 제거, mainPerson 우선)
  const persons = [...new Set([
    elements.mainPerson,
    ...(elements.persons ?? []),
  ].filter(Boolean))]

  // 인물별 사진 상태
  const personItems = persons.map((name) => {
    const key     = resolvePhotoKey(name, childName)
    const photoUrl = photos.persons[key] ?? null
    return { name, key, photoUrl }
  })

  // 주인공(아이) 레퍼런스 URL — 가장 중요한 사진
  const mainKey      = resolvePhotoKey(elements.mainPerson, childName) || '아이'
  const referenceUrl = photos.persons[mainKey] ?? null

  // 파일 업로드 처리
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    const key  = pendingKeyRef.current
    if (!file || !key || !user) return
    e.target.value = ''

    setUploading(key)
    try {
      const blob = await compressImage(file)
      const path = `${user.id}/person_${key}.jpg`

      const { error: upErr } = await supabase.storage
        .from('profile-photos')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
      if (upErr) throw upErr

      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(path)

      // profiles.photos 업데이트
      const newPersons = { ...photos.persons, [key]: publicUrl }
      const newPhotos  = { persons: newPersons, places: photos.places }
      await supabase.from('profiles').upsert({ id: user.id, photos: newPhotos })

      setPhotos(newPhotos)
      toast.success(`${key} 사진 등록 완료! 📸`)
    } catch (err) {
      console.error('[사진 업로드 에러]', err)
      Sentry.captureException(err)
      toast.error('사진 등록에 실패했어요. 다시 시도해주세요!')
    } finally {
      setUploading(null)
      pendingKeyRef.current = null
    }
  }

  const triggerUpload = (key) => {
    pendingKeyRef.current = key
    fileInputRef.current?.click()
  }

  // 이미지 생성
  const handleGenerate = async () => {
    setGenerating(true)
    const timer = setInterval(() => setMsgIdx((i) => (i + 1) % GENERATE_MESSAGES.length), 2500)

    try {
      const res = await fetch('/api/diary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imagePrompt: elements.imagePrompt,
          referenceUrl: referenceUrl ?? null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      if (!data.imageData) throw new Error('NO_IMAGE')

      onGenerate(data.imageData)
    } catch (err) {
      console.error('[이미지 생성 에러]', err)
      Sentry.captureException(err)
      toast.error('그림 생성에 실패했어요. 다시 시도해주세요! 🔄', { duration: 4000 })
    } finally {
      clearInterval(timer)
      setGenerating(false)
      setMsgIdx(0)
    }
  }

  return (
    <>
      {/* 생성 중 로딩 오버레이 */}
      {generating && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingCard}>
            <span key={msgIdx} className={styles.loadingIcon}>{GENERATE_MESSAGES[msgIdx].icon}</span>
            <div className={styles.loadingDots}><span /><span /><span /></div>
            <p key={`t-${msgIdx}`} className={styles.loadingText}>{GENERATE_MESSAGES[msgIdx].text}</p>
          </div>
        </div>
      )}

      {/* 모달 백드롭 */}
      <div className={styles.backdrop} onClick={generating ? undefined : onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <button className={styles.closeBtn} disabled={generating} onClick={onClose}>✕</button>

          <h2 className={styles.modalTitle}>🎨 이런 장면이네요!</h2>
          <p className={styles.modalDesc}>등장하는 사람의 사진을 추가하면 더 비슷하게 만들 수 있어요!</p>

          {/* 인물 목록 */}
          <div className={styles.personList}>
            {personItems.map(({ name, key, photoUrl }) => (
              <div key={key} className={styles.personCard}>
                {/* 사진 미리보기 or 플레이스홀더 */}
                <div className={styles.photoSlot} onClick={() => !generating && triggerUpload(key)}>
                  {uploading === key ? (
                    <div className={styles.uploadingSpinner}>⏳</div>
                  ) : photoUrl ? (
                    <img src={photoUrl} alt={name} className={styles.photoPreview} />
                  ) : (
                    <div className={styles.photoPlaceholder}>
                      <span className={styles.placeholderIcon}>👤</span>
                    </div>
                  )}
                  <div className={styles.photoOverlay}>
                    <span>{photoUrl ? '변경' : '+ 추가'}</span>
                  </div>
                </div>

                <div className={styles.personInfo}>
                  <span className={styles.personName}>{name}</span>
                  {photoUrl
                    ? <span className={styles.photoStatus + ' ' + styles.registered}>✅ 사진 있음</span>
                    : <span className={styles.photoStatus}>📷 사진 없음</span>
                  }
                </div>
              </div>
            ))}
          </div>

          {/* 장소 배지 */}
          {elements.places?.length > 0 && (
            <div className={styles.placeRow}>
              <span className={styles.placeLabel}>📍 장소</span>
              {elements.places.map((p) => (
                <span key={p} className={styles.placeBadge}>{p}</span>
              ))}
            </div>
          )}

          {/* 레퍼런스 안내 */}
          <p className={styles.refNote}>
            {referenceUrl
              ? `✨ ${mainKey} 사진을 기준으로 그림을 그릴게요!`
              : '📸 사진이 없어도 일기 내용으로 그림을 만들 수 있어요!'}
          </p>

          {/* 액션 버튼 */}
          <div className={styles.actions}>
            <button className={styles.skipBtn} onClick={handleGenerate} disabled={generating}>
              사진 없이 바로 생성
            </button>
            <button className={styles.generateBtn} onClick={handleGenerate} disabled={generating}>
              🎨 그림 만들기!
            </button>
          </div>
        </div>
      </div>

      {/* 숨겨진 파일 인풋 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </>
  )
}
