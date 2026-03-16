// Vercel 서버리스 함수 — fal.ai 이미지 생성 프록시
// draw  모드: FLUX.2 [dev]  (text-to-image)
// photo 모드: FLUX.1 Kontext [dev] (image-to-image)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  const FAL_KEY = process.env.FAL_API_KEY
  if (!FAL_KEY) return res.status(500).json({ error: 'FAL_API_KEY not configured' })

  const { mode, prompt, imageUrl } = req.body ?? {}
  if (!mode || !prompt) return res.status(400).json({ error: 'mode, prompt required' })

  try {
    let endpoint, body

    if (mode === 'draw') {
      // FLUX.2 [dev] — 텍스트로 이미지 생성
      endpoint = 'https://fal.run/fal-ai/flux-2'
      body = {
        prompt,
        image_size: 'square_hd',   // 1024×1024
        num_images: 1,
        output_format: 'jpeg',
        num_inference_steps: 28,
      }
    } else {
      // FLUX.1 Kontext [dev] — 이미지 편집 (원본 구도 유지)
      if (!imageUrl) return res.status(400).json({ error: 'imageUrl required for photo mode' })
      endpoint = 'https://fal.run/fal-ai/flux-kontext/dev'
      body = {
        prompt,
        image_url: imageUrl,       // base64 data URL 지원
        num_images: 1,
        output_format: 'jpeg',
        num_inference_steps: 28,
      }
    }

    const falRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const falData = await falRes.json()
    if (!falRes.ok) {
      console.error('[fal.ai error]', falRes.status, JSON.stringify(falData))
      throw new Error(falData.detail || falData.message || falData.error || `fal.ai ${falRes.status}`)
    }

    const imgUrl = falData.images?.[0]?.url
    if (!imgUrl) throw new Error('NO_IMAGE')

    // fal.ai 이미지 URL → base64 변환 (CORS 우회)
    const imgRes = await fetch(imgUrl)
    const imgBuffer = await imgRes.arrayBuffer()
    const b64 = Buffer.from(imgBuffer).toString('base64')
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg'

    res.status(200).json({ imageData: `data:${contentType};base64,${b64}` })
  } catch (err) {
    console.error('[fal.ai transform error]', err.message)
    res.status(500).json({ error: err.message })
  }
}
