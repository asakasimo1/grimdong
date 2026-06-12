// Vercel 서버리스 — Personal AI Brain 그림일기 저장
// 브라우저 → 이 함수 → Telegram Bot API (봇에 특수 메시지 전송)
// bot.py가 📖AIDAM_DIARY: 접두어를 감지해 family_logs.txt에 저장

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN  // 봇 토큰
  const CHAT_ID   = process.env.TELEGRAM_CHAT_ID    // 사용자 Chat ID
  const BRAIN_KEY = process.env.BRAIN_API_KEY        // 위변조 방지 키

  if (!BOT_TOKEN || !CHAT_ID) {
    return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID 미설정' })
  }

  const { title, story, emotion, keywords, image_url, date } = req.body ?? {}
  if (!title || !story) return res.status(400).json({ error: 'title, story 필수' })

  const payload = JSON.stringify({ title, story, emotion, keywords: keywords ?? [], image_url: image_url ?? '', date: date ?? new Date().toISOString().slice(0, 10), key: BRAIN_KEY })
  const text = `📖AIDAM_DIARY:${payload}`

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text }),
    })
    const tgData = await tgRes.json()
    if (!tgData.ok) throw new Error(tgData.description || 'Telegram API 오류')

    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[save-brain error]', err.message)
    res.status(500).json({ error: err.message })
  }
}
