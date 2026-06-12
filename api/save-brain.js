// Vercel 서버리스 — Personal AI Brain 그림일기 저장
// 브라우저 → 이 함수 → Supabase brain_queue 테이블 INSERT
// bot.py 백그라운드 태스크가 5분마다 폴링 → family_logs.txt 저장

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL
  const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase 환경변수 미설정' })
  }

  const { title, story, emotion, keywords, image_url, date } = req.body ?? {}
  if (!title || !story) return res.status(400).json({ error: 'title, story 필수' })

  try {
    const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/brain_queue`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        title,
        story,
        emotion:    emotion ?? '',
        keywords:   keywords ?? [],
        image_url:  image_url ?? '',
        diary_date: date ?? new Date().toISOString().slice(0, 10),
        processed:  false,
      }),
    })

    if (!sbRes.ok) {
      const err = await sbRes.text()
      throw new Error(`Supabase ${sbRes.status}: ${err}`)
    }

    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[save-brain error]', err.message)
    res.status(500).json({ error: err.message })
  }
}
