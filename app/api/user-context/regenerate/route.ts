import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const supabase  = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const STYLE = `Español rioplatense, segunda persona (vos).
Tono: presencia tranquila. Como alguien que ya pasó por esto
y sabe lo que hay que hacer. Directo sin ser frío. Humano sin
ser emotivo. No nombrés el dolor — reconocelo implícitamente
y actuá.

Reglas estrictas:
- NUNCA arranques con el nombre del usuario. Arrancá con un
  verbo o con la situación directamente.
- Oraciones cortas. Máximo 2-3 por dimensión.
- Sin metáforas de viaje o batalla.
- Sin palabras: "comunidad", "familia" (abstracto), "guerrero",
  "camino", "proceso", "lucha".
- Solo prosa, sin bullets ni listas.
- No describas — actuá. Verbos activos, sujeto implícito.`

async function generate(prompt: string): Promise<string> {
  const res = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages:   [{ role: 'user', content: prompt }],
  })
  return res.content[0].type === 'text' ? res.content[0].text.trim() : ''
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token ?? '')
    if (authErr || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    const userId    = user.id
    const userEmail = user.email

    // ── Dimensiones a regenerar ───────────────────────────────────
    let dimensions: string[] = []
    try {
      const body = await req.json()
      dimensions = body.dimensions ?? []
    } catch {
      // body vacío → regenerar todo
    }
    const all = dimensions.length === 0
    const has = (d: string) => all || dimensions.includes(d)

    // ── Leer datos de Supabase en paralelo ────────────────────────
    const [profileRes, casesRes, sharedRes, contactsRes] =
      await Promise.all([
        supabase
          .from('profiles')
          .select('full_name, avatar_url, location, health_insurance, created_at, phone')
          .eq('id', userId)
          .maybeSingle(),

        supabase
          .from('cases')
          .select('id, name, status, category, ai_summary, started_at')
          .eq('user_id', userId)
          .order('started_at', { ascending: false }),

        supabase
          .from('shared_case_members')
          .select(`
            shared_case_id,
            joined_at,
            shared_case:shared_cases!inner(id, name, status, ai_summary, created_at)
          `)
          .eq('user_id', userId)
          .eq('status', 'active'),

        supabase
          .from('contacts')
          .select('name, relationship, role, proximity, notes')
          .eq('user_id', userId),
      ])

    const profile  = profileRes.data
    const cases    = (casesRes.data ?? []) as any[]
    const shared   = (sharedRes.data ?? []) as any[]
    const contacts = (contactsRes.data ?? []) as any[]
    const caseIds  = cases.map((c: any) => c.id)

    // ── Leer tareas e historial con los case_ids reales ───────────
    const [tasksData, historyData] = await Promise.all([
      caseIds.length > 0
        ? supabase
            .from('tasks')
            .select('title, status, due_date, case_id')
            .in('case_id', caseIds)
            .eq('status', 'pendiente')
            .order('due_date', { ascending: true, nullsFirst: false })
            .limit(20)
            .then(r => r.data ?? [])
        : Promise.resolve([]),

      caseIds.length > 0
        ? supabase
            .from('case_history')
            .select('event_type, title, description, occurred_at')
            .in('case_id', caseIds)
            .order('occurred_at', { ascending: false })
            .limit(15)
            .then(r => r.data ?? [])
        : Promise.resolve([]),
    ])

    // ── Textos auxiliares ─────────────────────────────────────────
    const nombreUsuario = profile?.full_name ?? userEmail ?? 'el usuario'
    const ubicacion     = profile?.location ?? ''
    const obraSocial    = profile?.health_insurance ?? ''
    const miembroDesde  = profile?.created_at
      ? new Date(profile.created_at).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
      : 'recientemente'

    const casesTexto = cases.map((c: any) =>
      `- ${c.name} (${c.status})${c.ai_summary ? ': ' + c.ai_summary : ''}`
    ).join('\n') || 'Sin temas propios'

    const sharedTexto = shared.map((m: any) => {
      const sc = (m.shared_case as any)
      return `- ${sc.name} (${sc.status})${sc.ai_summary ? ': ' + sc.ai_summary : ''}`
    }).join('\n') || 'Sin temas compartidos'

    const contactosTexto = contacts.map((c: any) =>
      `- ${c.name} (${c.relationship ?? c.role ?? 'sin rol'}, cercanía: ${c.proximity ?? 'no especificada'})${c.notes ? ' — ' + c.notes : ''}`
    ).join('\n') || 'Sin contactos registrados'

    const tareasTexto = (tasksData as any[]).map((t: any) =>
      `- ${t.title}${t.due_date ? ` (vence ${t.due_date})` : ''}`
    ).join('\n') || 'Sin tareas pendientes'

    const historialTexto = (historyData as any[]).map((h: any) =>
      `- [${h.event_type}] ${h.title}${h.description ? ': ' + h.description : ''}`
    ).join('\n') || 'Sin historial reciente'

    // ── Generar dimensiones en paralelo ───────────────────────────
    const [identity, history, currentState, currentNeeds, circleSummary, themesSummary] =
      await Promise.all([

        has('identity') ? generate(`
Sintetizá quién es este usuario en 2-3 oraciones.
${STYLE}

DATOS:
Nombre: ${nombreUsuario}
Miembro desde: ${miembroDesde}
Ubicación: ${ubicacion || 'No especificada'}
Obra social: ${obraSocial || 'No especificada'}

Describí quién es, desde dónde se para, y qué lo caracteriza.
Arrancá con "Sos..." o con una observación directa sobre su perfil.
Sin mencionar el nombre en el texto.
`) : Promise.resolve(null),

        has('history') ? generate(`
Sintetizá la trayectoria de este usuario en Mhiru en 2-3 oraciones.
${STYLE}

DATOS:
Miembro desde: ${miembroDesde}
Temas propios: ${cases.length}
Temas compartidos: ${shared.length}
Historial reciente:
${historialTexto}

Describí qué situaciones atravesó y cómo evolucionó.
Arrancá con "Empezaste...", "Desde que...", o similar.
Sin mencionar el nombre en el texto.
`) : Promise.resolve(null),

        has('current_state') ? generate(`
Describí cómo está este usuario hoy en 2-3 oraciones.
${STYLE}

DATOS:
Temas activos propios: ${cases.filter((c: any) => c.status === 'activa').length}
Temas compartidos activos: ${shared.length}
Tareas pendientes:
${tareasTexto}
Historial reciente:
${historialTexto}

Describí su carga real sin dramatizarla.
Arrancá con "Tenés...", "Estás...", "Esta semana..." o similar.
Sin mencionar el nombre en el texto.
`) : Promise.resolve(null),

        has('current_needs') ? generate(`
Identificá qué necesita este usuario ahora en 1-2 oraciones.
${STYLE}

DATOS:
Tareas pendientes:
${tareasTexto}
Temas propios:
${casesTexto}
Temas compartidos:
${sharedTexto}

Una o dos necesidades concretas y accionables.
Arrancá con "Necesitás...", "Lo más urgente es...", o similar.
Sin mencionar el nombre en el texto.
`) : Promise.resolve(null),

        has('circle_summary') ? generate(`
Describí el círculo de apoyo de este usuario en 2-3 oraciones.
${STYLE}

DATOS:
Contactos (${contacts.length}):
${contactosTexto}

Describí quiénes están cerca y qué función cumplen.
Arrancá con "Contás con...", "Tu círculo tiene...", "Tenés cerca..." o similar.
Sin mencionar el nombre del usuario en el texto.
`) : Promise.resolve(null),

        has('themes_summary') ? generate(`
Describí los temas activos de este usuario en 2-3 oraciones.
${STYLE}

DATOS:
Temas propios:
${casesTexto}
Temas compartidos:
${sharedTexto}

Describí qué está gestionando y qué lugar ocupa en su agenda.
Arrancá con "Tenés activo...", "Estás coordinando...", o similar.
Sin mencionar el nombre del usuario en el texto.
`) : Promise.resolve(null),

      ])

    // ── Construir objeto a persistir ──────────────────────────────
    const update: Record<string, any> = { last_regen_at: new Date().toISOString() }
    if (identity      !== null) update.identity       = identity
    if (history       !== null) update.history        = history
    if (currentState  !== null) update.current_state  = currentState
    if (currentNeeds  !== null) update.current_needs  = currentNeeds
    if (circleSummary !== null) update.circle_summary = circleSummary
    if (themesSummary !== null) update.themes_summary = themesSummary

    // ── Upsert en user_context ────────────────────────────────────
    const { error: upsertErr } = await supabase
      .from('user_context')
      .upsert({ user_id: userId, ...update })

    if (upsertErr) {
      return NextResponse.json(
        { error: upsertErr.message ?? 'Error al guardar contexto' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, summary: update })

  } catch (err: any) {
    console.error('[user-context/regenerate]', err)
    return NextResponse.json(
      { error: err?.message ?? 'Error interno' },
      { status: 500 }
    )
  }
}
