// 경기도버스 API 프록시 — Oracle Cloud IP가 apis.data.go.kr에서 403 차단되어 Vercel 경유
const BASE = 'https://apis.data.go.kr/6410000'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const KEY = process.env.DATA_GO_KR_KEY
  if (!KEY) return res.status(500).json({ error: 'DATA_GO_KR_KEY 환경변수 미설정' })

  const mode = req.query.mode || 'arrival'

  // ── 모드 1: ARS번호로 정류소 ID 조회 (?mode=ars&arsId=12139)
  if (mode === 'ars') {
    const arsId = req.query.arsId || ''
    if (!arsId) return res.status(400).json({ error: 'arsId 파라미터 필요' })
    const url = `${BASE}/busstationservice/v2/getStationByArsIdv2` +
      `?serviceKey=${encodeURIComponent(KEY)}&arsId=${arsId}&format=json`
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
      const data = await r.json()
      return res.status(200).json(data)
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  // ── 모드 2: 노선 정류소 목록 조회 (?mode=route-stations&routeId=210000049)
  if (mode === 'route-stations') {
    const routeId = req.query.routeId || ''
    if (!routeId) return res.status(400).json({ error: 'routeId 파라미터 필요' })
    const url = `${BASE}/busrouteservice/v2/getRouteStationListv2` +
      `?serviceKey=${encodeURIComponent(KEY)}&routeId=${routeId}&format=json`
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
      const data = await r.json()
      return res.status(200).json(data)
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  // ── 모드 3 (기본): 정류소 도착정보 조회 (?stationId=xxx&routes=56-1)
  const stationId = req.query.stationId || ''
  if (!stationId) return res.status(400).json({ error: 'stationId 파라미터 필요' })

  const routes = (req.query.routes || '').split(',').map(r => r.trim()).filter(Boolean)
  const url = `${BASE}/busarrivalservice/v2/getBusArrivalListv2` +
    `?serviceKey=${encodeURIComponent(KEY)}&stationId=${stationId}&format=json`

  try {
    const upstream = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!upstream.ok) {
      const body = await upstream.text()
      return res.status(502).json({ error: `upstream ${upstream.status}`, body })
    }
    const data = await upstream.json()

    if (routes.length > 0) {
      const items = data?.response?.msgBody?.busArrivalList
      if (Array.isArray(items)) {
        data.response.msgBody.busArrivalList = items.filter(item =>
          routes.includes(String(item.routeName || '').trim())
        )
      }
    }
    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
