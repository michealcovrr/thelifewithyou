import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

fal.config({ credentials: process.env.FAL_KEY })

export async function POST(req: NextRequest) {
  const { prompt, baseImageUrl } = await req.json()

  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
  }

  if (!process.env.FAL_KEY) {
    return NextResponse.json({ error: 'FAL_KEY not configured' }, { status: 500 })
  }

  try {
    // Use a minimal neutral base image — the model edits it according to the prompt
    const baseUrl = baseImageUrl || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=512&q=60'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await fal.subscribe('fal-ai/nano-banana-pro/edit', {
      input: {
        prompt: `Book cover design: ${prompt}. Professional, high-quality, print-ready portrait book cover with beautiful typography and composition.`,
        image_urls: [baseUrl],
        aspect_ratio: '2:3' as const,
        num_images: 1,
      } as never,
      logs: false,
    }) as { data: { images?: Array<{ url: string }> } }

    const url = result.data?.images?.[0]?.url
    if (!url) return NextResponse.json({ error: 'No image returned' }, { status: 500 })

    return NextResponse.json({ url })
  } catch (err: unknown) {
    console.error('fal.ai error:', err)
    const message = err instanceof Error ? err.message : 'Generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
