import { NextRequest } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

function buildHtml(
  subject:   string,
  body:      string,
  ownerName: string,
  taskTitle: string,
): string {
  const paragraphs = body
    .split('\n')
    .filter(line => line.trim())
    .map(line => `<p style="margin:0 0 14px;font-size:15px;color:#3a3a3a;line-height:1.7;font-style:italic;">${line}</p>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0"
          style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(10,126,140,0.08);">

          <!-- Header -->
          <tr>
            <td align="center" style="padding:32px 40px 24px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:10px;">
                    <img
                      src="https://mhiru-staging.vercel.app/LOGO_CIRCL_2.svg"
                      alt="Mhiru logo"
                      width="32"
                      height="32"
                      style="display:block;"
                    />
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="font-size:22px;font-weight:800;letter-spacing:-0.03em;color:#0A7E8C;">
                      Mhiru
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background:rgba(10,126,140,0.10);"></div>
            </td>
          </tr>

          <!-- Intro -->
          <tr>
            <td style="padding:28px 40px 8px;">
              <p style="margin:0 0 20px;font-size:15px;color:#1A1A2E;line-height:1.6;">
                <strong>${ownerName}</strong> está asignándote la tarea
                <strong>${taskTitle}</strong>. Este es su mensaje:
              </p>
            </td>
          </tr>

          <!-- Body itálica -->
          <tr>
            <td style="padding:0 40px 8px;">
              <div style="
                background:#f7fafa;
                border-left:3px solid #0A7E8C;
                border-radius:0 8px 8px 0;
                padding:16px 20px;
              ">
                ${paragraphs}
              </div>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td align="center" style="padding:28px 40px 32px;">
              <a href="https://hellomhiru.com"
                style="
                  display:inline-block;
                  background:linear-gradient(135deg,#0A7E8C,#2ECDA7);
                  color:#ffffff;
                  font-size:14px;
                  font-weight:700;
                  text-decoration:none;
                  padding:12px 32px;
                  border-radius:9999px;
                  letter-spacing:0.02em;
                ">
                Ir a Mhiru
              </a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  try {
    const {
      contact_id,
      contact_email,
      owner_name,
      task_title,
      task_description,
      due_date,
      custom_body,
      custom_subject,
    } = await req.json()

    if (!contact_id || !owner_name || !task_title) {
      return Response.json(
        { error: 'contact_id, owner_name y task_title son requeridos' },
        { status: 400 }
      )
    }

    // 1. Resolver email del contacto
    let toEmail = contact_email ?? null
    if (!toEmail) {
      const { data: contactData } = await supabase
        .from('contacts')
        .select('email')
        .eq('id', contact_id)
        .maybeSingle()
      toEmail = contactData?.email ?? null
    }

    if (!toEmail) {
      return Response.json({ error: 'Email requerido' }, { status: 400 })
    }

    // 2. Si se proveyó un email nuevo, guardarlo
    if (contact_email) {
      await supabase
        .from('contacts')
        .update({ email: contact_email })
        .eq('id', contact_id)
    }

    // 3. Obtener subject y body — usar custom si viene, sino llamar a notification-draft
    let subject: string
    let body: string

    if (custom_body && custom_subject) {
      subject = custom_subject
      body    = custom_body
    } else {
      const baseUrl = req.nextUrl.origin
      const draftRes = await fetch(`${baseUrl}/api/notification-draft`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          contact_id,
          notification_type: 'task_assigned',
          owner_name,
          payload: {
            task_title,
            task_description: task_description ?? null,
            due_date:         due_date ?? null,
          },
        }),
      })

      const draft = await draftRes.json()

      if (!draftRes.ok || draft.error) {
        return Response.json(
          { error: draft.error ?? 'No se pudo generar el texto del mail' },
          { status: 500 }
        )
      }

      subject = draft.subject
      body    = draft.body
    }

    // 4. Construir HTML y enviar
    const html = buildHtml(subject, body, owner_name, task_title ?? '')

    const { error: sendErr } = await resend.emails.send({
      from:    'Mhiru <no-reply@hellomhiru.com>',
      to:      toEmail,
      subject,
      html,
    })

    if (sendErr) {
      return Response.json({ error: sendErr.message }, { status: 500 })
    }

    return Response.json({ ok: true })

  } catch (err: any) {
    return Response.json(
      { error: err.message ?? 'Error interno' },
      { status: 500 }
    )
  }
}
