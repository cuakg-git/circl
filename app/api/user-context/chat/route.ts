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

const CIRCLE_SYSTEM_PROMPT = `# QUIÉN SOS

Sos el agente de contexto de Mhiru. Tu trabajo es ayudar
al usuario a construir un retrato narrativo de su círculo
de personas: quiénes son las personas más importantes en
su vida, cómo se sienten, qué está pasando con ellas.

Hablás español rioplatense: usás "vos", "podés", "tenés",
"acá". Tono cálido, cercano, breve. Nunca formal ni distante.
Las preguntas deben sonar naturales, como en una conversación
real.

# CÓMO TRABAJÁS

En cada turno recibís:
- El nombre del usuario.
- El circle_summary actual (lo que ya sabés del círculo).
- Las personas que ya están en el círculo del usuario.
- La pregunta que se le hizo al usuario.
- La respuesta del usuario.
- El número de turno actual (1, 2 o 3).

Tu output es SIEMPRE un JSON con esta forma exacta,
sin texto antes ni después, sin markdown, sin code fences:

{
  "new_summary": "Retrato actualizado del círculo en 2-4 oraciones",
  "next_question": "Próxima pregunta, o null si ya terminaste",
  "suggestions": ["sugerencia 1", "sugerencia 2", "sugerencia 3"]
}

# REGLAS DEL new_summary

- 2-4 oraciones en tercera persona, describiendo el círculo
  del usuario como un narrador externo.
- Capturá quiénes son las personas clave, cómo está la
  dinámica, qué está pasando con ellas.
- Integrá lo nuevo con lo viejo. Reescribilo desde cero.
- Sin saltos de línea. Un párrafo continuo.
- No inventes nombres ni datos que el usuario no haya dicho.

# REGLAS DE next_question

- Una sola pregunta, corta, humana y directa.
- Preguntá sobre situaciones concretas del círculo, no
  abstractas. Ejemplos:
  "¿Cómo está [nombre] con todo esto?",
  "¿Con quién estás coordinando más estos días?",
  "¿Hay alguien que esté necesitando más apoyo ahora?"
- Nunca preguntes "¿quién es importante para vos?" o cosas
  abstractas que suenen a terapia.
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

const THEMES_SYSTEM_PROMPT = `# QUIÉN SOS

Sos el agente de contexto de Mhiru. Tu trabajo es ayudar
al usuario a construir un retrato narrativo de sus temas:
las situaciones que está atravesando, los proyectos que
tiene en marcha, las cosas que le ocupan la cabeza.

Hablás español rioplatense: usás "vos", "podés", "tenés",
"acá". Tono cálido, cercano, breve. Nunca formal ni distante.
Las preguntas deben sonar naturales, como en una conversación
real.

# CÓMO TRABAJÁS

En cada turno recibís:
- El nombre del usuario.
- El themes_summary actual (lo que ya sabés de sus temas).
- La lista de temas que el usuario tiene registrados (propios
  y compartidos).
- La pregunta que se le hizo al usuario.
- La respuesta del usuario.
- El número de turno actual (1, 2 o 3).

Tu output es SIEMPRE un JSON con esta forma exacta,
sin texto antes ni después, sin markdown, sin code fences:

{
  "new_summary": "Retrato actualizado de sus temas en 2-4 oraciones",
  "next_question": "Próxima pregunta, o null si ya terminaste",
  "suggestions": ["sugerencia 1", "sugerencia 2", "sugerencia 3"]
}

# REGLAS DEL new_summary

- 2-4 oraciones en tercera persona, describiendo los temas
  del usuario como un narrador externo.
- Capturá qué temas están activos, cuáles son los más
  importantes, qué está pasando con ellos.
- Integrá lo nuevo con lo viejo. Reescribilo desde cero.
- Sin saltos de línea. Un párrafo continuo.
- No inventes temas ni datos que el usuario no haya dicho.

# REGLAS DE next_question

