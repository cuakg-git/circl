import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

// ─── Helper: leer y validar la invitación por token ───────────────────────────

async function getInvitation(token: string) {
  const { data, error } = await supabase
    .from('shared_case_invitations')
    .select(`
      id,
      email,
      expires_at,
      used_at,
      shared_case_id,
      member_id,
      shared_cases ( name ),
      shared_case_members ( invited_by )
    `)
    .eq('token', token)
    .maybeSingle()

  if (error || !data) {
    return { invitation: null, err: 'not_found' as const }
  }

  if (data.used_at !== null) {
    return { invitation: null, err: 'used' as const }
  }

  if (new Date(data.expires_at) < new Date()) {
    return { invitation: null, err: 'expired' as const }
  }

  return { invitation: data, err: null }
}

// ─── Helper: leer full_name del invitador ─────────────────────────────────────

async function getInviterName(invited_by: string): Promise<string> {
  const { data } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', invited_by)
    .maybeSingle()

  return data?.full_name ?? 'Alguien'
}

// ─── GET /api/invitacion/[token] ──────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const { invitation, err } = await getInvitation(token)

  if (err === 'not_found') {
    return Response.json({ error: 'Invitación no encontrada' }, { status: 404 })
  }
  if (err === 'used') {
    return Response.json({ error: 'Invitación ya utilizada' }, { status: 410 })
  }
  if (err === 'expired') {
    return Response.json({ error: 'Invitación vencida' }, { status: 410 })
  }

  // invitation is guaranteed non-null here
  const inv = invitation!
  const sharedCaseName = (inv.shared_cases as any)?.name ?? ''
  const invitedBy      = (inv.shared_case_members as any)?.invited_by ?? ''
  const invitedByName  = await getInviterName(invitedBy)

  return Response.json({
    email:            inv.email,
    shared_case_name: sharedCaseName,
    invited_by_name:  invitedByName,
    shared_case_id:   inv.shared_case_id,
    member_id:        inv.member_id,
  })
}

// ─── POST /api/invitacion/[token] ─────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params

    // 1. Autenticar usuario via Authorization header
    const authToken = req.headers.get('authorization')?.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authToken ?? '')

    if (authErr || !user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }

    // 2. Validar invitación (mismo helper que GET)
    const { invitation, err } = await getInvitation(token)

    if (err === 'not_found') {
      return Response.json({ error: 'Invitación no encontrada' }, { status: 404 })
    }
    if (err === 'used') {
      return Response.json({ error: 'Invitación ya utilizada' }, { status: 410 })
    }
    if (err === 'expired') {
      return Response.json({ error: 'Invitación vencida' }, { status: 410 })
    }

    const inv = invitation!

    // 3. Verificar que el email del usuario autenticado coincide con el de la invitación
    if (user.email?.toLowerCase() !== inv.email?.toLowerCase()) {
      return Response.json(
        { error: 'Este link no corresponde a tu cuenta' },
        { status: 403 },
      )
    }

    // 4. UPDATE shared_case_members — vincular user y activar
    const { error: memberErr } = await supabase
      .from('shared_case_members')
      .update({
        user_id:   user.id,
        status:    'active',
        joined_at: new Date().toISOString(),
      })
      .eq('id', inv.member_id)

    if (memberErr) {
      return Response.json(
        { error: memberErr.message ?? 'Error al activar membresía' },
        { status: 500 },
      )
    }

    // 5. UPDATE shared_case_invitations — marcar como usada
    const { error: invErr } = await supabase
      .from('shared_case_invitations')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token)

    if (invErr) {
      return Response.json(
        { error: invErr.message ?? 'Error al marcar invitación como usada' },
        { status: 500 },
      )
    }

    // 6. INSERT en shared_case_history
    const { error: histErr } = await supabase
      .from('shared_case_history')
      .insert({
        shared_case_id: inv.shared_case_id,
        title:          'Nuevo miembro se sumó',
        description:    user.email,
        event_type:     'contacto_sumado',
        created_by:     user.id,
      })

    if (histErr) {
      return Response.json(
        { error: histErr.message ?? 'Error al registrar historial' },
        { status: 500 },
      )
    }

    // 7. Respuesta exitosa
    return Response.json({ success: true, shared_case_id: inv.shared_case_id })

  } catch (err: any) {
    return Response.json(
      { error: err.message ?? 'Error interno' },
      { status: 500 },
    )
  }
}
