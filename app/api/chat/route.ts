import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

// ── 1. Clients ─────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false } }
)

// ── 2. Constants ───────────────────────────────────────────────────────────────

const MODEL               = 'claude-sonnet-4-5-20250929'
const MAX_TOOL_ITERATIONS = 10
const PRICE_IN_PER_MTOK   = 3.0   // USD per million tokens
const PRICE_OUT_PER_MTOK  = 15.0  // USD per million tokens

// ── 3. System prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Sos el agente de Mhiru. Ayudás a una persona a gestionar situaciones de cuidado
complejas: sus temas (casos), su círculo de apoyo y sus tareas pendientes.

Tenés tools para registrar y actualizar información en tiempo real.
Tu trabajo es operar — leer el contexto, registrar lo que corresponda, conversar
de forma breve y directa.

QUIÉN SOS

Hablás como alguien que ya pasó por esto, sabe lo que hay que hacer, y lo dice
sin dramatismo ni falsedad. Presencia tranquila.

Cuatro cualidades de tu voz:
- Serena, no solemne. Hablás al lado del usuario, no desde arriba.
- Directa, no fría. La claridad es una forma de cuidado.
- Humana, no emotiva. No nombrás el dolor. Lo reconocés implícitamente y actuás.
- Presente, no intrusiva. Aparecés cuando importa, decís lo necesario, y te corrés.

CÓMO HABLÁS

- Español rioplatense. Voseo siempre.
- Usás el nombre corto del usuario (lo tenés en <perfil><nombre>).
- Máximo 2-3 oraciones por respuesta de texto.
- UNA sola pregunta por mensaje. Nunca dos.
- Sin listas, bullets, negritas, asteriscos, markdown de ningún tipo.
  El frontend muestra texto plano — cualquier asterisco o guión se ve literal.
- Nunca usás el signo de pregunta de apertura (escribís "Cómo estás" no "¿Cómo estás?").
- Verbos activos, sujeto Mhiru. Decís lo que ya está resuelto, no lo que sugerís.
- Oraciones cortas. Cuanto más crítico el momento, más corta la frase.
- Sin metáforas de viaje o batalla ("este camino", "la lucha", "el proceso").
- Sin nombrar emociones ajenas. No decís "entendemos tu angustia".
  Decís lo que ya está hecho: "Listo, anoté a Caro."
- Palabras prohibidas: "comunidad", "familia" (como concepto abstracto), "guerrero".

CÓMO OPERÁS

En cada turno, en orden estricto:

1. Leés el bloque <contexto> que viene en el último mensaje del usuario.
   Es tu referencia interna — NO lo resumís ni lo repetís en voz alta.
   Si el usuario no preguntó por el contexto, no lo mencionás.
   Usalo solo para informar tus acciones y respuestas.

2. Si el mensaje tiene información registrable (nombre nuevo, tarea concreta,
   nota médica, decisión), llamás la tool correspondiente ANTES de responder con texto.
   No pedís confirmación antes de registrar. Si hay algo que registrar, lo registrás
   y en tu respuesta decís lo que hiciste.

3. Después de registrar (o si no había nada que registrar), respondés con texto.
   Máximo 2-3 oraciones + una pregunta si tiene sentido.

4. El bloque <caso_activo> tiene un atributo tipo que puede ser 'propio' o
   'compartido'. Cuando llamás tools que requieren un ID de caso, usás el <id>
   del caso activo. Las tools saben internamente a qué tabla apuntar según el
   tipo — vos solo pasás el id y el tipo.

REGLAS OPERATIVAS

- Registrás antes de responder.
- No pedís permiso para registrar. "Anoto a Caro?" está mal. Lo anotás y decís "Anoté a Caro."
- Si falta un dato no obligatorio (teléfono, email, fecha), lo dejás vacío.
- No registrás duplicados. Si en <circulo> ya está esa persona, no la creás de nuevo.
- Si el usuario solo charla sin info registrable, conversás sin llamar tools.
- Si el usuario pregunta por info que ya está en el contexto, respondés sin llamar tools.
- No resumís el contexto al inicio de cada respuesta. El usuario ya sabe
  en qué tema está. Solo mencionás información del contexto cuando es
  directamente relevante para lo que el usuario preguntó o pidió.

RESTRICCIONES

- No diagnosticás. No recomendás tratamientos. No contradecís al médico.
- Podés explicar términos médicos en lenguaje simple y sugerir preguntas
  para llevar al profesional.
- Cerrás temas médicos con algo como "igual esto lo tiene que ver tu médico"
  como parte natural de la conversación, no como disclaimer rígido.
- Si tiene sentido involucrar a alguien del círculo, decís
  "podría ser buena idea hablar con [nombre]" y registrás una tarea si corresponde.
- No inventás información. Si no sabés algo, preguntás.
- No inventes capacidades que no tenés. Si no podés hacer algo con tus tools
  (eliminar una tarea, modificar un contacto, mover una fecha), decilo directamente:
  "no tengo cómo hacer eso desde acá, te recomiendo hacerlo desde el panel."
  NUNCA inventes que alguien lo procesa por detrás o que el equipo lo resuelve.

PROTOCOLO DE CRISIS EMOCIONAL

Si detectás señales de riesgo (ideación suicida, autolesión, crisis aguda),
pausás todo lo operativo y preguntás directamente cómo está la persona en este momento.
No llamás ninguna tool en ese turno.

SUGERENCIAS DE RESPUESTA

Al final de cada respuesta, siempre agregás exactamente 3 sugerencias de respuesta
para el usuario. Las sugerencias deben ser cortas (máximo 6 palabras cada una),
en primera persona como hablaría el usuario, y relevantes al contexto
de lo que acabás de responder.

Formato obligatorio — siempre al final del mensaje, sin excepción:

[SUGERENCIAS]
sugerencia 1
sugerencia 2
sugerencia 3
[/SUGERENCIAS]

Ejemplos de buenas sugerencias según contexto:
- Después de listar tareas pendientes: "Empecemos por la más urgente" /
  "Asigná una al círculo" / "Registrar algo nuevo"
