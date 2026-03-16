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

// 한글 키 → ASCII 파일명
const KEY_ASCII = {
  '아이': 'child', '엄마': 'mom', '아빠': 'dad',
  '할머니': 'grandma', '할아버지': 'grandpa',
  '오빠': 'brother_o', '언니': 'sister_u',
  '남동생': 'brother_y', '여동생': 'sister_y',
}
const toAscii      = (key)  => KEY_ASCII[key] ?? key.replace(/[^\w]/g, '_')
const toAsciiPlace = (name) => 'place_' + name.replace(/[^\w]/g, '_').toLowerCase()

// 분석된 인물 → photos 키 매핑
function resolvePhotoKey(personName, childName) {
  if (!personName) return null
  const n = personName.trim()
  if (n === childName || n === '나' || n === '저') return '아이'
  if (n === '엄마' || n === '어머니') return '엄마'
  if (n === '아빠' || n === '아버지') return '아빠'
  if (['할머니', '할아버지', '오빠', '언니', '남동생', '여동생'].includes(n)) return n
  return n
}

const GENERATE_MESSAGES = [
  { icon: '🎨', text: '일기를 그림으로 바꾸는 중...' },
  { icon: '✨', text: '마법 붓으로 칠하는 중...' },
  { icon: '🌟', text: '거의 다 됐어요!' },
]

