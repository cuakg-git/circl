import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const MODEL_NAME = 'claude-sonnet-4-6'
const PRICE_INPUT_PER_MTOK  = 3.0
const PRICE_OUTPUT_PER_MTOK = 15.0

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase  = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
)

const SYSTEM_PROMPT = `Sos un asistente de Mhiru que ayuda a mantener el contexto
de las tareas actualizado y conectado con las personas del círculo de apoyo.

Recibís los datos de una tarea, el contexto de la crisis, las personas del círculo,
y opcionalmente un mensaje del usuario con novedades sobre la tarea.

Tu output es SIEMPRE un JSON con esta forma exacta, sin texto antes ni después,
sin markdown, sin code fences:

{
  "context": "Párrafo breve (2-3 oraciones) que resume lo que Mhiru sabe sobre esta tarea. Si hay personas del círculo relevantes para esta tarea, mencionarlas. En la voz del agente, tercera persona, español rioplatense.",
  "next_question": "Pregunta corta de seguimiento para invitar al usuario a agregar más info sobre la tarea. Sin signo de pregunta inicial. Null si ya hay suficiente contexto.",
  "suggestions": ["sugerencia 1", "sugerencia 2", "sugerencia 3"],
  "suggested_assignee": {
    "name": "NombreExacto",
    "reason": "Máximo 2 oraciones explicando por qué esta persona es la más adecuada."
  },
  "suggested_topics": ["Tema1", "Tema2"],
  "field_updates": {}
}

Reglas de context:
- 2-3 oraciones. Concreto y útil.
- Si hay personas del círculo que puedan estar involucradas en esta tarea
  (por su rol, relación, o contexto), mencionarlas específicamente.
- Integrá la novedad del usuario si la hay.
- Reescribí desde cero integrando todo lo que sabés.

Reglas de next_question:
- Una sola pregunta corta, sin signo de pregunta inicial.
- Orientada a obtener info útil sobre la tarea: quién la hace, cuándo, si hay
  novedades, si alguien del círculo puede ayudar, etc.
- No repitas preguntas ya respondidas en el historial del chat.
- Si ya tenés suficiente contexto (3-4 turnos), devolvé null.

Reglas de suggestions:
- 3 sugerencias breves (máximo 5-6 palabras) como posibles respuestas a next_question.
- En primera persona del owner.
- Sin puntuación al final.
- Si next_question es null, devolvé [].

Reglas de suggested_assignee:
- UNA sola persona del círculo más adecuada para esta tarea.
- Considerá el contexto de cada persona del círculo (su rol, su relación,
  sus notas, su context_summary) y buscá match con la naturaleza de la tarea.
- Usar exactamente el nombre como aparece en el círculo.
- Si no hay candidato claro o la tarea ya tiene asignado, devolvé null.

Reglas de suggested_topics:
- 1-2 temas existentes que apliquen.
- Solo temas de la lista. Si ninguno aplica, devolvé [].
- Si la tarea ya tiene tema, devolvé [].

Reglas de field_updates:
- Si el mensaje del usuario menciona explícitamente un cambio en la fecha,
  el asignado, o el estado de la tarea, incluir el cambio en field_updates.
- Campos posibles:
  - due_date: string en formato YYYY-MM-DD o null
  - assigned_to_user: boolean
  - assigned_contact_name: string (nombre exacto del contacto) o null
  - status: "pendiente" o "completada"
- Solo incluir campos que el usuario haya mencionado explícitamente.
- Si no hay cambios de campos, devolvé {}.

Hablás en español rioplatense. Tono cálido, cercano, breve.
NUNCA inventés nombres de personas ni temas que no estén en el contexto.`

const SYSTEM_PROMPT_SUGGESTIONS_ONLY = `Sos un asistente de Mhiru que analiza tareas
y sugiere la mejor persona del círculo para realizarla, y los temas más relevantes.

Recibís los datos de una tarea con su contexto ya generado, el contexto de la crisis,
y el contexto detallado de cada persona del círculo de apoyo.

Tu trabajo es buscar match entre la tarea y las personas del círculo:
- Leé el contexto de la tarea con atención.
- Leé el rol, relación, notas y context_summary de cada persona del círculo.
- Buscá quién tiene más sentido para esta tarea específica.

Tu output es SIEMPRE un JSON con esta forma exacta, sin texto antes ni después,
sin markdown, sin code fences:

{
  "suggested_assignee": {
    "name": "NombreExacto",
    "reason": "Máximo 2 oraciones personalizadas explicando por qué esta persona específicamente es la más adecuada para esta tarea. Mencioná algo concreto de su contexto o rol que la conecta con la tarea."
  },
  "suggested_topics": ["Tema1"]
}

Reglas de suggested_assignee:
- UNA sola persona. La que tenga más match con la tarea.
- Considerá: rol (logístico/acompañamiento/profesional), relación con el owner,
  notas específicas, y context_summary si existe.
- Usá exactamente el nombre como aparece en el círculo.
- La razón debe ser PERSONALIZADA y CONCRETA — no genérica.
  MAL: "Podría ayudar con esta tarea."
  BIEN: "Belu es la mamá de Andina y ya acompañó en turnos anteriores,
         tiene disponibilidad y conoce al médico."
- Si la tarea ya tiene asignado, devolvé null.
- Si no hay ningún candidato claro, devolvé null.

Reglas de suggested_topics:
- 1-2 temas existentes que apliquen a esta tarea.
- Solo temas de la lista provista. Si ninguno aplica, devolvé [].
- Si la tarea ya tiene tema, devolvé [].

Hablás en español rioplatense.
NUNCA inventés nombres ni temas que no estén en el contexto.`