- Después de agregar un contacto: "Qué puede hacer esta persona" /
  "Agregar otro contacto" / "Ver tareas pendientes"
- Después de una charla emocional: "Contame más" /
  "Qué tengo pendiente hoy" / "Registrar cómo me siento"
- Estado genérico: "Qué tengo pendiente" / "Contame más" /
  "Quiero registrar algo"

Nunca omitís el bloque [SUGERENCIAS]...[/SUGERENCIAS].
Si no hay contexto suficiente para sugerencias relevantes, usás las genéricas.

TEMAS PROPIOS VS COMPARTIDOS

El atributo tipo en <caso_activo> indica si el caso es 'propio' o
'compartido'. En ambos tipos podés crear tareas, registrar eventos
y operar normalmente. Siempre pasás el id del caso activo y su tipo
a las tools — ellas saben a qué tabla apuntar.

La única diferencia operativa: en temas compartidos no podés
crear ni modificar contactos del círculo, porque el círculo es
personal del usuario, no del tema compartido.`

// ── 4. Tool definitions ────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'crear_caso',
    description:
      'Crea un nuevo caso (tema) activo para el usuario. Usar cuando el usuario ' +
      'describe una situación que va a requerir seguimiento: enfermedad de un familiar, ' +
      'proceso médico propio, situación de cuidado sostenida. No crear para problemas puntuales.',
    input_schema: {
      type: 'object',
      properties: {
        nombre: {
          type: 'string',
          description: "Nombre corto del caso. Ej: 'Internación de mamá', 'Control de Martín'.",
        },
        descripcion: {
          type: 'string',
          description: 'Contexto en 1-3 oraciones. Qué pasa, quién es el afectado, desde cuándo.',
        },
        categoria: {
          type: 'string',
          enum: [
            'padre_madre_primerizo',
            'hijo_con_padre_a_cargo',
            'crisis_emocional_propia',
            'familiar_enfermedad_grave',
            'crisis_indefinida',
          ],
        },
        ai_summary: {
          type: 'string',
          description: 'Resumen en 2-4 oraciones en voz del agente.',
        },
        ai_next_step: {
          type: 'string',
          description: 'Qué viene a continuación. 1 oración.',
        },
      },
      required: ['nombre', 'descripcion', 'categoria', 'ai_summary', 'ai_next_step'],
    },
  },

  {
    name: 'crear_contacto',
    description:
      'Registra un nuevo contacto en el círculo del usuario. Usar cuando el usuario menciona ' +
      'a alguien por primera vez. Inferir rol y proximidad del contexto. ' +
      'rol logistico: ayuda concreta (lleva, cocina, trámites). ' +
      'rol acompanamiento: apoyo emocional. ' +
      'rol prestador_servicios: profesionales. ' +
      'proximidad nucleo: familia directa o íntimos. ' +
      'proximidad ayuda: resto del círculo cercano. ' +
      'proximidad profesional: prestadores.',
    input_schema: {
      type: 'object',
      properties: {
        nombre:          { type: 'string' },
        relacion:        { type: 'string', description: "Texto libre. Ej: 'hermana', 'vecina de confianza'." },
        rol:             { type: 'string', enum: ['acompanamiento', 'logistico', 'prestador_servicios'] },
        proximidad:      { type: 'string', enum: ['nucleo', 'ayuda', 'profesional'] },
        notas:           { type: 'string', description: 'Opcional. Cuándo activar a esta persona, qué puede hacer.' },
        email:           { type: 'string', description: 'Opcional.' },
        telefono:        { type: 'string', description: 'Opcional.' },
        vincular_a_caso: { type: 'string', description: 'ID del caso al que vincular. Opcional.' },
      },
      required: ['nombre', 'relacion', 'rol', 'proximidad'],
    },
  },

  {
    name: 'crear_tarea',
    description:
      'Crea una tarea pendiente. Debe vincularse a un caso existente. ' +
      "Si el usuario menciona un día sin fecha exacta ('el viernes'), calculá la fecha real. " +
      'Asignada al usuario O a un contacto del círculo, no ambos.',
    input_schema: {
      type: 'object',
      properties: {
        titulo: {
          type: 'string',
          description: 'Corto y accionable.',
        },
        descripcion: {
          type: 'string',
          description: 'Detalles adicionales. Opcional.',
        },
        case_id: {
          type: 'string',
          description: 'ID del caso al que pertenece. Obligatorio.',
        },
        due_date: {
          type: 'string',
          description: 'YYYY-MM-DD. Opcional.',
        },
        asignar_a_owner: {
          type: 'boolean',
          description: 'true si la tarea es del usuario.',
        },
        nombre_contacto_asignado: {
          type: 'string',
          description: 'Solo si asignar_a_owner es false.',
        },
        case_type: {
          type: 'string',
          enum: ['propio', 'compartido'],
          description: "Tipo de caso. Viene del atributo tipo de <caso_activo> en el contexto.",
        },
      },
      required: ['titulo', 'case_id', 'asignar_a_owner', 'case_type'],
    },
  },

  {
    name: 'completar_tarea',
    description:
      'Marca una tarea como completada. Buscar la tarea por título dentro de las tareas pendientes del usuario.',
    input_schema: {
      type: 'object',
      properties: {
        titulo_tarea: {
          type: 'string',
          description: 'Título o parte del título de la tarea a completar.',
        },
        case_id: {
          type: 'string',
          description: 'ID del caso al que pertenece la tarea.',
        },
        case_type: {
          type: 'string',
          enum: ['propio', 'compartido'],
          description: "Tipo de caso. Viene del atributo tipo de <caso_activo> en el contexto.",
        },
      },
      required: ['titulo_tarea', 'case_id', 'case_type'],
    },
  },

  {
    name: 'registrar_evento',
    description:
      'Registra un evento narrativo en el historial de un caso. ' +
      'Para información que no encaja en tareas o contactos: notas médicas, ' +
      'decisiones familiares, actualizaciones generales.',
    input_schema: {
      type: 'object',
      properties: {
        case_id: { type: 'string', description: 'ID del caso.' },
        tipo: {
          type: 'string',
          enum: ['nota_medica', 'evento_emocional', 'actualizacion_general', 'decision_familiar', 'nota_libre'],
        },
        titulo:      { type: 'string', description: 'Título corto del evento.' },
        descripcion: { type: 'string', description: 'Detalles. Opcional.' },
        case_type: {
          type: 'string',
          enum: ['propio', 'compartido'],
          description: "Tipo de caso. Viene del atributo tipo de <caso_activo> en el contexto.",
        },
      },
      required: ['case_id', 'tipo', 'titulo', 'case_type'],
    },
  },

  {
    name: 'actualizar_resumen_caso',
    description:
      'Actualiza el resumen vivo (ai_summary) y próximo paso (ai_next_step) de un caso. ' +
      "Usar SOLO cuando el usuario confirme explícitamente que quiere actualizar el contexto " +
      "('sí', 'dale', 'actualizá'). Nunca llamar sin confirmación previa.",
    input_schema: {
      type: 'object',
      properties: {
        case_id: {
          type: 'string',
          description: 'ID del caso.',
        },
        nuevo_ai_summary: {
          type: 'string',
          description: 'Resumen completo en 2-4 oraciones. Reescribir desde cero.',
        },
        nuevo_ai_next_step: {
          type: 'string',
          description: 'Próximo paso. 1 oración accionable.',
        },
      },
      required: ['case_id', 'nuevo_ai_summary', 'nuevo_ai_next_step'],
    },
  },

  {
    name: 'actualizar_contacto',
    description:
      'Actualiza datos de un contacto existente en el círculo. ' +
      'Busca por nombre (case-insensitive, substring). Solo actualiza los campos ' +
      'que el usuario mencionó explícitamente — no sobreescribas campos no mencionados.',
    input_schema: {
      type: 'object',
      properties: {
        nombre_busqueda:  { type: 'string', description: 'Nombre o parte del nombre para encontrar el contacto.' },
        nuevo_nombre:     { type: 'string', description: 'Opcional. Nuevo nombre.' },
        nueva_relacion:   { type: 'string', description: 'Opcional. Nueva relación.' },
        nuevo_rol:        { type: 'string', enum: ['acompanamiento', 'logistico', 'prestador_servicios'], description: 'Opcional.' },
        nueva_proximidad: { type: 'string', enum: ['nucleo', 'ayuda', 'profesional'], description: 'Opcional.' },
        nuevas_notas:     { type: 'string', description: 'Opcional. Nuevas notas.' },
        nuevo_telefono:   { type: 'string', description: 'Opcional.' },
        nuevo_email:      { type: 'string', description: 'Opcional.' },
      },
      required: ['nombre_busqueda'],
    },
  },

  {
    name: 'eliminar_contacto',
    description:
      'Elimina un contacto del círculo. Busca por nombre. ' +
      'Antes de eliminar, confirmá con el usuario si no lo hizo explícitamente.',
    input_schema: {
      type: 'object',
      properties: {
        nombre_busqueda: { type: 'string', description: 'Nombre o parte del nombre del contacto a eliminar.' },
      },
      required: ['nombre_busqueda'],
    },
  },

  {
    name: 'editar_tarea',
    description:
      'Edita una tarea existente: cambia fecha, reasigna a otro contacto ' +
      'o al owner, o actualiza el título/descripción. Busca la tarea por título.',
    input_schema: {
      type: 'object',
      properties: {
        titulo_busqueda:      { type: 'string', description: 'Título o parte del título de la tarea.' },
        case_id:              { type: 'string', description: 'ID del caso al que pertenece.' },
        nuevo_titulo:         { type: 'string', description: 'Opcional.' },
        nueva_descripcion:    { type: 'string', description: 'Opcional.' },
        nueva_due_date:       { type: 'string', description: 'YYYY-MM-DD. Opcional.' },
        reasignar_a_owner:    { type: 'boolean', description: 'Opcional. true para reasignar al usuario.' },
        reasignar_a_contacto: { type: 'string', description: 'Opcional. Nombre del contacto al que reasignar.' },
        case_type: {
          type: 'string',
          enum: ['propio', 'compartido'],
          description: "Tipo de caso. Viene del atributo tipo de <caso_activo> en el contexto.",
        },
      },
      required: ['titulo_busqueda', 'case_id', 'case_type'],
    },
  },

  {
    name: 'eliminar_tarea',
    description: 'Elimina una tarea. Busca por título dentro del caso.',
    input_schema: {
      type: 'object',
      properties: {
        titulo_busqueda: { type: 'string', description: 'Título o parte del título de la tarea a eliminar.' },
        case_id:         { type: 'string', description: 'ID del caso al que pertenece.' },
        case_type: {
          type: 'string',
          enum: ['propio', 'compartido'],
          description: "Tipo de caso. Viene del atributo tipo de <caso_activo> en el contexto.",
        },
      },
      required: ['titulo_busqueda', 'case_id', 'case_type'],
    },
  },
]

// ── parseSuggestions ──────────────────────────────────────────────────────────

const FALLBACK_SUGGESTIONS = ['¿Qué tengo pendiente?', 'Contame más', 'Quiero registrar algo']

function parseSuggestions(text: string): { reply: string; suggestions: string[] } {
  const match = text.match(/\[SUGERENCIAS\]([\s\S]*?)\[\/SUGERENCIAS\]/)
  if (!match) {
    return { reply: text.trim(), suggestions: FALLBACK_SUGGESTIONS }
  }
  const suggestions = match[1]
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 3)
  const reply = text.replace(/\[SUGERENCIAS\][\s\S]*?\[\/SUGERENCIAS\]/, '').trim()
  return {
    reply,
    suggestions: suggestions.length === 3 ? suggestions : FALLBACK_SUGGESTIONS,
  }
}

// ── CORS ───────────────────────────────────────────────────────────────────────

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

// ── 5. POST handler ───────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const startMs = Date.now()

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: { user_id?: string; message?: string; case_id?: string; shared_case_id?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { user_id, message, case_id, shared_case_id } = body
  if (!user_id || typeof user_id !== 'string' ||
      !message || typeof message !== 'string') {
    return Response.json({ error: 'Faltan user_id o message' }, { status: 400 })
  }

  // ── Find or create conversation ─────────────────────────────────────────────
  let existingConv: { id: string } | null = null

  if (case_id) {
    const { data } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('user_id', user_id)
      .eq('case_id', case_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    existingConv = data
  } else if (shared_case_id) {
    const { data } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('user_id', user_id)
      .eq('shared_case_id', shared_case_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    existingConv = data
  } else {
    const { data } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('user_id', user_id)
      .is('case_id', null)
      .is('shared_case_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    existingConv = data
  }

  let conversationId: string
  if (existingConv) {
    conversationId = existingConv.id
  } else {
    const insertPayload: Record<string, unknown> = {
      user_id,
      case_id:        case_id        ?? null,
      shared_case_id: shared_case_id ?? null,
      title:          'Chat',
    }
    const { data: newConv, error: convErr } = await supabaseAdmin
      .from('conversations')
      .insert(insertPayload)
      .select('id')
      .single()
    if (convErr || !newConv) {
      console.error('[chat/route] create conversation error:', convErr)
      return Response.json({ error: 'Error al crear conversación' }, { status: 500 })
    }
    conversationId = newConv.id
  }

  // ── Insert user message ─────────────────────────────────────────────────────
  const { data: userMsgData, error: userMsgErr } = await supabaseAdmin
    .from('messages')
    .insert({ conversation_id: conversationId, sender: 'usuario', content: message })
    .select('id')
    .single()

  if (userMsgErr || !userMsgData) {
    console.error('[chat/route] insert user message error:', userMsgErr)
    return Response.json({ error: 'Error al guardar mensaje' }, { status: 500 })
  }
  const userMsgId = userMsgData.id

  try {
    // ── Fetch conversation history ──────────────────────────────────────────
    const { data: historyData } = await supabaseAdmin
      .from('messages')
      .select('sender, content')
      .eq('conversation_id', conversationId)
      .order('sent_at', { ascending: false })
      .limit(20)

    const history = (
      (historyData ?? []) as Array<{ sender: string; content: string }>
    ).reverse()

    // ── Build context block ─────────────────────────────────────────────────
    const contextBlock = await buildContextBlock(user_id, case_id, shared_case_id)

    // ── Build messages for Claude ───────────────────────────────────────────
    let messagesForClaude: Array<{ role: 'user' | 'assistant'; content: string }> =
      history.map(m => ({
        role:    (m.sender === 'usuario' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      }))

    // Enforce strict user/assistant alternation
    messagesForClaude = ensureAlternation(messagesForClaude)

    // Inject context block at the start of the last user message
    for (let i = messagesForClaude.length - 1; i >= 0; i--) {
      if (messagesForClaude[i].role === 'user') {
        messagesForClaude[i] = {
          role:    'user',
          content: `${contextBlock}\n\n${messagesForClaude[i].content}`,
        }
        break
      }
    }

    // ── Run agentic loop ────────────────────────────────────────────────────
    const { finalText, totalTokensIn, totalTokensOut, totalCostUsd } =
      await runExecutorLoop(messagesForClaude, user_id)

    // ── Extract suggestions and clean reply ─────────────────────────────────
    const { reply, suggestions } = parseSuggestions(finalText)

    // ── Persist agent reply (clean, without suggestion block) ───────────────
    await supabaseAdmin
      .from('messages')
      .insert({ conversation_id: conversationId, sender: 'agente', content: reply })

    // ── Log usage ───────────────────────────────────────────────────────────
    const latenciaMs = Date.now() - startMs
    await supabaseAdmin
      .from('logs')
      .insert({
        profile_id:  user_id,
        canal:       'web_chat',
        modelo:      MODEL,
        tokens_in:   totalTokensIn,
        tokens_out:  totalTokensOut,
        latencia_ms: latenciaMs,
        costo_usd:   totalCostUsd,
      })

    return Response.json({ reply, suggestions })

  } catch (agentErr: any) {
    console.error('[chat/route] agent error — rolling back user message:', agentErr)
    // Rollback user message so the conversation stays consistent
    await supabaseAdmin.from('messages').delete().eq('id', userMsgId)
    return Response.json(
      { error: agentErr?.message ?? 'Error del agente' },
      { status: 500 }
    )
  }
}

// ── 6. buildContextBlock ───────────────────────────────────────────────────────

async function buildContextBlock(
  userId: string,
  caseId?: string,
  sharedCaseId?: string,
): Promise<string> {

  // ── Shared case path ────────────────────────────────────────────────────────
  if (sharedCaseId) {
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle()
    const fullName = (profileData?.full_name ?? '') as string

    const [scRes, membersRes, tasksRes, historyRes] = await Promise.all([
      supabaseAdmin
        .from('shared_cases')
        .select('id, name, ai_summary, description')
        .eq('id', sharedCaseId)
        .maybeSingle(),
      supabaseAdmin
        .from('shared_case_members')
        .select('profiles!inner(full_name)')
        .eq('shared_case_id', sharedCaseId)
        .eq('status', 'active'),
      supabaseAdmin
        .from('tasks')
        .select('title, due_date, assigned_to_user, contact:contacts(name)')
        .eq('shared_case_id', sharedCaseId)
        .eq('status', 'pendiente')
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(10),
      supabaseAdmin
        .from('shared_case_history')
        .select('event_type, title, description, occurred_at')
        .eq('shared_case_id', sharedCaseId)
        .order('occurred_at', { ascending: false })
        .limit(5),
    ])

    const sc = scRes.data
    if (!sc) {
      return `<contexto>
  <perfil><nombre>${esc(fullName)}</nombre></perfil>
  <caso_activo>ninguno</caso_activo>
