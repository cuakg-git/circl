import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const MODEL_NAME = 'claude-sonnet-4-6'
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
)

const SYSTEM_PROMPT = `Sos un asistente especializado en sugerir prestadores de servicios
para personas que atraviesan una crisis de salud o emocional.

Tu tarea es analizar el contexto de la crisis de una persona, su red de apoyo actual
y los prestadores que ya tiene, para sugerir 3 nuevos prestadores que podrían
aliviar su situación.

Un "prestador" puede ser cualquier tipo de servicio, profesional, institución o
recurso: médicos, psicólogos, obras sociales, niñeras, servicios de limpieza,
cuidadores, grupos de apoyo, abogados, nutricionistas, etc. Pensá amplio.

Tu output es SIEMPRE un JSON con esta forma exacta, sin texto antes ni después,
sin markdown, sin code fences:

{
  "suggestions": [
    {
      "name": "Nombre del tipo de prestador o servicio",
      "prestacion": "Descripción breve del servicio (máximo 6 palabras)",
      "razon": "Por qué lo sugerís en 1-2 oraciones, mencionando el contexto específico del usuario"
    }
  ]
}

Reglas:
- Exactamente 3 sugerencias, ni más ni menos
- No sugerir prestadores que ya existan en la lista actual del usuario
- Las sugerencias deben ser concretas y accionables
- La razón debe ser personalizada al contexto, no genérica
- Hablás en español rioplatense, segunda persona
- El campo "name" es el tipo de prestador (ej: "Psicólogo oncológico", "Servicio de cuidado domiciliario"), no un nombre propio
- El campo "prestacion" es ultra corto (ej: "Apoyo emocional oncología", "Cuidado en el hogar")
- Hablás en español rioplatense: usás "vos", "podés", "tenés",
  "acá", "también" (sin tilde). Tono cálido y directo, nunca
  formal ni distante.`

export async function POST(request: Request) {
  const body = await request.json()
  const { user_id } = body || {}

  if (!user_id) {
    return Response.json({ error: 'Missing user_id' }, { status: 400 })
  }

  try {
    // 1. Cargar crisis activa
    const { data: crisis } = await supabase
      .from('crises')
      .select('id, name, description, category, ai_summary, ai_next_step')
      .eq('user_id', user_id)
      .eq('status', 'activa')
      .maybeSingle()

    if (!crisis) {
      return Response.json({ suggestions: [] })
    }

    // 2. Cargar contactos del círculo con su context_summary
    const { data: crisisContacts } = await supabase
      .from('crisis_contacts')
      .select('contact:contacts(name, relationship, role, proximity, context_summary)')
      .eq('crisis_id', crisis.id)

    // 3. Cargar providers actuales del usuario
    const { data: providers } = await supabase
      .from('providers')
      .select('name, prestacion')
      .eq('user_id', user_id)

    // 4. Construir el mensaje para Claude
    const contactsList = (crisisContacts ?? [])
      .map((cc: any) => {
        const c = cc.contact
        return `- ${c.name} (${c.relationship}, ${c.role}): ${c.context_summary ?? 'sin contexto'}`
      })
      .join('\n')

    const providersList = (providers ?? [])
      .map((p: any) => `- ${p.name}${p.prestacion ? ` (${p.prestacion})` : ''}`)
      .join('\n')

    const userMessage = `<contexto_usuario>
  <crisis>
    <nombre>${crisis.name}</nombre>
    <categoria>${crisis.category}</categoria>
    <resumen>${crisis.ai_summary ?? ''}</resumen>
    <proximo_paso>${crisis.ai_next_step ?? ''}</proximo_paso>
  </crisis>

  <circulo_de_apoyo>
${contactsList || '    (sin contactos en el círculo)'}
  </circulo_de_apoyo>

  <prestadores_actuales>
${providersList || '    (sin prestadores registrados)'}
  </prestadores_actuales>
</contexto_usuario>

Analizá el contexto y sugerí 3 prestadores que podrían aliviar la situación.
No repitas prestadores que ya están en la lista actual.
Devolvé solo el JSON.`

    // 5. Llamar a Claude
    const response = await anthropic.messages.create({
      model: MODEL_NAME,
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const textBlock = response.content?.find((b: any) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text' || !textBlock.text) {
      throw new Error('Claude no devolvió texto')
    }

    // 6. Parsear JSON
    let parsed: { suggestions?: Array<{ name: string; prestacion: string; razon: string }> }
    try {
      const cleaned = textBlock.text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('[suggest-providers] error parseando JSON:', textBlock.text)
      return Response.json({ error: 'Respuesta inválida del agente' }, { status: 500 })
    }

    return Response.json({
      suggestions: parsed.suggestions ?? [],
    })

  } catch (error) {
    console.error('[suggest-providers] error:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
