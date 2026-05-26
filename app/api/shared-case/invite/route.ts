import { NextRequest } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

function buildInviteHtml(
  inviterName:   string,
  caseName:      string,
  inviteUrl:     string,
  recipientName: string | null,
): string {
  const greeting = recipientName ? `Hola, ${recipientName}` : 'Hola'
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Invitación a ${caseName}</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;
  font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"
    style="background:#f0f4f8;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0"
        style="background:#ffffff;border-radius:16px;overflow:hidden;
               box-shadow:0 4px 24px rgba(10,126,140,0.08);">

        <!-- Header -->
        <tr>
          <td align="center" style="padding:32px 40px 24px;">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="vertical-align:middle;padding-right:10px;">
                <img src="https://mhiru-staging.vercel.app/LOGO_CIRCL_2.svg"
                  alt="Mhiru" width="32" height="32" style="display:block;"/>
              </td>
              <td style="vertical-align:middle;">
                <span style="font-size:22px;font-weight:800;
                  letter-spacing:-0.03em;color:#0A7E8C;">Mhiru</span>
              </td>
            </tr></table>
          </td>
        </tr>

        <!-- Divider -->
        <tr><td style="padding:0 40px;">
          <div style="height:1px;background:rgba(10,126,140,0.10);"></div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:28px 40px 8px;">
          <p style="margin:0 0 16px;font-size:16px;font-weight:800;
            color:#1A1A2E;letter-spacing:-0.01em;">
            ${greeting}
          </p>
          <p style="margin:0 0 16px;font-size:15px;color:#5a7478;line-height:1.6;">
            <strong style="color:#1A1A2E;">${inviterName}</strong>
            te invitó a participar del tema
            <strong style="color:#1A1A2E;">${caseName}</strong>
            en Mhiru.
          </p>
          <p style="margin:0 0 28px;font-size:15px;color:#5a7478;line-height:1.6;">
            Hacé clic en el botón para sumarte.
          </p>
        </td></tr>

        <!-- CTA -->
        <tr><td align="center" style="padding:8px 40px 36px;">
          <a href="${inviteUrl}"
            style="display:inline-block;
              background:linear-gradient(135deg,#0A7E8C,#2ECDA7);
              color:#ffffff;font-size:15px;font-weight:700;
              text-decoration:none;padding:14px 36px;
              border-radius:9999px;letter-spacing:0.01em;">
            Aceptar invitación
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:0 40px 32px;">
          <div style="height:1px;background:rgba(10,126,140,0.10);
            margin-bottom:20px;"></div>
          <p style="margin:0;font-size:12px;color:#5a7478;line-height:1.6;
            text-align:center;">
            Si no esperabas esta invitación, podés ignorar este correo.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  try {
    // 1. Autenticar usuario via Authorization header
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token ?? '')

    if (authErr || !user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }

    // 2. Leer body
    const { shared_case_id, email, recipient_name } = await req.json()

    if (!shared_case_id || !email) {
      return Response.json(
        { error: 'shared_case_id y email son requeridos' },
        { status: 400 }
      )
    }

    // 3. Verificar que el usuario es miembro activo del shared_case_id
    const { data: membership } = await supabase
      .from('shared_case_members')
      .select('id')
      .eq('shared_case_id', shared_case_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (!membership) {
      return Response.json(
        { error: 'No tenés acceso a este tema compartido' },
        { status: 403 }
      )
    }

    // 4. Verificar que el email no está ya invitado/activo en este tema
    const { data: existing } = await supabase
      .from('shared_case_members')
      .select('id')
      .eq('shared_case_id', shared_case_id)
      .eq('email', email)
      .maybeSingle()

    if (existing) {
      return Response.json(
        { error: 'Este email ya fue invitado' },
        { status: 409 }
      )
    }

    // 5. Leer el nombre del tema compartido
    const { data: sharedCase, error: caseErr } = await supabase
      .from('shared_cases')
      .select('name')
      .eq('id', shared_case_id)
      .maybeSingle()

    if (caseErr || !sharedCase) {
      return Response.json(
        { error: 'Tema compartido no encontrado' },
        { status: 404 }
      )
    }

    // 6. Leer el nombre del usuario que invita
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()

    const inviterName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Alguien'

    // 7. INSERT en shared_case_members (status: pending)
    const { data: newMember, error: memberErr } = await supabase
      .from('shared_case_members')
      .insert({
        shared_case_id,
        user_id:    null,
        email,
        status:     'pending',
        invited_by: user.id,
      })
      .select('id')
      .single()

    if (memberErr || !newMember) {
      return Response.json(
        { error: memberErr?.message ?? 'Error al crear la invitación' },
        { status: 500 }
      )
    }

    const member_id = newMember.id

    // 8. INSERT en shared_case_invitations — token y expires_at generados por DB
    const { data: invitation, error: invErr } = await supabase
      .from('shared_case_invitations')
      .insert({
        shared_case_id,
        member_id,
        email,
      })
      .select('id, token')
      .single()

    if (invErr || !invitation) {
      return Response.json(
        { error: invErr?.message ?? 'Error al generar el token de invitación' },
        { status: 500 }
      )
    }

    const inviteToken = invitation.token

    // 9. Construir URL de invitación
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
    const inviteUrl = `${appUrl}/invitacion/${inviteToken}`

    // 10. Enviar mail con Resend
    const html = buildInviteHtml(
      inviterName,
      sharedCase.name,
      inviteUrl,
      recipient_name ?? null,
    )

    const { error: sendErr } = await resend.emails.send({
      from:    'Mhiru <no-reply@hellomhiru.com>',
      to:      email,
      subject: `${inviterName} te invitó a "${sharedCase.name}" en Mhiru`,
      html,
    })

    if (sendErr) {
      return Response.json({ error: sendErr.message }, { status: 500 })
    }

    // 11. Respuesta exitosa
    return Response.json({ success: true, member_id, token: inviteToken })

  } catch (err: any) {
    return Response.json(
      { error: err.message ?? 'Error interno' },
      { status: 500 }
    )
  }
}
