import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const MODEL_NAME = 'claude-haiku-4-5-20251001'

const SYSTEM_PROMPT = `# QUIÉN SOS

Sos el agente de autoconocimiento de Mhiru. Tu trabajo es
ayudar al usuario a construir un retrato de sí mismo a partir
de preguntas cortas y reflexivas. Esa info la usará el sistema
para personalizar la experiencia y entender mejor quién es
el usuario y cómo se autopercibe.

Hablás español rioplatense: usás "vos", "podés", "tenés",
"acá". Tono cálido, cercano, breve. Nunca formal ni distante.
Las preguntas deben sonar naturales, como en una conversación
real.

# CÓMO TRABAJÁS

En cada turno recibís:
- El nombre del usuario.
- El identity actual (lo que ya sabés de quién es).
- La pregunta que se le hizo al usuario.
- La respuesta del usuario.
- El número de turno actual (1, 2 o 3).

Tu output es SIEMPRE un JSON con esta forma exacta,
sin texto antes ni después, sin markdown, sin code fences:

{
  "new_identity": "Retrato actualizado en 2-4 oraciones",
  "next_question": "Próxima pregunta, o null si ya terminaste",
  "suggestions": ["sugerencia 1", "sugerencia 2", "sugerencia 3"]
}

# REGLAS DEL new_identity

- 2-4 oraciones en segunda persona, hablándole directamente
  al usuario.
- Capturá quién es, cómo se autopercibe, qué lo define.
- Usá "Sos...", "Te caracterizás por...", "Trabajás en...",
  "Tenés..." etc.
- Integrá lo nuevo con lo viejo. Reescribilo desde cero.
- Sin saltos de línea. Un párrafo continuo.
- No inventes nada que el usuario no haya dicho.

# REGLAS DE next_question

- Una sola pregunta, corta, humana y directa.
- Preguntá sobre situaciones concretas, no sobre
  identidad abstracta. Ejemplos del estilo correcto:
  "¿Con quién pasás más tiempo últimamente?",
  "¿Qué estás haciendo cuando te sentís bien?",
  "¿Qué fue lo último que te sacó una sonrisa?",
  "¿Cómo arrancó tu semana?",
  "¿Hay algo que te esté ocupando la cabeza estos días?"
- Nunca preguntes "¿quién sos?" ni "¿cómo te describirías?"
  ni nada que suene a una entrevista de trabajo o terapia.
- Que suene como algo que te preguntaría un amigo cercano.
- No repitas preguntas ya respondidas.
- Si ya estás en el turno 3, devolvé null.
- Si ya tenés suficiente para un retrato rico, devolvé null.

# REGLAS DE suggestions

- 3 sugerencias breves (máximo 6 palabras).
- Diversas y plausibles como respuestas a next_question.
- En primera persona del usuario.
- Sin puntuación al final.
- Si next_question es null, devolvé suggestions: [].

# IMPORTANTE

- Máximo 3 turnos en total.
- Tu respuesta debe ser SOLO el JSON. Sin texto antes ni después.`

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const supabase  = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

function esc(text: string | null | undefined): string {
  if (!text) return ''
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export async function POST(request: Request) {
  try {
    // ── Auth ──────────────────────────────────────────────────────
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') ?? ''
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { current_question, user_response, turn } = body || {}

    if (!current_question || !user_response) {
      return Response.json(
        { error: 'Faltan current_question o user_response' },
        { status: 400 }
      )
    }

    const currentTurn = typeof turn === 'number' ? turn : 1

    // ── Leer contexto actual ──────────────────────────────────────
    const [profileRes, ctxRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('user_context')
        .select('identity')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    const userName        = profileRes.data?.full_name ?? user.email ?? 'el usuario'
    const currentIdentity = ctxRes.data?.identity ?? '(sin datos todavía)'

    // ── Construir mensaje ─────────────────────────────────────────
    const userMessage = `<contexto>
  <usuario>${esc(userName)}</usuario>
  <identity_actual>${esc(currentIdentity)}</identity_actual>
  <turno_actual>${currentTurn} de 3</turno_actual>
</contexto>

Pregunta hecha al usuario: "${esc(current_question)}"
Respuesta del usuario: "${esc(user_response)}"

Devolvé el JSON con new_identity, next_question y suggestions.`

    // ── Llamar a Claude ───────────────────────────────────────────
    const response = await anthropic.messages.create({
      model:      MODEL_NAME,
      max_tokens: 500,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: userMessage }],
    })

    const textBlock = response.content?.find((b: any) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Claude no devolvió texto')
    }

    // ── Parsear JSON ──────────────────────────────────────────────
    let parsed: {
      new_identity?:  string
      next_question?: string | null
      suggestions?:   string[]
    }

    try {
      const raw       = textBlock.text
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      const cleaned   = jsonMatch ? jsonMatch[0].trim() : raw.trim()
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('[user-context/chat] error parseando JSON:', textBlock.text)
      return Response.json(
        { error: 'El agente no devolvió un JSON válido.' },
        { status: 500 }
      )
    }

    const { new_identity, next_question, suggestions } = parsed

    if (!new_identity) {
      return Response.json(
        { error: 'Respuesta incompleta del agente.' },
        { status: 500 }
      )
    }

    // ── Persistir identity en user_context ────────────────────────
    const { error: upsertErr } = await supabase
      .from('user_context')
      .upsert({
        user_id:       user.id,
        identity:      new_identity,
        last_regen_at: new Date().toISOString(),
      })

    if (upsertErr) {
      console.error('[user-context/chat] upsert error:', upsertErr)
      return Response.json(
        { error: upsertErr.message ?? 'Error al guardar contexto' },
        { status: 500 }
      )
    }

    // ── Respuesta ─────────────────────────────────────────────────
    return Response.json({
      new_identity,
      next_question:  next_question  ?? null,
      suggestions:    Array.isArray(suggestions) ? suggestions : [],
    })

  } catch (err: any) {
    console.error('[user-context/chat] error:', err)
    return Response.json(
      { error: err?.message ?? 'Error interno' },
      { status: 500 }
    )
  }
}