</contexto>`
    }

    const participantesXml = (membersRes.data ?? [])
      .map((m: any) => `    <participante>${esc(m.profiles?.full_name)}</participante>`)
      .join('\n')

    const tareasXml = (tasksRes.data ?? [])
      .map((t: any) => {
        const asignadaA = t.assigned_to_user ? 'vos' : (t.contact?.name ?? 'sin asignar')
        return [
          '    <tarea>',
          `      <titulo>${esc(t.title)}</titulo>`,
          `      <vence>${esc(describeDueDate(t.due_date))}</vence>`,
          `      <asignada_a>${esc(asignadaA)}</asignada_a>`,
          '    </tarea>',
        ].join('\n')
      })
      .join('\n')

    const historialXml = historyRes.error
      ? '    (historial no disponible)'
      : (historyRes.data ?? [])
          .map((h: any) => {
            const fecha = h.occurred_at
              ? new Date(h.occurred_at).toLocaleDateString('es-AR', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                })
              : ''
            const desc = h.description ? ` — ${h.description}` : ''
            return `    <evento fecha="${esc(fecha)}" tipo="${esc(h.event_type)}">${esc(h.title + desc)}</evento>`
          })
          .join('\n')

    return `<contexto>
  <perfil><nombre>${esc(fullName)}</nombre></perfil>
  <caso_activo tipo="compartido">
    <id>${esc(sc.id)}</id>
    <nombre>${esc(sc.name)}</nombre>
    <resumen>${esc(sc.ai_summary)}</resumen>
  </caso_activo>
  <participantes>
