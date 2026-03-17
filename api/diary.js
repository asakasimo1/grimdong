// Vercel 서버리스 함수 — fal.ai 일기 이미지 생성 프록시
// 인물 1명:  FLUX.1 Kontext [dev]           (image-to-image, 단일 참조)
// 인물 2명+: FLUX.1 Kontext [max] multi      (image_urls 배열, 다중 인물 보존)
// 장소만:    FLUX.1 Kontext [dev]            (배경 분위기 참조)
// 참조 없음: FLUX.2 [dev]                   (text-to-image)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  const FAL_KEY = process.env.FAL_API_KEY
  if (!FAL_KEY) return res.status(500).json({ error: 'FAL_API_KEY not configured' })

  const { imagePrompt, referenceUrls, referenceLabels, referenceUrl, placePhotoUrl } = req.body ?? {}
  if (!imagePrompt) return res.status(400).json({ error: 'imagePrompt required' })

  // referenceUrls(배열) 우선, 없으면 레거시 referenceUrl 단일값 사용
  const personRefs   = (referenceUrls?.length > 0) ? referenceUrls : (referenceUrl ? [referenceUrl] : [])
  const personLabels = referenceLabels ?? []
  const placeRef     = placePhotoUrl || null

  try {
    let endpoint, body

    if (personRefs.length > 1) {
      // ── 다중 인물: FLUX.1 Kontext [max] multi ──────────────────────────────
      const labelDesc = personRefs
        .map((_, i) => `reference photo ${i + 1} shows ${personLabels[i] || 'a person'}`)
        .join(', ')
      const placeHint = placeRef
        ? ` The background should reference the atmosphere and spatial layout of the place shown in the scene.`
        : ''
      const multiPrompt = `Convert the people from the reference photos into Studio Ghibli anime style. ${labelDesc}. Preserve each person's facial features, hair color, and overall appearance as closely as possible. Scene: ${imagePrompt}${placeHint} Apply Ghibli characteristic soft warm colors, painterly backgrounds, Hayao Miyazaki aesthetic. Child-friendly, safe for all ages, no violence.`

      endpoint = 'https://fal.run/fal-ai/flux-pro/kontext/max/multi'
      // 장소 사진이 있으면 image_urls 뒤에 추가 (배경 참조)
      const imageUrls = placeRef ? [...personRefs, placeRef] : personRefs
      body = {
        prompt: multiPrompt,
        image_urls: imageUrls,
        num_images: 1,
        output_format: 'jpeg',
        guidance_scale: 3.5,
      }
    } else if (personRefs.length === 1) {
      // ── 인물 1명: FLUX.1 Kontext [dev] ────────────────────────────────────
      const placeHint = placeRef
        ? ` The background/setting should reference the uploaded place photo's atmosphere and spatial layout.`
        : ''
      const kontextPrompt = `Convert the person in the reference photo into Studio Ghibli anime style. Preserve the person's facial features, hair color, and overall appearance as closely as possible. Scene: ${imagePrompt}${placeHint} Apply Ghibli characteristic soft warm colors, painterly backgrounds, Hayao Miyazaki aesthetic. Child-friendly, safe for all ages, no violence.`
      endpoint = 'https://fal.run/fal-ai/flux-kontext/dev'
      body = {
        prompt: kontextPrompt,
        image_url: personRefs[0],
        num_images: 1,
        output_format: 'jpeg',
        num_inference_steps: 28,
      }
    } else if (placeRef) {
      // ── 장소 사진만: FLUX.1 Kontext [dev] ─────────────────────────────────
      const kontextPrompt = `Using the reference photo as the background setting, create a Studio Ghibli anime style illustration. Scene: ${imagePrompt} Preserve the overall atmosphere, spatial layout, and key elements of the place in the reference photo, but render everything in Ghibli's soft warm colors and painterly style. Hayao Miyazaki aesthetic. Child-friendly, safe for all ages, no violence.`
      endpoint = 'https://fal.run/fal-ai/flux-kontext/dev'
      body = {
        prompt: kontextPrompt,
        image_url: placeRef,
        num_images: 1,
        output_format: 'jpeg',
        num_inference_steps: 28,
      }
    } else {
      // ── 참조 없음: FLUX.2 [dev] ────────────────────────────────────────────
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

    const imgRes    = await fetch(imgUrl)
    const imgBuffer = await imgRes.arrayBuffer()
    const b64       = Buffer.from(imgBuffer).toString('base64')
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg'

    res.status(200).json({ imageData: `data:${contentType};base64,${b64}` })
  } catch (err) {
    console.error('[diary generate error]', err.message)
    res.status(500).json({ error: err.message })
  }
}
