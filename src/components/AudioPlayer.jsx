import { useEffect, useRef, useState, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import styles from './AudioPlayer.module.css'

// bgm.mp3 / bgm2.mp3 / bgm3.mp3 를 public 폴더에 배치
// 다른 음악으로 교체하려면 해당 파일만 덮어쓰면 됩니다
const BGM_TRACKS = ['/bgm.mp3', '/bgm2.mp3', '/bgm3.mp3']

const BGM_PAGES = ['/home', '/draw']

function pickRandom(arr, exclude = -1) {
  if (arr.length === 1) return 0
  let idx
  do { idx = Math.floor(Math.random() * arr.length) } while (idx === exclude)
  return idx
}

export default function AudioPlayer() {
  const location    = useLocation()
  const audioRef    = useRef(null)
  const trackIdxRef = useRef(-1)
  const [muted,    setMuted]    = useState(() => localStorage.getItem('bgm_muted') === 'true')
  const [unlocked, setUnlocked] = useState(false)
  const [trackIdx, setTrackIdx] = useState(-1) // -1 = 미선택

  const shouldPlay = BGM_PAGES.some((p) => location.pathname.startsWith(p))

  // 다음 트랙 재생
  const playNext = useCallback((fromIdx) => {
    const audio = audioRef.current
    if (!audio || muted) return
    const next = pickRandom(BGM_TRACKS, fromIdx)
    trackIdxRef.current = next
    setTrackIdx(next)
    audio.src = BGM_TRACKS[next]
    audio.load()
    audio.play().catch(() => {})
  }, [muted])

  // 첫 인터랙션 언락 + 랜덤 트랙 선택
  useEffect(() => {
    if (unlocked) return
    const unlock = () => {
      const audio = audioRef.current
      if (!audio) return
      const idx = pickRandom(BGM_TRACKS)
      trackIdxRef.current = idx
      setTrackIdx(idx)
      audio.src = BGM_TRACKS[idx]
      audio.load()
      audio.play().then(() => {
        if (muted) audio.pause()
        setUnlocked(true)
      }).catch(() => { setUnlocked(true) })
    }
    document.addEventListener('click',      unlock, { once: true })
    document.addEventListener('touchstart', unlock, { once: true })
    return () => {
      document.removeEventListener('click',      unlock)
      document.removeEventListener('touchstart', unlock)
    }
  }, [unlocked, muted])

  // 트랙 끝나면 다음 랜덤 트랙 자동 재생
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onEnded = () => { if (!muted && shouldPlay) playNext(trackIdxRef.current) }
    audio.addEventListener('ended', onEnded)
    return () => audio.removeEventListener('ended', onEnded)
  }, [muted, shouldPlay, playNext])

  // 페이지 이동 or 뮤트 변경 시 재생 제어
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !unlocked) return
    if (shouldPlay && !muted) {
      // 트랙이 선택되지 않았으면 랜덤 선택 후 재생
      if (!audio.src || audio.src === window.location.origin + '/') {
        playNext(-1)
      } else {
        audio.play().catch(() => {})
      }
    } else {
      audio.pause()
    }
  }, [shouldPlay, muted, unlocked, playNext])

  const toggle = () => {
    setMuted((v) => {
      const next = !v
      localStorage.setItem('bgm_muted', String(next))
      return next
    })
  }

  if (!shouldPlay) return null

  return (
    <>
      {/* src는 JS로 관리하므로 src 속성 없이 생성 */}
      <audio ref={audioRef} preload="auto" />
      <button className={styles.btn} onClick={toggle} title={muted ? '음악 켜기' : '음악 끄기'}>
        {muted ? '🔇' : '🎵'}
      </button>
    </>
  )
}
