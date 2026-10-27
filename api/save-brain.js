// Vercel 서버리스 — Personal AI Brain 그림일기 저장
// 브라우저 → 이 함수 → Supabase brain_queue 테이블 INSERT
// bot.py 백그라운드 태스크가 5분마다 폴링 → family_logs.txt 저장
// 보안: ① Supabase 로그인 토큰 필수 ② 서버 전용 service_role 키로 INSERT (brain_queue는 RLS로 anon 차단)
//       키는 서버 환경변수 SUPABASE_SERVICE_ROLE_KEY (VITE_ 접두사 금지)

import { verifyUser } from './_auth.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL
  // service_role 키 등록 전에는 anon으로 폴백(전환 기간용) — RLS 잠금 후에는 service_role 필수
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const SUPABASE_KEY = SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase 환경변수 미설정' })
  }
  if (!SERVICE_KEY) console.warn('[save-brain] SUPABASE_SERVICE_ROLE_KEY 미설정 — anon 키로 폴백 중')

  if (!(await verifyUser(req))) return res.status(401).json({ error: '로그인이 필요해요' })

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
        title:      String(title).slice(0, 200),
        story:      String(story).slice(0, 5000),
        emotion:    String(emotion ?? '').slice(0, 100),
        keywords:   Array.isArray(keywords) ? keywords.slice(0, 10).map((k) => String(k).slice(0, 50)) : [],
        image_url:  String(image_url ?? '').slice(0, 2000),
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
