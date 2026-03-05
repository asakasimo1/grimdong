import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import styles from './StoryPage.module.css'

export default function StoryPage() {
  const navigate = useNavigate()
  const { id }   = useParams()
  const [story, setStory] = useState(null)

  useEffect(() => {
    supabase.from('stories').select('*').eq('id', id).single()
      .then(({ data, error }) => {
        if (error || !data) return navigate('/home')
        setStory(data)
      })
  }, [id, navigate])

  if (!story) return null

  const emotionEmoji = {
    행복:'😊', 설렘:'💫', 신기함:'✨', 즐거움:'🎉',
    따뜻함:'🌸', 뿌듯함:'🌟', 신남:'🎈',
  }
  const emoji = emotionEmoji[story.emotion] ?? '💛'

  return (
    <div className={styles.wrap}>
      {/* 그림 */}
      <div className={styles.imgWrap}>
        <img src={story.image_url} alt="내 그림" className={styles.img} />
      </div>

      {/* 동화 카드 */}
      <div className={styles.card}>
        <div className={styles.emotionBadge}>{emoji} {story.emotion}</div>
        <h1 className={styles.title}>{story.title}</h1>
        <p className={styles.storyText}>{story.story}</p>

        <div className={styles.keywords}>
          {(story.keywords ?? []).map((k) => (
            <span key={k} className={styles.tag}># {k}</span>
          ))}
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className={styles.actions}>
        <button className={styles.homeBtn} onClick={() => navigate('/home')}>홈으로</button>
        <button className={styles.drawAgainBtn} onClick={() => navigate('/draw')}>다시 그리기 🎨</button>
      </div>
    </div>
  )
}
