// 경기도버스 API 프록시 — Oracle Cloud IP가 apis.data.go.kr에서 403 차단되어 Vercel 경유
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const stationId = req.query.stationId || ''
  const routes = (req.query.routes || '').split(',').map(r => r.trim()).filter(Boolean)

  if (!stationId) {
    return res.status(400).json({ error: 'stationId 파라미터 필요' })
  }

  const KEY = process.env.DATA_GO_KR_KEY
  if (!KEY) {
    return res.status(500).json({ error: 'DATA_GO_KR_KEY 환경변수 미설정' })
  }

  const url =
    `https://apis.data.go.kr/6410000/busarrivalservice/v2/getBusArrivalListv2` +
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

    // 노선 필터링 (routes 파라미터 있을 때만)
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
