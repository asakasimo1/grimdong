// 서버리스 공용 — Supabase 로그인 토큰 검증 (파일명이 _ 로 시작하면 Vercel 엔드포인트로 노출되지 않음)
// 브라우저가 보낸 Authorization: Bearer <access_token> 이 유효하면 user id, 아니면 null
export async function verifyUser(req) {
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL
  const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY
  const auth = req.headers.authorization ?? ''
  if (!SUPABASE_URL || !SUPABASE_ANON || !auth.startsWith('Bearer ')) return null
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON, Authorization: auth },
    })
    if (!r.ok) return null
    const u = await r.json()
    return u?.id ?? null
  } catch {
    return null
  }
}
