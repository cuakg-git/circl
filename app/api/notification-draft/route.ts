import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const NOTIFICATION_CONTEXTS: Record<string, string> = {
  task_assigned: 'Se le asignó una tarea específica y necesita saber qué se espera de ella.',
  task_reminder: 'Tiene una tarea asignada próxima a vencer y necesita un recordatorio amable.',
  help_request: 'Se le está pidiendo ayuda general en el contexto de una situación familiar difícil.',
  help_request_specific: 'Se le está pidiendo ayuda con un tema específico relacionado con su rol o expertise.',
  crisis_update: 'Se le está informando sobre una actualización importante en la situación familiar.',
  shared_case_invite: 'Se le está invitando a sumarse a un tema compartido en Mhiru para coordinar el cuidado en conjunto.',
}

export async function POST(req: NextRequest) {
  try {
    const {
      contact_id,
      notification_type,
      payload,
      owner_name,
    } = await req.json()

    if (!notification_type || !owner_name) {
      return Response.json(
        { error: 'notification_type y owner_name son requeridos' },
        { status: 400 }
      )
    }

    // 1. Leer datos del contacto
    let contact: any

    if (contact_id) {
      // Si contact_id existe, mantener el flujo actual
      const { data: dbContact, error: contactErr } = await supabase
        .from('contacts')
        .select('name, proximity, role, relationship, context_summary, context_description')
        .eq('id', contact_id)
        .maybeSingle()

      if (contactErr || !dbContact) {
        return Response.json({ error: 'Contacto no encontrado' }, { status: 404 })
      }

      contact = dbContact
    } else {
      // Si contact_id NO existe, usar valores por default
      contact = {
        name: payload?.recipient_name ?? 'la persona invitada',
        proximity: null,
        role: null,
        relationship: null,
        context_summary: null,
        context_description: null,
      }
    }

    // 2. Construir contexto del payload
    const payloadLines: string[] = []
    if (payload?.task_title)       payloadLines.push(`Tarea: ${payload.task_title}`)
    if (payload?.task_description) payloadLines.push(`Descripción: ${payload.task_description}`)
    if (payload?.due_date)         payloadLines.push(`Fecha límite: ${payload.due_date}`)
    if (payload?.topic)            payloadLines.push(`Tema: ${payload.topic}`)
    if (payload?.custom_message)   payloadLines.push(`Mensaje del owner: ${payload.custom_message}`)
    const payloadText = payloadLines.length > 0
      ? payloadLines.join('\n')
      : 'Sin datos adicionales.'

    // 3. Construir el prompt
    const proximityLabel: Record<string, string> = {
      nucleo:        'parte del núcleo íntimo (familia o amistad muy cercana)',
      segundo_nivel: 'alguien del segundo nivel de cercanía',
      tercer_nivel:  'alguien del tercer nivel de cercanía',
      prestador:     'un profesional o proveedor de servicios',
    }

    const roleLabel: Record<string, string> = {
      acompanamiento:      'rol de acompañamiento emocional',
      logistico:           'rol logístico (ayuda con trámites, coordinación)',
      prestador_servicios: 'prestador de servicios profesionales',
    }

    const contextStr = [
      contact.context_summary     ? `Resumen de lo que sabe Mhiru sobre esta persona: ${contact.context_summary}` : null,
      contact.context_description ? `Descripción extendida: ${contact.context_description}` : null,
      contact.relationship        ? `Relación con el owner: ${contact.relationship}` : null,
      contact.proximity           ? `Cercanía: ${proximityLabel[contact.proximity] ?? contact.proximity}` : null,
      contact.role                ? `Rol en el círculo: ${roleLabel[contact.role] ?? contact.role}` : null,
    ].filter(Boolean).join('\n')

    const notificationContext = NOTIFICATION_CONTEXTS[notification_type]
      ?? 'Notificación general sobre la situación.'

    const userMessage = `
<owner>${owner_name}</owner>

<destinatario>
  <nombre>${contact.name}</nombre>
${contextStr}
</destinatario>

<tipo_notificacion>${notification_type}</tipo_notificacion>
<contexto_notificacion>${notificationContext}</contexto_notificacion>

<datos>
${payloadText}
</datos>

Redactá el subject y el cuerpo del mail de notificación.
Devolvé SOLO un JSON sin markdown ni code fences con esta forma exacta:
{
  "subject": "...",
  "body": "..."
}
`

    // 4. Llamar a Claude
    const response = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: `Sos Mhiru, un asistente que ayuda a coordinar el cuidado de personas en situaciones de salud o crisis familiar.
Tu tarea es redactar notificaciones por mail a las personas del círculo de apoyo del usuario.

Reglas de tono:
- Si la persona es del núcleo íntimo (familia, amistad cercana): tono cálido, cercano, directo. Evitá formalidades.
- Si es alguien de confianza que ayuda: tono amable y claro, ni demasiado formal ni demasiado íntimo.
- Si es un profesional o prestador: tono respetuoso, claro y concreto. Más formal.
- Siempre adaptá el tono al context_summary si existe — si sabés algo específico de la persona, usalo para personalizar.
- Jamás inventes información que no esté en el contexto.
- El mail debe ser breve (máximo 4-5 oraciones en el cuerpo).
- Escribí en español rioplatense.
- No uses emojis.
- NUNCA uses el nombre de la persona ni apodos o deformaciones de nombres. No sabemos cómo se dirige el usuario a ella.
- NO incluyas ningún saludo de cierre ni firma. El mail termina con el contenido, sin "Muchas gracias", sin "El equipo de Mhiru", sin ningún tipo de despedida.
- El subject debe ser claro y concreto, máximo 8 palabras.
- NUNCA incluyas markdown, code fences, ni texto fuera del JSON.
- Escribí SIEMPRE en primera persona del singular (yo, me, te escribo). NUNCA uses primera persona del plural (nosotros, nos, te escribimos, agredeceríamos). El mensaje lo manda una persona, no un equipo.
- Si no tenés contexto de la persona (campos null), usá el tono institucional de Mhiru: cálido pero concreto, cercano sin ser íntimo, nunca frío ni corporativo.`,
      messages: [{ role: 'user', content: userMessage }],
    })

    // 5. Parsear respuesta
    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .replace(/```json|```/g, '')
      .trim()

    let parsed: { subject: string; body: string }
    try {
      parsed = JSON.parse(raw)
    } catch {
      return Response.json(
        { error: 'No se pudo parsear la respuesta del modelo', raw },
        { status: 500 }
      )
    }

    if (!parsed.subject || !parsed.body) {
      return Response.json(
        { error: 'Respuesta incompleta del modelo', raw },
        { status: 500 }
      )
    }

    return Response.json({
      subject: parsed.subject,
      body:    parsed.body,
    })

  } catch (err: any) {
    return Response.json(
      { error: err.message ?? 'Error interno' },
      { status: 500 }
    )
  }
}
