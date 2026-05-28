import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const supabase  = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const SYSTEM_PROMPT = `Sos un asistente de Mhiru que analiza el contexto
completo de un usuario para generar sugerencias accionables.

Tu output es SIEMPRE un JSON con esta forma exacta, sin texto antes
ni después, sin markdown, sin code fences:

{
  "providers": [
    {
      "title": "Tipo de prestador",
      "description": "Descripción breve del servicio (máx 6 palabras)",
      "metadata": {
        "name": "Tipo de prestador",
        "prestacion": "Descripción ultra corta",
        "razon": "Por qué lo sugerís en 1-2 oraciones mencionando el contexto específico"
      }
    }
  ],
  "chats": [
    {
      "title": "Contactar a [nombre]",
      "description": "Razón breve de por qué contactarlo ahora",
      "metadata": {
        "contact_id": "uuid del contacto",
        "contact_name": "nombre del contacto"
      }
    }
  ],
  "themes": [
    {
      "title": "Nombre sugerido del tema",
      "description": "Por qué crear este tema ahora, en 1-2 oraciones",
      "metadata": {
        "suggested_name": "Nombre sugerido del tema",
        "reason": "Razón detallada"
      }
    }
  ],
  "invitations": [
    {
      "title": "Invitar a [nombre] a [tema]",
      "description": "Por qué esta persona y este tema hacen match",
      "metadata": {
        "contact_id": "uuid del contacto",
        "contact_name": "nombre del contacto",
        "shared_case_id": "uuid del tema compartido",
        "shared_case_name": "nombre del tema compartido"
      }
    }
  ]
}

Reglas:
- Exactamente 3 sugerencias por categoría (providers, chats, themes, invitations)
- providers: no sugerir prestadores que ya existan en la lista actual
- chats: sugerí contactos con quienes haya match temático o que no tuvieron actividad reciente
- themes: sugerí temas nuevos que tendrían sentido dado el contexto del usuario
- invitations: solo sugerí si hay match real entre persona y tema compartido existente. Si no hay match claro, repetí la mejor opción o dejá metadata vacío con title genérico
- Las sugerencias deben ser concretas y personalizadas al contexto
- Español rioplatense, segunda persona, tono cálido y directo
- Nunca uses "usted", siempre "vos"`

