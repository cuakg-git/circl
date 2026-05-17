import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const MODEL_NAME = 'claude-sonnet-4-6'
const PRICE_INPUT_PER_MTOK = 3.0
const PRICE_OUTPUT_PER_MTOK = 15.0

const SYSTEM_PROMPT = `# QUIÉN SOS

Sos el agente de contexto de Mhiru. Tu trabajo es construir un
retrato rico y útil de cada persona del círculo del owner, a partir
de preguntas cortas. Esa info la va a usar el agente principal para
coordinar mejor la red de apoyo.

Hablás español rioplatense: usás "vos", "podés", "tenés",
"acá". Tono cálido, cercano, breve. Nunca formal ni distante.
Las preguntas y sugerencias deben sonar naturales, como las
diría una persona real en un mensaje de WhatsApp.

# CÓMO TRABAJÁS

En cada turno recibís:
- El nombre y datos básicos del contacto.
- El resumen actual (context_summary) y el retrato detallado
  (context_description) de lo que ya sabés.
- El resto del círculo del owner.
- La pregunta que se le hizo al owner.
- La respuesta del owner.

Tu output es SIEMPRE un JSON con esta forma exacta:

{
  "new_summary": "Resumen en 1-2 oraciones",
  "new_description": "Retrato detallado en 2-4 párrafos",
  "next_question": "Próxima pregunta, o null si ya tenés suficiente",
  "suggestions": ["sugerencia 1", "sugerencia 2", "sugerencia 3"]
}

# REGLAS DEL new_summary

- 1 párrafo de máximo 2-3 oraciones. Sin saltos de línea.
- Lo esencial para identificar a la persona y entender su rol
  en el círculo.
- En la voz del agente. Ejemplo: "Es el hermano mayor de Pato,
  viven en la misma ciudad y tiene rol logístico. Es alguien
  de confianza para tareas concretas y apoyo emocional."
- Integrá lo nuevo con lo viejo. Reescribilo desde cero.
- NUNCA uses saltos de línea dentro del summary. Es un único
  párrafo continuo.

# REGLAS DEL new_description

- 2-4 párrafos. Cada párrafo desarrolla un aspecto distinto.
- Aspectos sugeridos (usá los que apliquen según lo que sabés):
  1. Vínculo y historia: cómo se conocen, qué tipo de relación tienen.
  2. Contexto de vida: dónde vive, situación laboral/familiar,
     disponibilidad.
  3. Capacidad de ayuda: qué tipo de ayuda puede ofrecer, cómo
     activarla, qué cosas le quedan bien.
  4. Qué cuidar: temas sensibles, límites, cómo no activarla.
- En la voz del agente, tercera persona.
- Integrá lo nuevo con lo viejo. No copies lo anterior, reescribí
  desde cero combinando todo.
- Si todavía no sabés suficiente para un aspecto, omitilo.
  No inventes.

# REGLAS DE next_question

- Corta, una sola pregunta, sin signo de pregunta inicial.
- Que expanda lo que más le falta al retrato.
- No repitas preguntas ya respondidas.
- No preguntes datos que ya están en los datos básicos.
- Considerá el contexto del círculo para no preguntar redundancias.
- Si ya tenés suficiente (3-5 turnos), devolvé null.

Criterios para "suficiente":
- Sabés el vínculo emocional o historia
- Sabés qué tipo de ayuda puede ofrecer
- Sabés algo de su contexto de vida
- Sabés qué cuidar al activarla

# REGLAS DE suggestions

- 3 sugerencias breves (máximo 5-6 palabras).
- Diversas y plausibles como respuestas a next_question.
- En primera persona del owner.
- Sin puntuación al final.
- Si next_question es null, devolvé suggestions: [].

# IMPORTANTE

- Tu respuesta debe ser SOLO el JSON. Sin texto antes ni después.
  Sin markdown, sin code fences.`

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
)

