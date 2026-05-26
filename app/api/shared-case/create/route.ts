import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // 1. Autenticar usuario via Authorization header
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token ?? '')

    if (authErr || !user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }

    // 2. Leer body
    const { name, description } = await req.json()

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return Response.json({ error: 'name es requerido' }, { status: 400 })
    }

    // 3. INSERT en shared_cases
    const { data: sharedCase, error: caseErr } = await supabase
      .from('shared_cases')
      .insert({
        name:        name.trim(),
        description: description ?? null,
        created_by:  user.id,
      })
      .select('id')
      .single()

    if (caseErr || !sharedCase) {
      return Response.json(
        { error: caseErr?.message ?? 'Error al crear el tema compartido' },
        { status: 500 }
      )
    }

    // 4. INSERT en shared_case_members — creador como primer miembro activo
    const { error: memberErr } = await supabase
      .from('shared_case_members')
      .insert({
        shared_case_id: sharedCase.id,
        user_id:        user.id,
        email:          user.email,
        status:         'active',
        invited_by:     user.id,
        joined_at:      new Date().toISOString(),
      })

    if (memberErr) {
      return Response.json(
        { error: memberErr.message ?? 'Error al agregar miembro' },
        { status: 500 }
      )
    }

    // 5. Respuesta exitosa
    return Response.json({ shared_case_id: sharedCase.id }, { status: 201 })

  } catch (err: any) {
    return Response.json(
      { error: err.message ?? 'Error interno' },
      { status: 500 }
    )
  }
}
