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

const CIRCLE_INITIAL_QUESTIONS = [
  '¿Hay alguien que esté apareciendo más en tu día a día últimamente?',
  '¿Hay alguien de tu círculo que esté pasando por algo especial?',
  '¿Hay alguien con quien estés sintiendo más distancia que antes?',
]

const THEMES_INITIAL_QUESTIONS = [
  '¿Hay algún tema que te esté ocupando más la cabeza últimamente?',
  '¿Hay algo nuevo apareciendo en tu vida que todavía no anotaste?',
  '¿Hay algún tema que cambió de intensidad en los últimos días?',
]

const THEMES_INITIAL_SUGGESTIONS: Record<string, string[]> = {
  '¿Hay algún tema que te esté ocupando más la cabeza últimamente?': [
    'Sí, una situación reciente',
    'Algo que viene de hace tiempo',
    'Nada en particular',
  ],
  '¿Hay algo nuevo apareciendo en tu vida que todavía no anotaste?': [
    'Sí, todavía no lo armé',
    'Algo está cambiando',
    'No, está todo registrado',
  ],
  '¿Hay algún tema que cambió de intensidad en los últimos días?': [
    'Sí, se complicó',
    'Sí, mejoró',
    'Está estable',
  ],
}

const CIRCLE_INITIAL_SUGGESTIONS: Record<string, string[]> = {
  '¿Hay alguien que esté apareciendo más en tu día a día últimamente?': [
    'Sí, alguien cercano',
    'Más bien gente del trabajo',
    'Nadie en particular',
  ],
  '¿Hay alguien de tu círculo que esté pasando por algo especial?': [
    'Sí, una situación delicada',
    'Sí, algo lindo',
    'Nada que destacar',
  ],
  '¿Hay alguien con quien estés sintiendo más distancia que antes?': [
    'Sí, me preocupa',
    'Algo, pero es natural',
    'No, todo bien',
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

    const { searchParams } = new URL(request.url)
    const dimension = searchParams.get('dimension') ?? 'identity'

    // Rama themes_summary
    if (dimension === 'themes_summary') {
      const { data: ctx } = await supabase
        .from('user_context')
        .select('themes_summary')
        .eq('user_id', user.id)
        .maybeSingle()

      const hasSummary = !!ctx?.themes_summary
      const idx = hasSummary
        ? Math.floor(Math.random() * THEMES_INITIAL_QUESTIONS.length)
        : 0

      const question    = THEMES_INITIAL_QUESTIONS[idx]
      const suggestions = THEMES_INITIAL_SUGGESTIONS[question] ?? []

      return Response.json({
        question,
        suggestions,
        current_summary: ctx?.themes_summary ?? null,
      })
    }

    // Rama circle_summary
    if (dimension === 'circle_summary') {
      const { data: ctx } = await supabase
        .from('user_context')
        .select('circle_summary')
        .eq('user_id', user.id)
        .maybeSingle()

      const hasSummary = !!ctx?.circle_summary
      const idx = hasSummary
        ? Math.floor(Math.random() * CIRCLE_INITIAL_QUESTIONS.length)
        : 0

      const question    = CIRCLE_INITIAL_QUESTIONS[idx]
      const suggestions = CIRCLE_INITIAL_SUGGESTIONS[question] ?? []

      return Response.json({
        question,
        suggestions,
        current_summary: ctx?.circle_summary ?? null,
      })
    }

    // Rama identity (comportamiento ORIGINAL — NO TOCAR LÓGICA)
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

  } catch (err: unknown) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    )
  }
}
