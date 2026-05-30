import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false } }
)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category        = searchParams.get('category')
  const zone            = searchParams.get('zone')
  const healthInsurance = searchParams.get('health_insurance')
  const search          = searchParams.get('search')
  const cursor          = searchParams.get('cursor')
  const limit           = parseInt(searchParams.get('limit') ?? '12')

  let query = supabaseAdmin
    .from('provider_catalog')
    .select('id, name, specialty, category, description, phone, email, website, avatar_url, zones, health_insurances, featured, sort_order')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .limit(limit + 1)

  if (category)        query = query.eq('category', category)
  if (zone)            query = query.contains('zones', [zone])
  if (healthInsurance) query = query.contains('health_insurances', [healthInsurance])
  if (search)          query = query.or(`name.ilike.%${search}%,specialty.ilike.%${search}%,description.ilike.%${search}%`)
  if (cursor)          query = query.gt('sort_order', parseInt(cursor))

  const { data, error } = await query

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const hasMore    = (data ?? []).length > limit
  const items      = hasMore ? data!.slice(0, limit) : (data ?? [])
  const nextCursor = hasMore ? items[items.length - 1].sort_order : null

  return Response.json({ items, hasMore, nextCursor })
}
