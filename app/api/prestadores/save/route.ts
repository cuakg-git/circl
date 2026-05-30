import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token ?? '')
  if (authErr || !user) {
    return Response.json({ error: 'No autenticado' }, { status: 401 })
  }

  const body = await request.json()
  const { provider_catalog_id } = body

  const { data: existing } = await supabaseAdmin
    .from('user_provider_catalog')
    .select('id')
    .eq('user_id', user.id)
    .eq('provider_catalog_id', provider_catalog_id)
    .maybeSingle()

  if (existing) {
    await supabaseAdmin
      .from('user_provider_catalog')
      .delete()
      .eq('id', existing.id)

    // Buscar y eliminar el contacto correspondiente
    const { data: provider } = await supabaseAdmin
      .from('provider_catalog')
      .select('name')
      .eq('id', provider_catalog_id)
      .maybeSingle()

    if (provider) {
      await supabaseAdmin
        .from('contacts')
        .delete()
        .eq('user_id', user.id)
        .eq('name', provider.name)
        .eq('role', 'prestador_servicios')
    }

    return Response.json({ saved: false })
  } else {
    await supabaseAdmin
      .from('user_provider_catalog')
      .insert({ user_id: user.id, provider_catalog_id })

    const { data: provider } = await supabaseAdmin
      .from('provider_catalog')
      .select('name, specialty, category, phone, email')
      .eq('id', provider_catalog_id)
      .maybeSingle()

    if (provider) {
      await supabaseAdmin
        .from('contacts')
        .insert({
          user_id:             user.id,
          name:                provider.name,
          relationship:        provider.specialty ?? provider.category ?? 'Prestador',
          role:                'prestador_servicios',
          proximity:           'profesional',
          phone:               provider.phone  ?? null,
          email:               provider.email  ?? null,
          notes:               `Prestador agregado desde el catálogo de Mhiru${provider.category ? '. Categoría: ' + provider.category : ''}.`,
          provider_catalog_id: provider_catalog_id,
        })
    }

    return Response.json({ saved: true })
  }
}
