import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

// Preguntas iniciales rotativas para arrancar el chat
const INITIAL_QUESTIONS = [
  '¿Cómo estuvo tu semana hasta ahora?',
  '¿Qué estás haciendo cuando te sentís bien?',
  '¿Hay algo que te esté ocupando la cabeza estos días?',
]

const INITIAL_SUGGESTIONS: Record<string, string[]> = {
  '¿Cómo estuvo tu semana hasta ahora?': [
    'Algo intenso pasó',
    'De todo un poco',
    'Bastante tranquila',
  ],
  '¿Qué estás haciendo cuando te sentís bien?': [
    'Pasando tiempo con gente que quiero',
    'Haciendo algo que me desafía',
    'Simplemente descansando',
  ],
  '¿Hay algo que te esté ocupando la cabeza estos días?': [
    'Un proyecto que avanza',
    'Una situación complicada',
    'Nada importante en este momento',
  ],
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') ?? ''
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Leer identity actual para elegir pregunta relevante
    const { data: ctx } = await supabase
      .from('user_context')
      .select('identity')
      .eq('user_id', user.id)
      .maybeSingle()

    // Si no tiene identity, arrancar con la primera pregunta
    // Si ya tiene, rotar para no repetir siempre la misma
    const hasIdentity = !!ctx?.identity
    const idx = hasIdentity
      ? Math.floor(Math.random() * INITIAL_QUESTIONS.length)
      : 0

    const question    = INITIAL_QUESTIONS[idx]
    const suggestions = INITIAL_SUGGESTIONS[question] ?? []

    return Response.json({
      question,
      suggestions,
      current_identity: ctx?.identity ?? null,
    })

  } catch (err: any) {
    return Response.json(
      { error: err?.message ?? 'Error interno' },
      { status: 500 }
    )
  }
}
