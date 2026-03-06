import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import styles from './AudioPlayer.module.css'

const BGM_PAGES = ['/home', '/draw']

export default function AudioPlayer() {
  const location = useLocation()
  const audioRef  = useRef(null)
  const [muted, setMuted] = useState(() => localStorage.getItem('bgm_muted') === 'true')

  const shouldPlay = BGM_PAGES.some((p) => location.pathname.startsWith(p))

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (shouldPlay && !muted) {
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }, [shouldPlay, muted])

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