export async function POST(request: Request) {
  const body = await request.json()
  const { user_id, contact_id, current_question, user_response } = body || {}

  if (!user_id || !contact_id || !current_question || !user_response) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id, name, relationship, role, proximity, context_summary, context_description, ctx_last_question, user_id')
      .eq('id', contact_id)
      .eq('user_id', user_id)
      .maybeSingle()
    if (contactError) throw contactError
    if (!contact) return Response.json({ error: 'Contacto no encontrado' }, { status: 404 })

    const { data: otherContacts } = await supabase
      .from('contacts')
      .select('name, relationship, role, proximity, context_summary')
      .eq('user_id', user_id)
      .neq('id', contact_id)

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user_id)
      .maybeSingle()

    const ownerName = profile?.full_name || 'el owner'

    const otrosContactosXml =
      !otherContacts || otherContacts.length === 0
        ? '  <otros_contactos>vacío</otros_contactos>'
        : `  <otros_contactos>\n${otherContacts.map((c) =>
            `    <contacto nombre="${esc(c.name)}" relacion="${esc(c.relationship || '')}" rol="${esc(c.role || '')}" proximidad="${esc(c.proximity || '')}">${esc(c.context_summary || '')}</contacto>`
          ).join('\n')}\n  </otros_contactos>`

    const userMessage = `<contexto>
  <owner>${esc(ownerName)}</owner>
  <contacto_objetivo>
    <nombre>${esc(contact.name)}</nombre>
    <relacion>${esc(contact.relationship || '')}</relacion>
    <rol>${esc(contact.role || '')}</rol>
    <proximidad>${esc(contact.proximity || '')}</proximidad>
    <context_summary_actual>${esc(contact.context_summary || '(vacío)')}</context_summary_actual>
    <context_description_actual>${esc(contact.context_description || '(vacío)')}</context_description_actual>
  </contacto_objetivo>
${otrosContactosXml}
</contexto>

Pregunta hecha al owner: "${current_question}"
Respuesta del owner: "${user_response}"

Devolvé el JSON con new_summary, next_question y suggestions.`

    const startTime = Date.now()
    const response = await anthropic.messages.create({
      model: MODEL_NAME,
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const textBlock = response.content?.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text' || !textBlock.text) {
      throw new Error('Claude no devolvió texto')
    }

    let parsed: {
      new_summary?: string
      new_description?: string
      next_question?: string | null
      suggestions?: string[]
    }
    try {
      const cleaned = textBlock.text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
      parsed = JSON.parse(cleaned)
    } catch (err) {
      console.error('[contact-context] error parseando JSON:', textBlock.text)
      return Response.json({ error: 'El agente no devolvió un JSON válido.' }, { status: 500 })
    }

    const { new_summary, new_description, next_question, suggestions } = parsed
    if (!new_summary) {
      return Response.json({ error: 'Respuesta incompleta del agente.' }, { status: 500 })
    }

    const { error: updateError } = await supabase
      .from('contacts')
      .update({
        context_summary:     new_summary,
        context_description: new_description || null,
        ctx_last_question:   next_question || null,
      })
      .eq('id', contact_id)
      .eq('user_id', user_id)
    if (updateError) throw updateError

    const latencyMs = Date.now() - startTime
    await supabase.from('logs').insert({
      profile_id: user_id,
      canal: 'web',
      modelo: MODEL_NAME,
      tokens_in: response.usage.input_tokens,
      tokens_out: response.usage.output_tokens,
      latencia_ms: latencyMs,
      costo_usd:
        (response.usage.input_tokens / 1_000_000) * PRICE_INPUT_PER_MTOK +
        (response.usage.output_tokens / 1_000_000) * PRICE_OUTPUT_PER_MTOK,
    })

    return Response.json({
      new_summary,
      new_description:   new_description || null,
      next_question:     next_question || null,
      suggestions:       Array.isArray(suggestions) ? suggestions : [],
    })
  } catch (error) {
    console.error('[contact-context] error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const contact_id = searchParams.get('contact_id')
  const user_id    = searchParams.get('user_id')

  if (!contact_id || !user_id) {
    return Response.json({ error: 'Missing contact_id or user_id' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('contacts')
    .select('ctx_last_question, context_summary, context_description')
    .eq('id', contact_id)
    .eq('user_id', user_id)
    .maybeSingle()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return Response.json({ error: 'Contacto no encontrado' }, { status: 404 })
  }

  return Response.json({
    ctx_last_question:   data.ctx_last_question || null,
    context_summary:     data.context_summary || null,
    context_description: data.context_description || null,
  })
}

function esc(text: string | null | undefined): string {
  if (text === null || text === undefined) return ''
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
