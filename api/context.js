// Vercel 서버리스 함수 — Personal AI Brain(가족 어드바이저) 배경지식 프록시
// "그려서 일기 만들기"가 지어내는 이야기를 실제 가족 정보로 보강하기 위해
// 가족 공용 일정 + 친인척 관계 + 엄마/아빠/수아 각자의 학습된 사실을
// 가져온다. 계정 매핑 없음 — 아이담을 여는 누구나(사실상 수아 혼자 쓰는
// 앱) 그대로 참조 가능. 대신 AI Brain 서버 쪽 공유키(AIBRAIN_BRIDGE_SECRET)는
// 이 서버리스 함수 안에만 두고 브라우저로는 절대 내려주지 않는다.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' })

  const url = process.env.AIBRAIN_BRIDGE_URL
  const key = process.env.AIBRAIN_BRIDGE_SECRET
  const empty = { familyProfile: '', familyLogs: '', learnedFacts: {} }

  if (!url || !key) {
    // 설정이 안 돼 있어도 그림일기 생성 자체는 항상 되어야 하므로 200 + 빈 값
    return res.status(200).json(empty)
  }

  try {
    const r = await fetch(url, {
      headers: { 'X-Aiddam-Secret': key },
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) throw new Error(`AI Brain ${r.status}`)
    const data = await r.json()
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    res.status(200).json(data)
  } catch (err) {
    console.error('[aiddam context proxy error]', err.message)
    // 여기서 실패해도 그림일기 생성 흐름을 막으면 안 되므로 200 + 빈 값으로 응답
    res.status(200).json({ ...empty, error: err.message })
  }
}
