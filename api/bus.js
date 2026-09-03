// 경기도버스 API 프록시 — Oracle Cloud IP가 apis.data.go.kr에서 403 차단되어 Vercel 경유
const BASE     = 'https://apis.data.go.kr/6410000'
const GBIS_OLD = 'http://openapi.gbis.go.kr/ws/rest'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const KEY = process.env.DATA_GO_KR_KEY
  if (!KEY) return res.status(500).json({ error: 'DATA_GO_KR_KEY 환경변수 미설정' })

  const mode = req.query.mode || 'arrival'

  // ── GBIS 구버전 API: ARS번호 직접 사용 (?mode=gbis&stationId=12139&routes=56-1)
  if (mode === 'gbis') {
    const stationId = req.query.stationId || ''
    if (!stationId) return res.status(400).json({ error: 'stationId 파라미터 필요' })
    const routes = (req.query.routes || '').split(',').map(r => r.trim()).filter(Boolean)

    // GBIS 구버전 API는 serviceKey=1 로 동작하는 공개 엔드포인트 사용
    const gbisKey = req.query.gbisKey || '1'
    const url = `${GBIS_OLD}/busarrivalservice/station` +
      `?serviceKey=${gbisKey}&stationId=${stationId}`
    try {
      const r = await fetch(url, {
        headers: { 'Accept': 'application/xml, text/xml' },
        signal: AbortSignal.timeout(10000),
      })
      const xml = await r.text()
      // XML → JSON 변환 (간단 파싱)
      const getTag = (tag) => {
        const m = xml.match(new RegExp(`<${tag}>(.*?)<\/${tag}>`, 's'))
        return m ? m[1].trim() : ''
      }
      const getAllItems = () => {
        const items = []
        const itemRx = /<busArrivalList>([\s\S]*?)<\/busArrivalList>/g
        let m
        while ((m = itemRx.exec(xml)) !== null) {
          const block = m[1]
          const f = (t) => { const x = block.match(new RegExp(`<${t}>(.*?)<\/${t}>`)); return x ? x[1] : '' }
          items.push({
            routeName:     f('routeName'),
            predictTime1:  f('predictTime1'),
            predictTime2:  f('predictTime2'),
            lowPlate1:     f('lowPlate1'),
            lowPlate2:     f('lowPlate2'),
            remainSeatCnt1: f('remainSeatCnt1'),
          })
        }
        return items
      }
      const resultCode = getTag('resultCode')
      const resultMsg  = getTag('resultMessage') || getTag('resultMsg')
      let items = getAllItems()
      if (routes.length > 0) {
        items = items.filter(i => routes.includes(String(i.routeName).trim()))
      }
      return res.status(200).json({
        response: {
          msgHeader: { resultCode, resultMessage: resultMsg },
          msgBody: { busArrivalList: items },
        },
        _raw: xml.length > 2000 ? xml.slice(0, 2000) + '...' : xml,
      })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  // ── 모드: 에어코리아 미세먼지 조회 (?mode=dust&station=부천)
  if (mode === 'dust') {
    const station = req.query.station || '부천'
    const url = 'https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty' +
      `?serviceKey=${encodeURIComponent(KEY)}&stationName=${encodeURIComponent(station)}` +
      `&dataTerm=DAILY&pageNo=1&numOfRows=1&returnType=json&ver=1.3`
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (!r.ok) return res.status(502).json({ error: `upstream ${r.status}` })
      const data = await r.json()
      return res.status(200).json(data)
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
  }

  // ── 모드: ARS번호로 정류소 ID 조회 (?mode=ars&arsId=12139)
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

  // ── 모드: 노선 정류소 목록 조회 (?mode=route-stations&routeId=210000049)
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

  // ── 기본: v2 내부 stationId로 도착정보 조회 (?stationId=228001129&routes=56-1)
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
