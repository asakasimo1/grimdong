import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import styles from './AudioPlayer.module.css'

const BGM_PAGES = ['/home', '/draw']

export default function AudioPlayer() {
  const location  = useLocation()
  const audioRef  = useRef(null)
  const [muted, setMuted]       = useState(() => localStorage.getItem('bgm_muted') === 'true')
  const [unlocked, setUnlocked] = useState(false)

  const shouldPlay = BGM_PAGES.some((p) => location.pathname.startsWith(p))

  // 첫 사용자 인터랙션 감지 → 오디오 언락
  useEffect(() => {
    if (unlocked) return
    const unlock = () => {
      const audio = audioRef.current
      if (!audio) return
      audio.play().then(() => {
        if (muted) audio.pause()
        setUnlocked(true)
      }).catch(() => {})
    }
    document.addEventListener('click', unlock, { once: true })
    document.addEventListener('touchstart', unlock, { once: true })
    return () => {
      document.removeEventListener('click', unlock)
      document.removeEventListener('touchstart', unlock)
    }
  }, [unlocked, muted])

  // 페이지 이동 or 뮤트 변경 시 재생 제어
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !unlocked) return
    if (shouldPlay && !muted) {
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }, [shouldPlay, muted, unlocked])

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
      <audio ref={audioRef} src="/bgm.mp3" loop preload="auto" />
      <button className={styles.btn} onClick={toggle} title={muted ? '음악 켜기' : '음악 끄기'}>
        {muted ? '🔇' : '🎵'}
      </button>
    </>
  )
}