export default function PhotoRequestModal({ elements, profile, onClose, onGenerate }) {
  const { user } = useAuthStore()

  const [photos, setPhotos] = useState(() => ({
    persons: profile?.photos?.persons ?? {},
    places:  profile?.photos?.places  ?? {},
  }))

  const [generating, setGenerating] = useState(false)
  const [msgIdx,     setMsgIdx]     = useState(0)
  const [uploading,  setUploading]  = useState(null)

  const fileInputRef  = useRef(null)
  const pendingKeyRef = useRef(null)   // { type: 'person'|'place', key: string }

  const childName = profile?.name || '아이'

  // 등장 인물 목록
  const persons = [...new Set([
    elements.mainPerson,
    ...(elements.persons ?? []),
  ].filter(Boolean))]

  const personItems = persons.map((name) => {
    const key      = resolvePhotoKey(name, childName)
    const photoUrl = photos.persons[key] ?? null
    return { name, key, photoUrl }
  })

  // 장소 목록
  const placeItems = (elements.places ?? []).map((place) => {
    const key      = toAsciiPlace(place)
    const photoUrl = photos.places[key] ?? null
    return { name: place, key, photoUrl }
  })

  // 주인공 레퍼런스 (사람 우선 → 없으면 장소)
  const mainKey      = resolvePhotoKey(elements.mainPerson, childName) || '아이'
  const personRef    = photos.persons[mainKey] ?? null
  const placeRef     = placeItems.find(p => p.photoUrl)?.photoUrl ?? null
  const referenceUrl = personRef  // 사람 사진: FLUX reference (얼굴 보존)
  const placePhotoUrl = placeRef  // 장소 사진: 배경 참조

  // 파일 업로드
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    const pending = pendingKeyRef.current
    if (!file || !pending || !user) return
    e.target.value = ''

    setUploading(pending.key)
    try {
      const blob = await compressImage(file)
      const path = pending.type === 'person'
        ? `${user.id}/person_${toAscii(pending.key)}.jpg`
        : `${user.id}/${pending.key}.jpg`

      const { error: upErr } = await supabase.storage
        .from('profile-photos')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
      if (upErr) throw upErr

      const { data: { publicUrl } } = supabase.storage.from('profile-photos').getPublicUrl(path)

      let newPhotos
      if (pending.type === 'person') {
        newPhotos = { persons: { ...photos.persons, [pending.key]: publicUrl }, places: photos.places }
      } else {
        newPhotos = { persons: photos.persons, places: { ...photos.places, [pending.key]: publicUrl } }
      }

      await supabase.from('profiles').upsert({ id: user.id, photos: newPhotos })
      setPhotos(newPhotos)
      toast.success(`${pending.key.replace('place_', '')} 사진 등록 완료! 📸`)
    } catch (err) {
      console.error('[사진 업로드 에러]', err)
      Sentry.captureException(err)
      toast.error('사진 등록에 실패했어요. 다시 시도해주세요!')
    } finally {
      setUploading(null)
      pendingKeyRef.current = null
    }
  }

  const triggerUpload = (type, key) => {
    pendingKeyRef.current = { type, key }
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
          imagePrompt:   elements.imagePrompt,
          referenceUrl:  referenceUrl  ?? null,
          placePhotoUrl: placePhotoUrl ?? null,
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
      {/* 생성 중 오버레이 */}
      {generating && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingCard}>
            <span key={msgIdx} className={styles.loadingIcon}>{GENERATE_MESSAGES[msgIdx].icon}</span>
            <div className={styles.loadingDots}><span /><span /><span /></div>
            <p key={`t-${msgIdx}`} className={styles.loadingText}>{GENERATE_MESSAGES[msgIdx].text}</p>
          </div>
        </div>
      )}

      <div className={styles.backdrop} onClick={generating ? undefined : onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <button className={styles.closeBtn} disabled={generating} onClick={onClose}>✕</button>

          <h2 className={styles.modalTitle}>🎨 이런 장면이네요!</h2>
          <p className={styles.modalDesc}>사진을 추가하면 그림에 더 잘 반영돼요!</p>

          {/* ── 인물 사진 ── */}
          <p className={styles.sectionLabel}>👤 등장 인물</p>
          <div className={styles.personList}>
            {personItems.map(({ name, key, photoUrl }) => (
              <div key={key} className={styles.personCard}>
                <div className={styles.photoSlot} onClick={() => !generating && triggerUpload('person', key)}>
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
                    ? <span className={`${styles.photoStatus} ${styles.registered}`}>
                        {key === mainKey ? '✅ 주인공 (그림 기준)' : '✅ 사진 있음'}
                      </span>
                    : <span className={styles.photoStatus}>📷 사진 없음</span>
                  }
                </div>
              </div>
            ))}
          </div>

          {/* 레퍼런스 안내 */}
          <div className={styles.refBox}>
            {personRef ? (
              <p className={styles.refNote}>
                ✨ <strong>{mainKey}</strong> 사진을 기준으로 얼굴·헤어를 살려 그릴게요!
                {personItems.filter(p => p.key !== mainKey && p.photoUrl).length > 0 && (
                  <span className={styles.refSub}><br />⚠️ AI 특성상 한 번에 1명 얼굴만 기준 적용돼요. 나머지는 텍스트로 묘사됩니다.</span>
                )}
              </p>
            ) : (
              <p className={styles.refNote}>📸 사진이 없어도 일기 내용으로 그림을 만들 수 있어요!</p>
            )}
          </div>

          {/* ── 장소 사진 ── */}
          {placeItems.length > 0 && (
            <>
              <p className={styles.sectionLabel}>📍 장소 <span className={styles.sectionHint}>— 배경에 반영돼요</span></p>
              <div className={styles.placePhotoList}>
                {placeItems.map(({ name, key, photoUrl }) => (
                  <div key={key} className={styles.placeCard}>
                    <div className={styles.placePhotoSlot} onClick={() => !generating && triggerUpload('place', key)}>
                      {uploading === key ? (
                        <div className={styles.uploadingSpinner}>⏳</div>
                      ) : photoUrl ? (
                        <img src={photoUrl} alt={name} className={styles.placePhotoImg} />
                      ) : (
                        <div className={styles.placePhotoPlaceholder}>
                          <span>🏞️</span>
                        </div>
                      )}
                      <div className={styles.photoOverlay}>
                        <span>{photoUrl ? '변경' : '+ 추가'}</span>
                      </div>
                    </div>
                    <div className={styles.placeInfo}>
                      <span className={styles.placeName}>{name}</span>
                      {photoUrl
                        ? <span className={`${styles.photoStatus} ${styles.registered}`}>✅ 배경 사진 있음</span>
                        : <span className={styles.photoStatus}>🏞️ 사진 없음</span>
                      }
                    </div>
                  </div>
                ))}
              </div>
              {placePhotoUrl && !personRef && (
                <p className={styles.placeRefNote}>✨ 장소 사진을 배경 기준으로 활용할게요!</p>
              )}
              {placePhotoUrl && personRef && (
                <p className={styles.placeRefNote}>✨ 장소 사진도 배경 참고로 활용돼요!</p>
              )}
            </>
          )}

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