${participantesXml || '    (sin participantes registrados)'}
  </participantes>
  <tareas_pendientes>
${tareasXml || '    (sin tareas pendientes)'}
  </tareas_pendientes>
  <historial_reciente>
${historialXml}
  </historial_reciente>
</contexto>`
  }

  // ── Own case path ────────────────────────────────────────────────────────────
  let caseData: Record<string, any> | null = null

  if (caseId) {
    const { data } = await supabaseAdmin
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .maybeSingle()
    caseData = data
  } else {
    const { data } = await supabaseAdmin
      .from('cases')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'activa')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    caseData = data
  }

  // ── Fetch profile (always needed) ──────────────────────────────────────────
  const { data: profileData } = await supabaseAdmin
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .maybeSingle()

  const fullName = (profileData?.full_name ?? '') as string

  // ── No active case ──────────────────────────────────────────────────────────
  if (!caseData) {
    return `<contexto>
  <perfil>
    <nombre>${esc(fullName)}</nombre>
  </perfil>
  <caso_activo>ninguno</caso_activo>
</contexto>`
  }

  const activeCaseId = caseData.id as string

  // ── Parallel fetch: contacts, tasks, history ────────────────────────────────
  const [contactsRes, tasksRes, historyRes] = await Promise.all([
    supabaseAdmin
      .from('contacts')
      .select('name, relationship, role, proximity, notes')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true, nullsFirst: false }),

    supabaseAdmin
      .from('tasks')
      .select('title, description, due_date, assigned_to_user, contact:contacts(name)')
      .eq('case_id', activeCaseId)
      .eq('status', 'pendiente')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(10),

    supabaseAdmin
      .from('case_history')
      .select('event_type, title, description, occurred_at')
      .eq('case_id', activeCaseId)
      .order('occurred_at', { ascending: false })
      .limit(5),
  ])

  const contacts = (contactsRes.data ?? []) as any[]
  const tasks    = (tasksRes.data    ?? []) as any[]
  const history  = (historyRes.data  ?? []) as any[]

  // ── Build XML sections ──────────────────────────────────────────────────────

  const circuloXml = contacts
    .map((c: any) => {
      if (!c) return ''
      return [
        '    <contacto>',
        `      <nombre>${esc(c.name)}</nombre>`,
        `      <relacion>${esc(c.relationship)}</relacion>`,
        `      <rol>${esc(c.role)}</rol>`,
        `      <proximidad>${esc(c.proximity)}</proximidad>`,
        `      <notas>${esc(c.notes)}</notas>`,
        '    </contacto>',
      ].join('\n')
    })
    .filter(Boolean)
    .join('\n')

  const tareasXml = tasks
    .map((t: any) => {
      const asignadaA = t.assigned_to_user
        ? 'vos'
        : (t.contact?.name ?? 'sin asignar')
      return [
        '    <tarea>',
        `      <titulo>${esc(t.title)}</titulo>`,
        `      <vence>${esc(describeDueDate(t.due_date))}</vence>`,
        `      <asignada_a>${esc(asignadaA)}</asignada_a>`,
        '    </tarea>',
      ].join('\n')
    })
    .join('\n')

  const historialXml = history
    .map((h: any) => {
      const fecha = h.occurred_at
        ? new Date(h.occurred_at).toLocaleDateString('es-AR', {
            day:   '2-digit',
            month: '2-digit',
            year:  'numeric',
          })
        : ''
      const desc = h.description ? ` — ${h.description}` : ''
      return `    <evento fecha="${esc(fecha)}" tipo="${esc(h.event_type)}">${esc(h.title + desc)}</evento>`
    })
    .join('\n')

  return `<contexto>
  <perfil>
    <nombre>${esc(fullName)}</nombre>
  </perfil>
  <caso_activo tipo="propio">
    <id>${esc(activeCaseId)}</id>
    <nombre>${esc(caseData.name)}</nombre>
    <categoria>${esc(caseData.category)}</categoria>
    <resumen>${esc(caseData.ai_summary)}</resumen>
    <proximo_paso>${esc(caseData.ai_next_step)}</proximo_paso>
  </caso_activo>
  <circulo>
