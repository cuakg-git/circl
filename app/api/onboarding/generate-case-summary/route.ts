import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token ?? '')
    if (authErr || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { case_id, case_type, description, members, chat_messages } = await req.json()

    if (!case_id || !case_type || !description) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
    }

    // Construir el contexto
    const membersText = (members && Array.isArray(members) && members.length > 0)
      ? members.map((m: { name: string; relationship?: string | null }) =>
          `- ${m.name}${m.relationship ? ` (${m.relationship})` : ''}`
        ).join('\n')
      : 'Sin personas registradas todavía'

    const chatText = (chat_messages && Array.isArray(chat_messages) && chat_messages.length > 0)
      ? chat_messages
          .map((m: { from: string; text: string }) => `${m.from === 'user' ? 'Usuario' : 'Mhiru'}: ${m.text}`)
          .join('\n')
      : 'Sin diálogo adicional'

    const systemPrompt = `Sos Mhiru. Tu tarea es generar un resumen
contextual de la situación que el usuario está atravesando.

REGLAS DE VOZ Y TONO:
- Serena, no solemne. Hablás al lado, no desde arriba.
- Directa, no fría. Claridad como forma de cuidado.
- Humana, no emotiva. No nombrés el dolor, reconocelo implícitamente.
- Verbos activos. Sin metáforas de viaje o batalla.
- Voseo rioplatense.
- Prohibido: "comunidad", "familia", "guerrero".

FORMATO DEL RESUMEN:
- Tercera persona desde la mirada de Mhiru sobre el usuario
- Entre 2 y 4 oraciones
- Capturar: qué está pasando, quién está involucrado, qué necesita el usuario
- Sin listas, sin formato markdown, solo prosa fluida
- Devolvé SOLO el resumen, nada más`

    const userMessage = `Tipo de tema: ${case_type === 'own' ? 'propio' : 'compartido'}

Situación descrita por el usuario:
${description}

Personas involucradas:
${membersText}

Conversación adicional con Mhiru:
${chatText}

Generá el resumen contextual.`

    const response = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userMessage }],
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textBlock = response.content?.find((b: any) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Sin respuesta')
    }

    const summary = textBlock.text.trim()

    // Actualizar en la tabla correspondiente
    const table      = case_type === 'own' ? 'cases' : 'shared_cases'
    const matchField = case_type === 'own' ? 'user_id' : 'created_by'

    const { error: updateErr } = await supabase
      .from(table)
      .update({ ai_summary: summary })
      .eq('id', case_id)
      .eq(matchField, user.id)

    if (updateErr) {
      return NextResponse.json(
        { error: updateErr.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ summary })

  } catch (err: unknown) {
    console.error('[generate-case-summary]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    )
  }
}