function esc(text: string | null | undefined): string {
  if (!text) return ''
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export async function POST(request: Request) {
  const body = await request.json()
  const { task_id, user_id, user_message, chat_history, suggestions_only } = body || {}

  if (!task_id || !user_id) {
    return Response.json({ error: 'Missing task_id or user_id' }, { status: 400 })
  }

  try {
    // 1. Cargar la tarea
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('id, title, description, status, due_date, assigned_contact_id, assigned_to_user, topic_id, crisis_id')
      .eq('id', task_id)
      .maybeSingle()

    if (taskError) throw taskError
    if (!task) return Response.json({ error: 'Tarea no encontrada' }, { status: 404 })

    // 2. Cargar crisis activa
    const { data: crisis } = await supabase
      .from('crises')
      .select('id, name, category, ai_summary, ai_next_step')
      .eq('id', task.crisis_id)
      .maybeSingle()

    // 3. Cargar contactos del círculo con context_summary
    const { data: crisisContacts } = await supabase
      .from('crisis_contacts')
      .select('contact:contacts(id, name, role, proximity, context_summary)')
      .eq('crisis_id', task.crisis_id)

    // 4. Cargar temas existentes de la crisis
    const { data: topics } = await supabase
      .from('topics')
      .select('id, name')
      .eq('crisis_id', task.crisis_id)
      .order('created_at', { ascending: true })

    // 5. Resolver nombre del asignado actual
    let assignedName = 'sin asignar'
    if (task.assigned_to_user) {
      assignedName = 'el owner'
    } else if (task.assigned_contact_id) {
      const assignedContact = (crisisContacts ?? [])
        .map((cc: any) => cc.contact)
        .find((c: any) => c?.id === task.assigned_contact_id)
      if (assignedContact) assignedName = assignedContact.name
    }

    // 6. Resolver nombre del tema actual
    let topicName = 'sin tema'
    if (task.topic_id) {
      const assignedTopic = (topics ?? []).find((t: any) => t.id === task.topic_id)
      if (assignedTopic) topicName = assignedTopic.name
    }

    // 7. Construir lista de contactos
    const contactsList = (crisisContacts ?? [])
      .map((cc: any) => {
        const c = cc.contact
        if (!c) return null
        return `- ${c.name} (${c.role ?? 'sin rol'}): ${c.context_summary ?? 'sin contexto'}`
      })
      .filter(Boolean)
      .join('\n')

    // 8. Construir lista de temas
    const topicsList = (topics ?? [])
      .map((t: any) => `- ${t.name}`)
      .join('\n')

    // 9. Construir el mensaje para Claude
    // En modo suggestions_only incluimos el contexto ya generado de la tarea
    const contextoTareaXml = suggestions_only && task.context
      ? `\n<contexto_tarea_generado>${esc(task.context)}</contexto_tarea_generado>`
      : ''

    // Construir historial del chat si existe
    const chatHistoryXml = chat_history && chat_history.length > 0
      ? `\n<historial_chat>\n${chat_history.map((m: { role: string; content: string }) =>
          `  <mensaje rol="${m.role}">${esc(m.content)}</mensaje>`
        ).join('\n')}\n</historial_chat>`
      : ''

    // Novedad del usuario si existe
    const userMessageXml = user_message
      ? `\n<novedad_del_usuario>${esc(user_message)}</novedad_del_usuario>`
      : ''

    const userMessage = `<contexto>
  <crisis>
    <nombre>${esc(crisis?.name)}</nombre>
    <categoria>${esc(crisis?.category)}</categoria>
    <resumen>${esc(crisis?.ai_summary)}</resumen>
    <proximo_paso>${esc(crisis?.ai_next_step)}</proximo_paso>
  </crisis>

  <circulo_de_apoyo>
${contactsList || '    (sin contactos en el círculo)'}
  </circulo_de_apoyo>

  <temas_existentes>
${topicsList || '    (sin temas creados)'}
  </temas_existentes>
</contexto>
${chatHistoryXml}
<tarea>
  <titulo>${esc(task.title)}</titulo>
  <descripcion>${esc(task.description)}</descripcion>
  <fecha_vencimiento>${esc(task.due_date)}</fecha_vencimiento>
  <asignada_a>${esc(assignedName)}</asignada_a>
  <tema_actual>${esc(topicName)}</tema_actual>
  <estado>${esc(task.status)}</estado>
</tarea>
${contextoTareaXml}
${userMessageXml}

${suggestions_only
  ? 'Analizá el match entre la tarea y las personas del círculo y devolvé el JSON.'
  : 'Analizá la tarea en el contexto de la crisis y devolvé el JSON.'
}`

    // 10. Llamar a Claude
    const startTime = Date.now()

    // En modo suggestions_only, usamos un prompt más liviano y max_tokens menor
    const systemToUse = suggestions_only ? SYSTEM_PROMPT_SUGGESTIONS_ONLY : SYSTEM_PROMPT
    const maxTokens   = suggestions_only ? 300 : 600

    const response = await anthropic.messages.create({
      model:      MODEL_NAME,
      max_tokens: maxTokens,
      system:     systemToUse,
      messages:   [{ role: 'user', content: userMessage }],
    })

    const textBlock = response.content?.find((b: any) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text' || !textBlock.text) {
      throw new Error('Claude no devolvió texto')
    }

    // 11. Parsear JSON
    let parsed: {
      context?:            string
      next_question?:      string | null
      suggestions?:        string[]
      suggested_assignee?: { name: string; reason: string } | null
      suggested_topics?:   string[]
      field_updates?:      {
        due_date?:                string | null
        assigned_to_user?:        boolean
        assigned_contact_name?:   string | null
        status?:                  string
      }
    }
    try {
      const cleaned = textBlock.text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('[task-context] error parseando JSON:', textBlock.text)
      return Response.json({ error: 'Respuesta inválida del agente' }, { status: 500 })
    }

    // 12. Persistir context y field_updates en tasks
    // En modo suggestions_only no persistimos nada — solo leemos y sugerimos
    const updates: Record<string, unknown> = {}
    if (!suggestions_only && parsed.context) updates.context = parsed.context

    if (!suggestions_only && parsed.field_updates && Object.keys(parsed.field_updates).length > 0) {
      const fu = parsed.field_updates

      if (fu.due_date !== undefined)         updates.due_date         = fu.due_date
      if (fu.status !== undefined)           updates.status           = fu.status
      if (fu.assigned_to_user !== undefined) {
        updates.assigned_to_user    = fu.assigned_to_user
        updates.assigned_contact_id = null
      }
      if (fu.assigned_contact_name) {
        // Buscar el contacto por nombre
        const match = (crisisContacts ?? [])
          .map((cc: any) => cc.contact)
          .find((c: any) => c?.name?.toLowerCase() === fu.assigned_contact_name!.toLowerCase())
        if (match) {
          updates.assigned_contact_id = match.id
          updates.assigned_to_user    = false
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      await supabase
        .from('tasks')
        .update(updates)
        .eq('id', task_id)
    }

    // 13. Log de uso
    const latencyMs = Date.now() - startTime
    await supabase.from('logs').insert({
      profile_id:  user_id,
      canal:       'web',
      modelo:      MODEL_NAME,
      tokens_in:   response.usage.input_tokens,
      tokens_out:  response.usage.output_tokens,
      latencia_ms: latencyMs,
      costo_usd:
        (response.usage.input_tokens  / 1_000_000) * PRICE_INPUT_PER_MTOK +
        (response.usage.output_tokens / 1_000_000) * PRICE_OUTPUT_PER_MTOK,
    })

    if (suggestions_only) {
      return Response.json({
        suggested_assignee: parsed.suggested_assignee ?? null,
        suggested_topics:   Array.isArray(parsed.suggested_topics)
          ? parsed.suggested_topics : [],
      })
    }

    return Response.json({
      context:            parsed.context ?? null,
      next_question:      parsed.next_question ?? null,
      suggestions:        Array.isArray(parsed.suggestions)
        ? parsed.suggestions : [],
      suggested_assignee: parsed.suggested_assignee ?? null,
      suggested_topics:   Array.isArray(parsed.suggested_topics)
        ? parsed.suggested_topics : [],
      field_updates:      parsed.field_updates ?? {},
    })

  } catch (error) {
    console.error('[task-context] error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