export async function POST(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token ?? '')
    if (authErr || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // ── Leer todos los datos del usuario en paralelo ──────────────
    const [
      casesRes, sharedRes, contactsRes,
      providersRes, userCtxRes,
    ] = await Promise.all([
      supabase
        .from('cases')
        .select('id, name, status, category, ai_summary')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false }),

      supabase
        .from('shared_case_members')
        .select(`
          shared_case_id,
          shared_case:shared_cases!inner(id, name, status, ai_summary)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active'),

      supabase
        .from('contacts')
        .select('id, name, relationship, role, proximity, notes')
        .eq('user_id', user.id),

      supabase
        .from('providers')
        .select('name, prestacion')
        .eq('user_id', user.id),

      supabase
        .from('user_context')
        .select('identity, current_state, current_needs, circle_summary, themes_summary')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    const cases     = (casesRes.data    ?? []) as any[]
    const shared    = (sharedRes.data   ?? []) as any[]
    const contacts  = (contactsRes.data ?? []) as any[]
    const providers = (providersRes.data ?? []) as any[]
    const userCtx   = userCtxRes.data

    // ── Construir textos auxiliares ───────────────────────────────
    const casesTexto = cases.map((c: any) =>
      `- [${c.id}] ${c.name} (${c.status})${c.ai_summary ? ': ' + c.ai_summary : ''}`
    ).join('\n') || 'Sin temas propios'

    const sharedTexto = shared.map((m: any) => {
      const sc = m.shared_case as any
      return `- [${sc.id}] ${sc.name} (${sc.status})${sc.ai_summary ? ': ' + sc.ai_summary : ''}`
    }).join('\n') || 'Sin temas compartidos'

    const contactosTexto = contacts.map((c: any) =>
      `- [${c.id}] ${c.name} (${c.relationship ?? c.role ?? 'sin rol'}, cercanía: ${c.proximity ?? 'no especificada'})${c.notes ? ' — ' + c.notes : ''}`
    ).join('\n') || 'Sin contactos'

    const providersTexto = providers.map((p: any) =>
      `- ${p.name}${p.prestacion ? ` (${p.prestacion})` : ''}`
    ).join('\n') || 'Sin prestadores registrados'

    // ── Llamar a Claude ───────────────────────────────────────────
    const userMessage = `<contexto_usuario>

<identidad>${userCtx?.identity ?? 'Sin datos de identidad todavía'}</identidad>
<estado_actual>${userCtx?.current_state ?? 'Sin datos de estado'}</estado_actual>
<necesidades>${userCtx?.current_needs ?? 'Sin datos de necesidades'}</necesidades>
<resumen_circulo>${userCtx?.circle_summary ?? 'Sin datos del círculo'}</resumen_circulo>
<resumen_temas>${userCtx?.themes_summary ?? 'Sin datos de temas'}</resumen_temas>

<temas_propios>
${casesTexto}
</temas_propios>

<temas_compartidos>
${sharedTexto}
</temas_compartidos>

<contactos>
${contactosTexto}
</contactos>

<prestadores_actuales>
${providersTexto}
</prestadores_actuales>

</contexto_usuario>

Generá exactamente 3 sugerencias por categoría.
Para chats e invitations, usá los UUIDs reales de los contactos
y temas compartidos que aparecen entre corchetes arriba.
Devolvé solo el JSON.`

    const response = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 2500,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: userMessage }],
    })

    const textBlock = response.content?.find((b: any) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Claude no devolvió texto')
    }

    // ── Parsear JSON ──────────────────────────────────────────────
    let parsed: {
      providers:   any[]
      chats:       any[]
      themes:      any[]
      invitations: any[]
    }

    try {
      const raw = textBlock.text
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      const cleaned = jsonMatch ? jsonMatch[0].trim() : raw.trim()
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('[suggestions] error parseando JSON:', textBlock.text)
      return NextResponse.json(
        { error: 'Respuesta inválida del agente' },
        { status: 500 }
      )
    }

    // ── Borrar sugerencias pending anteriores ─────────────────────
    await supabase
      .from('suggestions')
      .delete()
      .eq('user_id', user.id)
      .eq('status', 'pending')

    // ── Insertar nuevas sugerencias ───────────────────────────────
    const toInsert: any[] = [
      ...(parsed.providers   ?? []).map((s: any) => ({ user_id: user.id, type: 'provider',   title: s.title, description: s.description, metadata: s.metadata })),
      ...(parsed.chats       ?? []).map((s: any) => ({ user_id: user.id, type: 'chat',       title: s.title, description: s.description, metadata: s.metadata })),
      ...(parsed.themes      ?? []).map((s: any) => ({ user_id: user.id, type: 'theme',      title: s.title, description: s.description, metadata: s.metadata })),
      ...(parsed.invitations ?? []).map((s: any) => ({ user_id: user.id, type: 'invitation', title: s.title, description: s.description, metadata: s.metadata })),
    ]

    if (toInsert.length > 0) {
      const { error: insertErr } = await supabase
        .from('suggestions')
        .insert(toInsert)

      if (insertErr) {
        return NextResponse.json(
          { error: insertErr.message ?? 'Error al guardar sugerencias' },
          { status: 500 }
        )
      }
    }

    // ── Devolver sugerencias agrupadas ────────────────────────────
    return NextResponse.json({
      providers:   parsed.providers   ?? [],
      chats:       parsed.chats       ?? [],
      themes:      parsed.themes      ?? [],
      invitations: parsed.invitations ?? [],
    })

  } catch (err: any) {
    console.error('[suggestions]', err)
    return NextResponse.json(
      { error: err?.message ?? 'Error interno' },
      { status: 500 }
    )
  }
}
