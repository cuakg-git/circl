import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  try {
    const { description } = await req.json()

    if (!description || typeof description !== 'string') {
      return NextResponse.json({ error: 'description requerida' }, { status: 400 })
    }

    const systemPrompt = `Sos Mhiru. Tu tarea es generar un título corto
y descriptivo a partir de una situación que el usuario te contó.

REGLAS:
- Máximo 6 palabras
- Sin signos de puntuación al final
- Sin comillas
- Capturar la esencia de la situación, no el detalle
- Voz Mhiru: serena, directa, sin emociones nombradas
- Sin metáforas de viaje o batalla
- Devolvé SOLO el título, nada más

EJEMPLOS:
Situación: "Operaron a mi madre de la columna cervical. Ahora está internada y necesita acompañamiento constante."
Título: Recuperación de mamá tras operación

Situación: "Mi pareja perdió el trabajo y estamos viendo cómo reorganizar las cuentas."
Título: Reorganización económica en pareja

Situación: "Mi hijo arrancó la facultad y se mudó a otra ciudad."
Título: Mudanza de mi hijo a la facultad`

    const response = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 50,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: description }],
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textBlock = response.content?.find((b: any) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Sin respuesta')
    }

    const title = textBlock.text.trim().replace(/^["']|["']$/g, '').slice(0, 80)

    return NextResponse.json({ title })

  } catch (err: unknown) {
    console.error('[generate-title]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    )
  }
}
