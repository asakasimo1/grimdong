export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { prompt, imageB64 } = req.body
  if (!prompt) return res.status(400).json({ error: 'prompt required' })

  // img2img: FLUX.1-schnell에 이미지 + 프롬프트 전달
  const body = { inputs: prompt, parameters: { num_inference_steps: 4 } }

  const hfRes = await fetch(
    'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VITE_HF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )

  if (!hfRes.ok) {
    const text = await hfRes.text()
    return res.status(hfRes.status).json({ error: text.slice(0, 200) })
  }

  const buffer = await hfRes.arrayBuffer()
  res.setHeader('Content-Type', 'image/jpeg')
  res.setHeader('Cache-Control', 'no-store')
  res.send(Buffer.from(buffer))
}
