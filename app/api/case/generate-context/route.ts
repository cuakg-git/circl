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
    // ── Auth ────────────────────────────────────────────────────────────────
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token ?? '')
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = await req.json()
    const { case_id, shared_case_id, member_id, mode } = body

    if (!case_id && !shared_case_id) {
      return NextResponse.json(
        { error: 'Se requiere case_id o shared_case_id' },
        { status: 400 },
      )
    }

    if (shared_case_id && !member_id) {
      return NextResponse.json(
        { error: 'Se requiere member_id cuando se usa shared_case_id' },
        { status: 400 },
      )
    }

    // ── Tema PROPIO ─────────────────────────────────────────────────────────
    if (case_id) {
      // 1. Leer el case
      const { data: caseData, error: caseErr } = await supabase
        .from('cases')
        .select('id, name, description, category, ai_summary, started_at')
        .eq('id', case_id)
        .eq('user_id', user.id)
        .single()

      if (caseErr || !caseData) {
        return NextResponse.json({ error: 'Tema no encontrado' }, { status: 404 })
      }

      // 2. Leer en paralelo: contactos, tareas pendientes, historial
      const [contactsRes, tasksRes, historyRes] = await Promise.all([
        supabase
          .from('case_contacts')
          .select('contact:contacts(name, relationship, role, proximity, notes)')
          .eq('case_id', case_id),
        supabase
          .from('tasks')
          .select('title, description, due_date, assigned_to_user, assigned_contact:contacts(name)')
          .eq('case_id', case_id)
          .eq('status', 'pendiente')
          .order('due_date', { ascending: true, nullsFirst: false }),
        supabase
          .from('case_history')
          .select('event_type, title, description, occurred_at')
          .eq('case_id', case_id)
          .order('occurred_at', { ascending: false })
          .limit(10),
      ])

      const contacts = (contactsRes.data ?? []) as any[]
      const tasks    = (tasksRes.data    ?? []) as any[]
      const history  = (historyRes.data  ?? []) as any[]

      // ── chat_init mode ────────────────────────────────────────────────────
      if (mode === 'chat_init') {
        const tareasTexto = tasks.map((t: any) => {
          const asignada = t.assigned_to_user ? 'vos' : t.assigned_contact?.name ?? 'sin asignar'
          return `- ${t.title} → ${asignada}${t.due_date ? `, vence ${t.due_date}` : ''}`
        }).join('\n') || 'Sin tareas pendientes'

        const historialTexto = history.map((h: any) =>
          `- [${h.event_type}] ${h.title}${h.description ? ': ' + h.description : ''}`
        ).join('\n') || 'Sin historial'

        const chatInitPrompt = `Sos el agente Mhiru. Tenés el siguiente contexto sobre un tema que un grupo de personas está coordinando juntas:

Nombre: ${caseData.name}
Descripción: ${caseData.description ?? 'No especificada'}
Resumen actual: ${caseData.ai_summary ?? 'Sin resumen todavía'}

TAREAS PENDIENTES:
${tareasTexto}

HISTORIAL RECIENTE:
${historialTexto}

Tu tarea: generá UNA pregunta corta y concreta para entender mejor el estado actual del tema, y 3 opciones de respuesta rápida (chips) que el usuario pueda elegir.

Respondé SOLO con este JSON (sin markdown, sin backticks):
{
  "question": "...",
  "suggestions": ["...", "...", "..."]
}`

        const chatInitResponse = await anthropic.messages.create({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 300,
          messages:   [{ role: 'user', content: chatInitPrompt }],
        })
        const rawText = chatInitResponse.content[0].type === 'text'
          ? chatInitResponse.content[0].text.trim()
          : ''

        try {
          const parsed = JSON.parse(rawText)
          return NextResponse.json({ question: parsed.question, suggestions: parsed.suggestions })
        } catch {
          return NextResponse.json({
            question:    '¿Hay novedades sobre este tema?',
            suggestions: ['Hubo novedades', 'Todo sigue igual', 'Quiero actualizar el resumen'],
          })
        }
      }

      // 3. Construir prompt
      const prompt = `Sos un asistente de coordinación y organización.
Basándote en la siguiente información sobre una situación,
generá un resumen conciso (2-4 oraciones) que capture:
- Qué está pasando
- Quiénes están involucrados
- Qué hay pendiente
- Cuál es el próximo paso más importante

Escribí en primera persona del observador, en español rioplatense,
tono cálido y directo. Sin bullets ni listas.
El tema puede ser cualquier tipo de situación que un grupo
de personas quiera coordinar juntas — no te limites a crisis
de salud.

DATOS DEL TEMA:
Nombre: ${caseData.name}
Descripción: ${caseData.description ?? 'No especificada'}
Categoría: ${caseData.category ?? 'No especificada'}

CÍRCULO (${contacts.length} personas):
${contacts.map((cc: any) => {
  const c = cc.contact
  return `- ${c.name} (${c.relationship}, ${c.role})`
}).join('\n') || 'Sin contactos registrados'}

TAREAS PENDIENTES (${tasks.length}):
${tasks.map((t: any) => {
  const asignada = t.assigned_to_user ? 'vos' : t.assigned_contact?.name ?? 'sin asignar'
  return `- ${t.title} → ${asignada}${t.due_date ? `, vence ${t.due_date}` : ''}`
}).join('\n') || 'Sin tareas pendientes'}

HISTORIAL RECIENTE:
${history.map((h: any) => `- [${h.event_type}] ${h.title}${h.description ? ': ' + h.description : ''}`).join('\n') || 'Sin historial'}

Generá el resumen ahora:`

      // 4. Llamar a Claude
      const response = await anthropic.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages:   [{ role: 'user', content: prompt }],
      })
      const summary = response.content[0].type === 'text'
        ? response.content[0].text.trim()
        : ''

      // 5. Persistir
      const { error: updateErr } = await supabase
        .from('cases')
        .update({ ai_summary: summary })
        .eq('id', case_id)

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }

      // 6. Devolver
      return NextResponse.json({ summary })
    }

    // ── Tema COMPARTIDO ─────────────────────────────────────────────────────
    if (shared_case_id) {
      // 1. Leer el shared_case
      const { data: sharedCase, error: scErr } = await supabase
        .from('shared_cases')
        .select('id, name, description, ai_summary')
        .eq('id', shared_case_id)
        .single()

      if (scErr || !sharedCase) {
        return NextResponse.json({ error: 'Tema compartido no encontrado' }, { status: 404 })
      }

      // 2. Verificar membresía activa
      const { data: member, error: memberErr } = await supabase
        .from('shared_case_members')
        .select('id, personal_context')
        .eq('id', member_id)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single()

      if (memberErr || !member) {
        return NextResponse.json(
          { error: 'No sos miembro activo de este tema' },
          { status: 403 },
        )
      }

      // 3. Leer en paralelo: miembros, historial, tasks
      const [membersRes, historyRes, tasksRes] = await Promise.all([
        supabase
          .from('shared_case_members')
          .select('email, profile:profiles!shared_case_members_user_id_fkey(full_name)')
          .eq('shared_case_id', shared_case_id)
          .eq('status', 'active'),
        supabase
          .from('shared_case_history')
          .select('event_type, title, description, occurred_at')
          .eq('shared_case_id', shared_case_id)
          .order('occurred_at', { ascending: false })
          .limit(10),
        supabase
          .from('tasks')
          .select('title, description, due_date, assigned_to_user, assigned_contact:contacts(name)')
          .eq('shared_case_id', shared_case_id)
          .eq('status', 'pendiente')
          .order('due_date', { ascending: true, nullsFirst: false }),
      ])

      const members = (membersRes.data ?? []) as any[]
      const history = (historyRes.data ?? []) as any[]
      const tasks   = (tasksRes.data   ?? []) as any[]

      // ── chat_update mode ─────────────────────────────────────────────────
      if (mode === 'chat_update') {
        const { user_message, conversation_history = [] } = body

        // Leer datos del tema
        const [membersRes, historyRes, tasksRes] = await Promise.all([
          supabase
            .from('shared_case_members')
            .select('email, personal_context, profile:profiles!shared_case_members_user_id_fkey(full_name)')
            .eq('shared_case_id', shared_case_id)
            .eq('status', 'active'),
          supabase
            .from('shared_case_history')
            .select('event_type, title, description, occurred_at')
            .eq('shared_case_id', shared_case_id)
            .order('occurred_at', { ascending: false })
            .limit(10),
          supabase
            .from('tasks')
            .select('title, description, due_date, assigned_to_user, assigned_contact:contacts(name)')
            .eq('shared_case_id', shared_case_id)
            .eq('status', 'pendiente')
            .order('due_date', { ascending: true, nullsFirst: false }),
        ])

        const members = (membersRes.data ?? []) as any[]
        const history = (historyRes.data ?? []) as any[]
        const tasks   = (tasksRes.data   ?? []) as any[]

        const participantesTexto = members.map((m: any) => {
          const name = (m.profile as any)?.full_name || m.email
          const ctx  = m.personal_context ? ` — contexto: ${m.personal_context}` : ''
          return `- ${name}${ctx}`
        }).join('\n') || 'Sin participantes'

        const tareasTexto = tasks.map((t: any) => {
          const asignada = t.assigned_to_user ? 'vos' : t.assigned_contact?.name ?? 'sin asignar'
          return `- ${t.title} → ${asignada}${t.due_date ? `, vence ${t.due_date}` : ''}`
        }).join('\n') || 'Sin tareas pendientes'

        const historialTexto = history.map((h: any) =>
          `- [${h.event_type}] ${h.title}${h.description ? ': ' + h.description : ''}`
        ).join('\n') || 'Sin historial'

        const updatePrompt = `Sos el agente Mhiru coordinando un tema grupal.

TEMA: ${sharedCase.name}
Descripción: ${sharedCase.description ?? 'No especificada'}
Contexto actual: ${sharedCase.ai_summary ?? 'Sin contexto todavía'}

PARTICIPANTES:
${participantesTexto}

TAREAS PENDIENTES:
${tareasTexto}

HISTORIAL:
${historialTexto}

CONVERSACIÓN HASTA AHORA:
${conversation_history.map((m: any) => `${m.role === 'user' ? 'Usuario' : 'Mhiru'}: ${m.content}`).join('\n')}

Último mensaje del usuario: "${user_message}"

Tu tarea tiene DOS partes:

1. RESPUESTA AL USUARIO: Respondé al último mensaje de forma
   breve, cálida y útil. Podés hacer una pregunta de seguimiento
   o confirmar lo que entendiste.

2. CONTEXTO ACTUALIZADO: Actualizá el contexto del tema
   incorporando lo que el usuario acaba de compartir. Describí:
   - Qué está sucediendo en el tema
   - Cuáles son los hitos o pasos importantes
   - Cómo está participando cada persona
   - Por qué lo están coordinando juntos

   Escribí en tercera persona, objetivo, sin "yo". Tono cálido,
   español rioplatense. 2-4 oraciones.

Respondé SOLO con este JSON (sin markdown, sin backticks):
{
  "reply": "...",
  "summary": "..."
}`

        const response = await anthropic.messages.create({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 500,
          messages:   [{ role: 'user', content: updatePrompt }],
        })

        const rawText = response.content[0].type === 'text'
          ? response.content[0].text.trim()
          : ''

        try {
          const parsed = JSON.parse(rawText)

          // Persistir el nuevo contexto
          await supabase
            .from('shared_cases')
            .update({ ai_summary: parsed.summary })
            .eq('id', shared_case_id)

          return NextResponse.json({
            reply:   parsed.reply,
            summary: parsed.summary,
          })
        } catch {
          return NextResponse.json({
            reply:   'Entendido, seguí contándome.',
            summary: sharedCase.ai_summary ?? '',
          })
        }
      }

      // ── chat_init mode ────────────────────────────────────────────────────
      if (mode === 'chat_init') {
        const tareasTexto = tasks.map((t: any) => {
          const asignada = t.assigned_to_user ? 'vos' : t.assigned_contact?.name ?? 'sin asignar'
          return `- ${t.title} → ${asignada}${t.due_date ? `, vence ${t.due_date}` : ''}`
        }).join('\n') || 'Sin tareas pendientes'

        const historialTexto = history.map((h: any) =>
          `- [${h.event_type}] ${h.title}${h.description ? ': ' + h.description : ''}`
        ).join('\n') || 'Sin historial'

        const chatInitPrompt = `Sos el agente Mhiru. Tenés el siguiente contexto sobre un tema que un grupo de personas está coordinando juntas:

Nombre: ${sharedCase.name}
Descripción: ${sharedCase.description ?? 'No especificada'}
Resumen actual: ${sharedCase.ai_summary ?? 'Sin resumen todavía'}

TAREAS PENDIENTES:
${tareasTexto}

HISTORIAL RECIENTE:
${historialTexto}

Tu tarea: generá UNA pregunta corta y concreta para entender mejor el estado actual del tema, y 3 opciones de respuesta rápida (chips) que el usuario pueda elegir.

Respondé SOLO con este JSON (sin markdown, sin backticks):
{
  "question": "...",
  "suggestions": ["...", "...", "..."]
}`

        const chatInitResponse = await anthropic.messages.create({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 300,
          messages:   [{ role: 'user', content: chatInitPrompt }],
        })
        const rawText = chatInitResponse.content[0].type === 'text'
          ? chatInitResponse.content[0].text.trim()
          : ''

        try {
          const parsed = JSON.parse(rawText)
          return NextResponse.json({ question: parsed.question, suggestions: parsed.suggestions })
        } catch {
          return NextResponse.json({
            question:    '¿Hay novedades sobre este tema?',
            suggestions: ['Hubo novedades', 'Todo sigue igual', 'Quiero actualizar el resumen'],
          })
        }
      }

      // 4. Construir prompt
      const prompt = `Sos un asistente de coordinación y organización.
Basándote en la siguiente información sobre un tema compartido,
generá un contexto (2-4 oraciones) que describa:
- Qué está sucediendo en el tema
- Cuáles son los hitos o pasos importantes
- Cómo está participando cada persona
- Por qué lo están coordinando juntos

Escribí en tercera persona, de forma objetiva. En español
rioplatense, tono cálido y directo. Sin bullets ni listas.
Nunca uses "yo" ni primera persona. El tema puede ser cualquier
tipo de situación grupal — no te limites a crisis de salud.

DATOS DEL TEMA COMPARTIDO:
Nombre: ${sharedCase.name}
Descripción: ${sharedCase.description ?? 'No especificada'}
Contexto previo: ${sharedCase.ai_summary ?? 'Sin contexto todavía'}

PARTICIPANTES (${members.length}):
${members.map((m: any) => {
  const name = (m.profile as any)?.full_name || m.email
  const ctx  = (m as any).personal_context ? ` — ${(m as any).personal_context}` : ''
  return `- ${name}${ctx}`
}).join('\n') || 'Sin otros participantes'}

TAREAS PENDIENTES (${tasks.length}):
${tasks.map((t: any) => {
  const asignada = t.assigned_to_user ? 'vos' : t.assigned_contact?.name ?? 'sin asignar'
  return `- ${t.title} → ${asignada}${t.due_date ? `, vence ${t.due_date}` : ''}`
}).join('\n') || 'Sin tareas pendientes'}

HISTORIAL RECIENTE:
${history.map((h: any) => `- [${h.event_type}] ${h.title}${h.description ? ': ' + h.description : ''}`).join('\n') || 'Sin historial'}

Generá el contexto ahora:`

      // 5. Llamar a Claude
      const response = await anthropic.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages:   [{ role: 'user', content: prompt }],
      })
      const summary = response.content[0].type === 'text'
        ? response.content[0].text.trim()
        : ''

      // 6. Persistir
      const { error: updateErr } = await supabase
        .from('shared_cases')
        .update({ ai_summary: summary })
        .eq('id', shared_case_id)

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }

      // 7. Devolver
      return NextResponse.json({ summary })
    }

    // No debería llegar acá
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })

  } catch (err: any) {
    console.error('[generate-context]', err)
    return NextResponse.json(
      { error: err?.message ?? 'Error interno del servidor' },
      { status: 500 },
    )
  }
}
