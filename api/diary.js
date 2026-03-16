// Vercel 서버리스 함수 — fal.ai 일기 이미지 생성 프록시
// 레퍼런스 사진 있음: FLUX.1 Kontext [dev] (image-to-image)
// 레퍼런스 없음:      FLUX.2 [dev]        (text-to-image)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  const FAL_KEY = process.env.FAL_API_KEY
  if (!FAL_KEY) return res.status(500).json({ error: 'FAL_API_KEY not configured' })

  const { imagePrompt, referenceUrl } = req.body ?? {}
  if (!imagePrompt) return res.status(400).json({ error: 'imagePrompt required' })

  try {
    let endpoint, body

    if (referenceUrl) {
      // FLUX.1 Kontext [dev] — 레퍼런스 사진 기반, 지브리 스타일 변환
      // 실제 인물 외모를 유지하면서 지브리 스타일 적용
      const kontextPrompt = `Convert the person in the reference photo into Studio Ghibli anime style. Preserve the person's facial features, hair color, and overall appearance as closely as possible. Scene: ${imagePrompt} Apply Ghibli characteristic soft warm colors, painterly backgrounds, Hayao Miyazaki aesthetic. Child-friendly, safe for all ages, no violence.`
      endpoint = 'https://fal.run/fal-ai/flux-kontext/dev'
      body = {
        prompt: kontextPrompt,
        image_url: referenceUrl,
        num_images: 1,
        output_format: 'jpeg',
        num_inference_steps: 28,
      }
    } else {
      // FLUX.2 [dev] — 텍스트만으로 지브리 스타일 생성
      const textPrompt = `Studio Ghibli anime illustration style. ${imagePrompt} Soft warm colors, painterly backgrounds, Hayao Miyazaki aesthetic, child-friendly, safe for all ages, no violence, no adult content.`
      endpoint = 'https://fal.run/fal-ai/flux-2'
      body = {
        prompt: textPrompt,
        image_size: 'square_hd',
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
      console.error('[fal.ai diary error]', falRes.status, JSON.stringify(falData))
      throw new Error(falData.detail || falData.message || falData.error || `fal.ai ${falRes.status}`)
    }

    const imgUrl = falData.images?.[0]?.url
    if (!imgUrl) throw new Error('NO_IMAGE')

    const imgRes = await fetch(imgUrl)
    const imgBuffer = await imgRes.arrayBuffer()
    const b64 = Buffer.from(imgBuffer).toString('base64')
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg'

    res.status(200).json({ imageData: `data:${contentType};base64,${b64}` })
  } catch (err) {
    console.error('[diary generate error]', err.message)
    res.status(500).json({ error: err.message })
  }
}
