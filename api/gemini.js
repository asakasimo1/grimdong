// Vercel 서버리스 함수 — Gemini 프록시
// 브라우저에는 키를 두지 않는다. 키는 서버 환경변수 GEMINI_API_KEY (VITE_ 접두사 금지) 에만 존재.
// 방어: ① Supabase 로그인 토큰 필수 ② 모델 고정 ③ 요청 필드 화이트리스트 ④ 크기·토큰 상한 ⑤ 사용자별 호출 제한

const MODEL = 'gemini-2.5-flash'
const MAX_BODY_BYTES = 4 * 1024 * 1024        // Vercel 요청 한도(4.5MB) 안쪽
const MAX_OUTPUT_TOKENS = 1500
const MAX_CONTENTS = 4
const MAX_PARTS = 6
const MAX_TEXT_CHARS = 8000
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
const ALLOWED_GEN_KEYS = ['temperature', 'maxOutputTokens', 'thinkingConfig']

// 인스턴스 메모리 기반 제한(서버리스 특성상 최선 노력). 사용자당 10분에 40회
const WINDOW_MS = 10 * 60 * 1000
const LIMIT = 40
const hits = new Map()

function rateLimited(userId) {
  const now = Date.now()
  const arr = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS)
  if (arr.length >= LIMIT) { hits.set(userId, arr); return true }
  arr.push(now)
  hits.set(userId, arr)
  if (hits.size > 5000) hits.clear()
  return false
}

const fail = (res, status, message) => res.status(status).json({ error: { message } })

async function verifyUser(req) {
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

function cleanPart(p) {
  if (!p || typeof p !== 'object') return null
  if (typeof p.text === 'string') return { text: p.text.slice(0, MAX_TEXT_CHARS) }
  const img = p.inlineData ?? p.inline_data
  if (img && typeof img.data === 'string') {
    const mime = img.mimeType ?? img.mime_type
    if (!ALLOWED_MIME.has(mime)) return null
    return { inlineData: { mimeType: mime, data: img.data } }
  }
  return null
}

function cleanContents(contents) {
  if (!Array.isArray(contents) || contents.length === 0 || contents.length > MAX_CONTENTS) return null
  const out = []
  for (const c of contents) {
    if (!Array.isArray(c?.parts) || c.parts.length === 0 || c.parts.length > MAX_PARTS) return null
    const parts = c.parts.map(cleanPart)
    if (parts.some((x) => !x)) return null
    out.push({ role: c.role === 'model' ? 'model' : 'user', parts })
  }
  return out
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'Method Not Allowed')

  const KEY = process.env.GEMINI_API_KEY
  if (!KEY) return fail(res, 500, 'GEMINI_API_KEY not configured')

  const userId = await verifyUser(req)
  if (!userId) return fail(res, 401, '로그인이 필요해요')
  if (rateLimited(userId)) return fail(res, 429, '요청이 너무 많아요. 잠시 후 다시 시도해주세요')

  const body = req.body ?? {}
  if (JSON.stringify(body).length > MAX_BODY_BYTES) return fail(res, 413, '요청이 너무 커요')

  const contents = cleanContents(body.contents)
  if (!contents) return fail(res, 400, 'contents 형식 오류')

  const payload = { contents }

  if (body.systemInstruction?.parts) {
    const sys = body.systemInstruction.parts.map(cleanPart)
    if (sys.length > MAX_PARTS || sys.some((x) => !x || !x.text)) return fail(res, 400, 'systemInstruction 형식 오류')
    payload.systemInstruction = { parts: sys }
  }

  const gen = {}
  for (const k of ALLOWED_GEN_KEYS) if (body.generationConfig?.[k] !== undefined) gen[k] = body.generationConfig[k]
  gen.maxOutputTokens = Math.min(Number(gen.maxOutputTokens) || 500, MAX_OUTPUT_TOKENS)
  if (gen.thinkingConfig) gen.thinkingConfig = { thinkingBudget: Math.min(Math.max(Number(gen.thinkingConfig.thinkingBudget) || 0, 0), 1024) }
  payload.generationConfig = gen

  try {
    const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      // 키는 URL이 아니라 헤더로 전달 (로그·리퍼러에 남지 않도록)
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify(payload),
    })
    const data = await g.json().catch(() => ({}))
    if (!g.ok) {
      console.error('[gemini proxy] upstream', g.status, data?.error?.status)
      return fail(res, g.status === 429 ? 429 : 502, data?.error?.message ?? `Gemini ${g.status}`)
    }
    return res.status(200).json(data)
  } catch (err) {
    console.error('[gemini proxy]', err.message)
    return fail(res, 502, 'Gemini 호출 실패')
  }
}
