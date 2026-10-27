import { supabase } from './supabase'

// Gemini는 서버 프록시(/api/gemini)로만 호출한다. 브라우저에는 API 키가 없다.
// body: { contents, systemInstruction?, generationConfig? } → Gemini 응답 JSON 그대로 반환
export async function callGemini(body) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error?.message ?? `Gemini ${res.status}`)
  return data
}