${circuloXml || '    (sin contactos registrados)'}
  </circulo>
  <tareas_pendientes>
${tareasXml || '    (sin tareas pendientes)'}
  </tareas_pendientes>
  <historial_reciente>
${historialXml || '    (sin historial)'}
  </historial_reciente>
</contexto>`
}

// ── 7. runExecutorLoop ────────────────────────────────────────────────────────

type LoopResult = {
  finalText:      string
  totalTokensIn:  number
  totalTokensOut: number
  totalCostUsd:   number
}

async function runExecutorLoop(
  initialMessages: Array<{ role: 'user' | 'assistant'; content: any }>,
  userId: string,
): Promise<LoopResult> {
  // Work on a mutable copy; typed as any[] to accommodate tool_use / tool_result blocks
  const messages: any[] = [...initialMessages]

  let totalTokensIn  = 0
  let totalTokensOut = 0

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await anthropic.messages.create({
      model:      MODEL,
      max_tokens: 1024,
      system:     SYSTEM_PROMPT,
      tools:      TOOLS,
      messages,
    })

    totalTokensIn  += response.usage.input_tokens
    totalTokensOut += response.usage.output_tokens

    // ── End turn: extract final text and return ───────────────────────────
    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find((b: any) => b.type === 'text')
      const finalText = (textBlock as any)?.text ?? ''
      const totalCostUsd =
        (totalTokensIn  / 1_000_000) * PRICE_IN_PER_MTOK +
        (totalTokensOut / 1_000_000) * PRICE_OUT_PER_MTOK
      return { finalText, totalTokensIn, totalTokensOut, totalCostUsd }
    }

    // ── Tool use: execute all tools and continue loop ─────────────────────
    if (response.stop_reason === 'tool_use') {
      // Append assistant turn (includes tool_use blocks)
      messages.push({ role: 'assistant', content: response.content })

      // Execute every tool call (in parallel)
      const toolUseBlocks = response.content.filter((b: any) => b.type === 'tool_use')
      const toolResults   = await Promise.all(
        toolUseBlocks.map(async (block: any) => ({
          type:        'tool_result' as const,
          tool_use_id: block.id as string,
          content:     await executeTool(
            block.name  as string,
            block.input as Record<string, unknown>,
            userId,
          ),
        }))
      )

      // Append user turn with tool results
      messages.push({ role: 'user', content: toolResults })
      continue
    }

    // ── Unexpected stop reason ────────────────────────────────────────────
    throw new Error(`[runExecutorLoop] stop_reason inesperado: ${response.stop_reason}`)
  }

  throw new Error('[runExecutorLoop] Se excedió el límite de iteraciones del agente.')
}

// ── 8. executeTool dispatcher ─────────────────────────────────────────────────

async function executeTool(
  name:   string,
  input:  Record<string, unknown>,
  userId: string,
): Promise<string> {
  try {
    let result: Record<string, unknown>

    switch (name) {
      case 'crear_caso':
        result = await toolCrearCaso(input, userId)
        break
      case 'crear_contacto':
        result = await toolCrearContacto(input, userId)
        break
      case 'crear_tarea':
        result = await toolCrearTarea(input, userId)
        break
      case 'completar_tarea':
        result = await toolCompletarTarea(input)
        break
      case 'registrar_evento':
        result = await toolRegistrarEvento(input)
        break
      case 'actualizar_resumen_caso':
        result = await toolActualizarResumenCaso(input)
        break
      case 'actualizar_contacto':
        result = await toolActualizarContacto(input, userId)
        break
      case 'eliminar_contacto':
        result = await toolEliminarContacto(input, userId)
        break
      case 'editar_tarea':
        result = await toolEditarTarea(input, userId)
        break
      case 'eliminar_tarea':
        result = await toolEliminarTarea(input)
        break
      default:
        result = { success: false, error: `Tool desconocido: ${name}` }
    }

    return JSON.stringify(result)
  } catch (err: any) {
    return JSON.stringify({ success: false, error: err?.message ?? 'Error interno en tool' })
  }
}

// ── 9. Tool implementations ───────────────────────────────────────────────────

async function toolCrearCaso(
  input:  Record<string, unknown>,
  userId: string,
): Promise<Record<string, unknown>> {
  const nombre       = String(input.nombre       ?? '')
  const descripcion  = String(input.descripcion  ?? '')
  const categoria    = String(input.categoria    ?? '')
  const ai_summary   = String(input.ai_summary   ?? '')
  const ai_next_step = String(input.ai_next_step ?? '')

  const { data: caseData, error: caseErr } = await supabaseAdmin
    .from('cases')
    .insert({
      user_id:     userId,
      name:        nombre,
      description: descripcion,
      category:    categoria,
      ai_summary,
      ai_next_step,
      status:      'activa',
    })
    .select('id')
    .single()

  if (caseErr || !caseData) {
    return { success: false, error: caseErr?.message ?? 'Error al crear caso' }
  }

  await supabaseAdmin
    .from('case_history')
    .insert({
      case_id:     caseData.id,
      event_type:  'caso_creado',
      title:       `Caso "${nombre}" creado`,
      description: descripcion,
    })

  return {
    success: true,
    id:      caseData.id,
    summary: `Caso "${nombre}" creado correctamente.`,
  }
}

async function toolCrearContacto(
  input:  Record<string, unknown>,
  userId: string,
): Promise<Record<string, unknown>> {
  const nombre          = String(input.nombre     ?? '')
  const relacion        = String(input.relacion   ?? '')
  const rol             = String(input.rol        ?? '')
  const proximidad      = String(input.proximidad ?? '')
  const notas           = input.notas    ? String(input.notas)    : null
  const email           = input.email    ? String(input.email)    : null
  const telefono        = input.telefono ? String(input.telefono) : null
  const vincularACaso   = input.vincular_a_caso ? String(input.vincular_a_caso) : null

  const { data: contactData, error: contactErr } = await supabaseAdmin
    .from('contacts')
    .insert({
      user_id:      userId,
      name:         nombre,
      relationship: relacion,
      role:         rol,
      proximity:    proximidad,
      notes:        notas,
      email:        email,
      phone:        telefono,
    })
    .select('id')
    .single()

  if (contactErr || !contactData) {
    return { success: false, error: contactErr?.message ?? 'Error al crear contacto' }
  }

  if (vincularACaso) {
    await supabaseAdmin
      .from('case_contacts')
      .insert({ case_id: vincularACaso, contact_id: contactData.id })

    await supabaseAdmin
      .from('case_history')
      .insert({
        case_id:    vincularACaso,
        event_type: 'contacto_sumado',
        title:      `${nombre} sumado al círculo`,
      })
  }

  return {
    success: true,
    id:      contactData.id,
    summary: `Contacto "${nombre}" registrado correctamente.`,
  }
}

async function toolCrearTarea(
  input:  Record<string, unknown>,
  userId: string,
): Promise<Record<string, unknown>> {
  const titulo                   = String(input.titulo    ?? '')
  const descripcion              = input.descripcion ? String(input.descripcion) : null
  const case_id                  = String(input.case_id   ?? '')
  const case_type                = String(input.case_type ?? 'propio')
  const due_date                 = input.due_date ? String(input.due_date) : null
  const asignarAOwner            = Boolean(input.asignar_a_owner)
  const nombreContactoAsignado   = input.nombre_contacto_asignado
    ? String(input.nombre_contacto_asignado)
    : null

  // XOR validation
  if (!asignarAOwner && !nombreContactoAsignado) {
    return { success: false, error: 'Debés asignar la tarea al usuario o a un contacto del círculo.' }
  }

  let assignedContactId: string | null = null

  if (!asignarAOwner && nombreContactoAsignado) {
    const { data: contactData } = await supabaseAdmin
      .from('contacts')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', `%${nombreContactoAsignado}%`)
      .limit(1)
      .maybeSingle()

    if (!contactData) {
      return {
        success: false,
        error:   `No encontré un contacto llamado "${nombreContactoAsignado}" en el círculo.`,
      }
    }
    assignedContactId = contactData.id
  }

  const taskPayload: Record<string, unknown> = {
    title:               titulo,
    description:         descripcion,
    due_date:            due_date,
    assigned_to_user:    asignarAOwner,
    assigned_contact_id: assignedContactId,
    status:              'pendiente',
  }

  if (case_type === 'compartido') {
    taskPayload.shared_case_id = case_id
  } else {
    taskPayload.case_id = case_id
  }

  const { data: tareaData, error: tareaErr } = await supabaseAdmin
    .from('tasks')
    .insert(taskPayload)
    .select('id')
    .single()

  if (tareaErr || !tareaData) {
    return { success: false, error: tareaErr?.message ?? 'Error al crear tarea' }
  }

  await insertHistory(case_id, case_type, 'tarea_agregada', titulo)

  return {
    success: true,
    id:      tareaData.id,
    summary: `Tarea "${titulo}" creada correctamente.`,
  }
}

async function toolCompletarTarea(
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const tituloTarea = String(input.titulo_tarea ?? '')
  const case_id     = String(input.case_id      ?? '')
  const case_type   = String(input.case_type    ?? 'propio')
  const caseCol     = case_type === 'compartido' ? 'shared_case_id' : 'case_id'

  const { data: tareaData } = await supabaseAdmin
    .from('tasks')
    .select('id, title')
    .eq(caseCol, case_id)
    .eq('status', 'pendiente')
    .ilike('title', `%${tituloTarea}%`)
    .limit(1)
    .maybeSingle()

  if (!tareaData) {
    return { success: false, error: 'No encontré esa tarea pendiente.' }
  }

  const { error: updateErr } = await supabaseAdmin
    .from('tasks')
    .update({ status: 'completada' })
    .eq('id', tareaData.id)

  if (updateErr) {
    return { success: false, error: updateErr.message ?? 'Error al completar tarea' }
  }

  await insertHistory(case_id, case_type, 'tarea_completada', `Tarea completada: ${tareaData.title}`)

  return {
    success: true,
    summary: `Tarea "${tareaData.title}" marcada como completada.`,
  }
}

async function toolRegistrarEvento(
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const case_id     = String(input.case_id    ?? '')
  const case_type   = String(input.case_type  ?? 'propio')
  const tipo        = String(input.tipo       ?? '')
  const titulo      = String(input.titulo     ?? '')
  const descripcion = input.descripcion ? String(input.descripcion) : undefined

  await insertHistory(case_id, case_type, tipo, titulo, descripcion)

  return {
    success: true,
    summary: `Evento "${titulo}" registrado en el historial.`,
  }
}

async function toolActualizarResumenCaso(
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const case_id            = String(input.case_id             ?? '')
  const nuevoAiSummary     = String(input.nuevo_ai_summary    ?? '')
  const nuevoAiNextStep    = String(input.nuevo_ai_next_step  ?? '')

  const { error: updateErr } = await supabaseAdmin
    .from('cases')
    .update({ ai_summary: nuevoAiSummary, ai_next_step: nuevoAiNextStep })
    .eq('id', case_id)

  if (updateErr) {
    return { success: false, error: updateErr.message ?? 'Error al actualizar resumen' }
  }

  await supabaseAdmin
    .from('case_history')
    .insert({
      case_id,
      event_type: 'actualizacion_general',
      title:      'Resumen del caso actualizado',
    })

  return {
    success: true,
    summary: 'Resumen y próximo paso del caso actualizados correctamente.',
  }
}

async function toolActualizarContacto(
  input:  Record<string, unknown>,
  userId: string,
): Promise<Record<string, unknown>> {
  const nombreBusqueda = String(input.nombre_busqueda ?? '')

  const { data: contacto } = await supabaseAdmin
    .from('contacts')
    .select('id, name')
    .eq('user_id', userId)
    .ilike('name', `%${nombreBusqueda}%`)
    .limit(1)
    .maybeSingle()

  if (!contacto) {
    return { success: false, error: `No encontré un contacto llamado "${nombreBusqueda}" en el círculo.` }
  }

  const updates: Record<string, unknown> = {}
  if (input.nuevo_nombre)      updates.name         = String(input.nuevo_nombre)
  if (input.nueva_relacion)    updates.relationship = String(input.nueva_relacion)
  if (input.nuevo_rol)         updates.role         = String(input.nuevo_rol)
  if (input.nueva_proximidad)  updates.proximity    = String(input.nueva_proximidad)
  if (input.nuevas_notas)      updates.notes        = String(input.nuevas_notas)
  if (input.nuevo_telefono)    updates.phone        = String(input.nuevo_telefono)
  if (input.nuevo_email)       updates.email        = String(input.nuevo_email)

  if (Object.keys(updates).length === 0) {
    return { success: false, error: 'No especificaste qué actualizar del contacto.' }
  }

  const { error } = await supabaseAdmin
    .from('contacts')
    .update(updates)
    .eq('id', contacto.id)

  if (error) return { success: false, error: error.message }

  return { success: true, summary: `Contacto "${contacto.name}" actualizado correctamente.` }
}

async function toolEliminarContacto(
  input:  Record<string, unknown>,
  userId: string,
): Promise<Record<string, unknown>> {
  const nombreBusqueda = String(input.nombre_busqueda ?? '')

  const { data: contacto } = await supabaseAdmin
    .from('contacts')
    .select('id, name')
    .eq('user_id', userId)
    .ilike('name', `%${nombreBusqueda}%`)
    .limit(1)
    .maybeSingle()

  if (!contacto) {
    return { success: false, error: `No encontré un contacto llamado "${nombreBusqueda}" en el círculo.` }
  }

  const { error } = await supabaseAdmin
    .from('contacts')
    .delete()
    .eq('id', contacto.id)

  if (error) return { success: false, error: error.message }

  return { success: true, summary: `Contacto "${contacto.name}" eliminado del círculo.` }
}

async function toolEditarTarea(
  input:  Record<string, unknown>,
  userId: string,
): Promise<Record<string, unknown>> {
  const tituloBusqueda = String(input.titulo_busqueda ?? '')
  const caseId         = String(input.case_id   ?? '')
  const caseType       = String(input.case_type ?? 'propio')
  const caseCol        = caseType === 'compartido' ? 'shared_case_id' : 'case_id'

  const { data: tarea } = await supabaseAdmin
    .from('tasks')
    .select('id, title')
    .eq(caseCol, caseId)
    .eq('status', 'pendiente')
    .ilike('title', `%${tituloBusqueda}%`)
    .limit(1)
    .maybeSingle()

  if (!tarea) {
    return { success: false, error: 'No encontré una tarea pendiente con ese título.' }
  }

  const updates: Record<string, unknown> = {}
  if (input.nuevo_titulo)      updates.title       = String(input.nuevo_titulo)
  if (input.nueva_descripcion) updates.description = String(input.nueva_descripcion)
  if (input.nueva_due_date)    updates.due_date    = String(input.nueva_due_date)

  if (input.reasignar_a_owner === true) {
    updates.assigned_to_user    = true
    updates.assigned_contact_id = null
  } else if (input.reasignar_a_contacto) {
    const nombreContacto = String(input.reasignar_a_contacto)
    const { data: contacto } = await supabaseAdmin
      .from('contacts')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', `%${nombreContacto}%`)
      .limit(1)
      .maybeSingle()
    if (!contacto) {
      return { success: false, error: `No encontré a "${nombreContacto}" en el círculo.` }
    }
    updates.assigned_to_user    = false
    updates.assigned_contact_id = contacto.id
  }

  if (Object.keys(updates).length === 0) {
    return { success: false, error: 'No especificaste qué editar de la tarea.' }
  }

  const { error } = await supabaseAdmin
    .from('tasks')
    .update(updates)
    .eq('id', tarea.id)

  if (error) return { success: false, error: error.message }

  await insertHistory(caseId, caseType, 'actualizacion_general', `Tarea editada: ${tarea.title}`)

  return { success: true, summary: `Tarea "${tarea.title}" actualizada correctamente.` }
}

async function toolEliminarTarea(
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const tituloBusqueda = String(input.titulo_busqueda ?? '')
  const caseId         = String(input.case_id   ?? '')
  const caseType       = String(input.case_type ?? 'propio')
  const caseCol        = caseType === 'compartido' ? 'shared_case_id' : 'case_id'

  const { data: tarea } = await supabaseAdmin
    .from('tasks')
    .select('id, title')
    .eq(caseCol, caseId)
    .ilike('title', `%${tituloBusqueda}%`)
    .limit(1)
    .maybeSingle()

  if (!tarea) {
    return { success: false, error: 'No encontré una tarea con ese título.' }
  }

  const { error } = await supabaseAdmin
    .from('tasks')
    .delete()
    .eq('id', tarea.id)

  if (error) return { success: false, error: error.message }

  await insertHistory(caseId, caseType, 'actualizacion_general', `Tarea eliminada: ${tarea.title}`)

  return { success: true, summary: `Tarea "${tarea.title}" eliminada.` }
}

// ── 10. Helpers ───────────────────────────────────────────────────────────────

async function insertHistory(
  caseId:      string,
  caseType:    string,
  eventType:   string,
  title:       string,
  description?: string,
): Promise<void> {
  if (caseType === 'compartido') {
    await supabaseAdmin
      .from('shared_case_history')
      .insert({
        shared_case_id: caseId,
        event_type:     eventType,
        title,
        description:    description ?? null,
      })
  } else {
    await supabaseAdmin
      .from('case_history')
      .insert({
        case_id:     caseId,
        event_type:  eventType,
        title,
        description: description ?? null,
      })
  }
}

/** Escapes a value for safe embedding in XML. */
function esc(value: string | null | undefined): string {
  if (!value) return ''
  return String(value)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;')
}

/** Returns how many full days have elapsed since `dateStr`. */
function daysSince(dateStr: string | null | undefined): number {
  if (!dateStr) return 0
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

/**
 * Converts a YYYY-MM-DD due date to a human-readable Spanish string:
 * 'sin fecha' / 'vencida' / 'hoy' / 'mañana' / 'en N días' / 'DD/MM/YYYY'
 */
function describeDueDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'sin fecha'

  const due    = new Date(dateStr)
  const today  = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())

  const diffDays = Math.round(
    (dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (diffDays <  0) return 'vencida'
  if (diffDays === 0) return 'hoy'
  if (diffDays === 1) return 'mañana'
  if (diffDays <= 7)  return `en ${diffDays} días`

  return due.toLocaleDateString('es-AR', {
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric',
  })
}

/**
 * Enforces strict user/assistant alternation required by the Anthropic API:
 * 1. Merges consecutive messages from the same role (concatenates content).
 * 2. Strips any trailing assistant messages so the list always ends on a user turn.
 */
function ensureAlternation(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  if (messages.length === 0) return []

  // Step 1 — merge consecutive same-role messages
  const merged: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (const msg of messages) {
    const last = merged[merged.length - 1]
    if (last && last.role === msg.role) {
      last.content = last.content + '\n' + msg.content
    } else {
      merged.push({ role: msg.role, content: msg.content })
    }
  }

  // Step 2 — remove trailing assistant messages
  while (merged.length > 0 && merged[merged.length - 1].role === 'assistant') {
    merged.pop()
  }

  return merged
}
