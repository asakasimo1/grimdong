import { supabase } from './supabase'

// 서버리스 API(/api/*) 호출용 — 로그인 토큰을 Authorization 헤더에 붙인다.
export async function authFetch(url, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
  })
}
