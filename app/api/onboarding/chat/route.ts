import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const supabase  = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { user_id, message, step, context, crisis, circle } = body

    if (!user_id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Traer contexto del usuario si existe
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user_id)
      .maybeSingle()

    const firstName = profile?.full_name?.split(' ')[0] ?? 'vos'

    const contextBlock = [
      crisis  ? `Situación que describió el usuario: "${crisis}"` : null,
      circle  ? `Personas en su círculo: ${circle}` : null,
    ].filter(Boolean).join('\n')

    const systemPrompt = `Sos Mhiru, un asistente que ayuda a coordinar situaciones de salud.
Estás conociendo a ${firstName} en su primer contacto con la plataforma.
${contextBlock ? `\nCONTEXTO DEL USUARIO:\n${contextBlock}\n` : ''}

VOZ Y TONO — reglas no negociables:
- Presencia tranquila. No inspirás, no emocionás: aliviás.
- Serena, no solemne. Hablás al lado, no desde arriba.
- Directa, no fría. La claridad es una forma de cuidado.
- Humana, no emotiva. No nombrés el dolor, reconocelo implícitamente y actuá.
- Presente, no intrusiva. Decís lo necesario y te corrés.
- Verbos activos, sujeto Mhiru. Hacés cosas, no las sugerís.
- Oraciones cortas. Máximo 2 oraciones por respuesta.
- Cero metáforas de viaje o batalla: nada de "camino", "lucha", "proceso".
- No nombres la emoción: no digas "entendemos tu angustia". Decí lo que ya está resuelto o lo que vas a hacer.
- Palabras prohibidas: "comunidad", "familia", "guerrero".
- Voseo rioplatense siempre. Nunca "usted".
- Prueba interna: ¿lo diría alguien de confianza a las 2AM cuando estoy agotado? Si no, reescribilo.

Tu objetivo ahora: conocer mejor la situación de ${firstName} para poder ayudarlo a coordinar.
Hacé preguntas concretas sobre qué está pasando, quién está involucrado, qué necesita resolver.

Devolvé SIEMPRE este JSON exacto, sin markdown ni texto extra:
{"reply": "tu respuesta aquí", "suggestions": ["opción 1", "opción 2", "opción 3"]}
Las suggestions son respuestas cortas que ${firstName} podría dar (máx 6 palabras cada una).`

    const userMessage = context
      ? `Contexto previo: ${context}\n\nMensaje del usuario: ${message}`
      : message

    const response = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userMessage }],
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textBlock = response.content?.find((b: any) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Sin respuesta')
    }

    const raw = textBlock.text.trim()

    // Extraer JSON — buscar el primer { y el último }
    const start = raw.indexOf('{')
    const end   = raw.lastIndexOf('}')

    if (start === -1 || end === -1) {
      return NextResponse.json({
        reply:       raw,
        suggestions: [],
      })
    }

    const jsonStr = raw.slice(start, end + 1)

    try {
      const parsed = JSON.parse(jsonStr)
      return NextResponse.json({
        reply:       parsed.reply       ?? raw,
        suggestions: parsed.suggestions ?? [],
      })
    } catch {
      return NextResponse.json({
        reply:       raw,
        suggestions: [],
      })
    }

  } catch (err: unknown) {
    console.error('[onboarding/chat]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    )
  }
}