- Una sola pregunta, corta, humana y directa.
- Preguntá sobre situaciones concretas de los temas, no
  abstractas. Ejemplos:
  "¿Cómo viene [nombre del tema]?",
  "¿Hay algo nuevo en [tema] que quieras anotar?",
  "¿Cuál de estos temas te está demandando más energía?"
- Nunca preguntes "¿qué temas tenés?" o cosas que ya están
  en el contexto.
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
    const { current_question, user_response, turn, dimension } = body || {}

    if (!current_question || !user_response) {
      return Response.json(
        { error: 'Faltan current_question o user_response' },
        { status: 400 }
      )
    }

    const currentTurn = typeof turn === 'number' ? turn : 1
    const dim = dimension === 'circle_summary' ? 'circle_summary'
              : dimension === 'themes_summary' ? 'themes_summary'
              : 'identity'

    // ════════════════════════════════════════════════════════════════
    // RAMA: themes_summary
    // ════════════════════════════════════════════════════════════════
    if (dim === 'themes_summary') {
      const [profileRes, ctxRes, casesRes, sharedRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('user_context')
          .select('themes_summary')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('cases')
          .select('name, description, status, ai_summary')
          .eq('user_id', user.id)
          .order('started_at', { ascending: false })
          .limit(20),
        supabase
          .from('shared_case_members')
          .select('shared_case_id')
          .eq('user_id', user.id)
          .eq('status', 'active'),
      ])

      const userName       = profileRes.data?.full_name ?? user.email ?? 'el usuario'
      const currentSummary = ctxRes.data?.themes_summary ?? '(sin datos todavía)'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cases          = (casesRes.data ?? []) as any[]

      // Resolve shared cases
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sharedIds = (sharedRes.data ?? []).map((r: any) => r.shared_case_id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let sharedCases: any[] = []
      if (sharedIds.length > 0) {
        const { data: scData } = await supabase
          .from('shared_cases')
          .select('name, description, status, ai_summary')
          .in('id', sharedIds)
        sharedCases = scData ?? []
      }

      const ownList = cases.length > 0
        ? cases.map((c) =>
            `- [propio] ${c.name}${c.ai_summary ? ` — ${c.ai_summary.slice(0, 200)}` : ''}`
          ).join('\n')
        : '(sin temas propios)'

      const sharedList = sharedCases.length > 0
        ? sharedCases.map((c) =>
            `- [compartido] ${c.name}${c.ai_summary ? ` — ${c.ai_summary.slice(0, 200)}` : ''}`
          ).join('\n')
        : '(sin temas compartidos)'

      const userMessage = `<contexto>
  <usuario>${esc(userName)}</usuario>
  <themes_summary_actual>${esc(currentSummary)}</themes_summary_actual>
  <temas_propios>
${esc(ownList)}
  </temas_propios>
  <temas_compartidos>
${esc(sharedList)}
  </temas_compartidos>
  <turno_actual>${currentTurn} de 3</turno_actual>
</contexto>

Pregunta hecha al usuario: "${esc(current_question)}"
Respuesta del usuario: "${esc(user_response)}"

Devolvé el JSON con new_summary, next_question y suggestions.`

      const response = await anthropic.messages.create({
        model:      MODEL_NAME,
        max_tokens: 500,
        system:     THEMES_SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: userMessage }],
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const textBlock = response.content?.find((b: any) => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('Claude no devolvió texto')
      }

      let parsed: {
        new_summary?:   string
        next_question?: string | null
        suggestions?:   string[]
      }

      try {
        const raw       = textBlock.text
        const jsonMatch = raw.match(/\{[\s\S]*\}/)
        const cleaned   = jsonMatch ? jsonMatch[0].trim() : raw.trim()
        parsed = JSON.parse(cleaned)
      } catch {
        console.error('[user-context/chat:themes] error parseando JSON:', textBlock.text)
        return Response.json(
          { error: 'El agente no devolvió un JSON válido.' },
          { status: 500 }
        )
      }

      const { new_summary, next_question, suggestions } = parsed

      if (!new_summary) {
        return Response.json(
          { error: 'Respuesta incompleta del agente.' },
          { status: 500 }
        )
      }

      const { error: upsertErr } = await supabase
        .from('user_context')
        .upsert({
          user_id:        user.id,
          themes_summary: new_summary,
          last_regen_at:  new Date().toISOString(),
        })

      if (upsertErr) {
        console.error('[user-context/chat:themes] upsert error:', upsertErr)
        return Response.json(
          { error: upsertErr.message ?? 'Error al guardar contexto' },
          { status: 500 }
        )
      }

      return Response.json({
        new_summary,
        next_question: next_question ?? null,
        suggestions:   Array.isArray(suggestions) ? suggestions : [],
      })
    }

    // ════════════════════════════════════════════════════════════════
    // RAMA: circle_summary
    // ════════════════════════════════════════════════════════════════
    if (dim === 'circle_summary') {
      const [profileRes, ctxRes, contactsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('user_context')
          .select('circle_summary')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('contacts')
          .select('name, relationship, proximity, role')
          .eq('user_id', user.id)
          .order('sort_order', { ascending: true, nullsFirst: false })
          .limit(30),
      ])

      const userName       = profileRes.data?.full_name ?? user.email ?? 'el usuario'
      const currentSummary = ctxRes.data?.circle_summary ?? '(sin datos todavía)'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contacts       = (contactsRes.data ?? []) as any[]
      const contactsList   = contacts.length > 0
        ? contacts.map((c) =>
            `- ${c.name}${c.relationship ? ` (${c.relationship})` : ''}${c.proximity ? ` [${c.proximity}]` : ''}`
          ).join('\n')
        : '(sin personas registradas)'

      const userMessage = `<contexto>
  <usuario>${esc(userName)}</usuario>
  <circle_summary_actual>${esc(currentSummary)}</circle_summary_actual>
  <personas_en_circulo>
${esc(contactsList)}
  </personas_en_circulo>
  <turno_actual>${currentTurn} de 3</turno_actual>
</contexto>

Pregunta hecha al usuario: "${esc(current_question)}"
Respuesta del usuario: "${esc(user_response)}"

Devolvé el JSON con new_summary, next_question y suggestions.`

      const response = await anthropic.messages.create({
        model:      MODEL_NAME,
        max_tokens: 500,
        system:     CIRCLE_SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: userMessage }],
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const textBlock = response.content?.find((b: any) => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('Claude no devolvió texto')
      }

      let parsed: {
        new_summary?:   string
        next_question?: string | null
        suggestions?:   string[]
      }

      try {
        const raw       = textBlock.text
        const jsonMatch = raw.match(/\{[\s\S]*\}/)
        const cleaned   = jsonMatch ? jsonMatch[0].trim() : raw.trim()
        parsed = JSON.parse(cleaned)
      } catch {
        console.error('[user-context/chat:circle] error parseando JSON:', textBlock.text)
        return Response.json(
          { error: 'El agente no devolvió un JSON válido.' },
          { status: 500 }
        )
      }

      const { new_summary, next_question, suggestions } = parsed

      if (!new_summary) {
        return Response.json(
          { error: 'Respuesta incompleta del agente.' },
          { status: 500 }
        )
      }

      const { error: upsertErr } = await supabase
        .from('user_context')
        .upsert({
          user_id:        user.id,
          circle_summary: new_summary,
          last_regen_at:  new Date().toISOString(),
        })

      if (upsertErr) {
        console.error('[user-context/chat:circle] upsert error:', upsertErr)
        return Response.json(
          { error: upsertErr.message ?? 'Error al guardar contexto' },
          { status: 500 }
        )
      }

      return Response.json({
        new_summary,
        next_question: next_question ?? null,
        suggestions:   Array.isArray(suggestions) ? suggestions : [],
      })
    }

    // ════════════════════════════════════════════════════════════════
    // RAMA: identity (comportamiento ORIGINAL — NO TOCAR LÓGICA)
    // ════════════════════════════════════════════════════════════════

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  } catch (err: unknown) {
    console.error('[user-context/chat] error:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    )
  }
}
