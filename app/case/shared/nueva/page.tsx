'use client'

import { Fragment, useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ── Constants ──────────────────────────────────────────────────────────────────

const AV_GRADIENTS = [
  'linear-gradient(135deg, #3DC7A6, #0A7E8C)',
  'linear-gradient(135deg, #0A7E8C, #065e6a)',
  'linear-gradient(135deg, #9b7fe8, #6c4fc7)',
  'linear-gradient(135deg, #f4ab66, #E07931)',
]
const INIT_POOL = ['LA', 'CR', 'MR', 'JP', 'PG', 'RM']

// ── Types ──────────────────────────────────────────────────────────────────────

type Invitee = { id: number; email: string }
type Contact = { id: number; name: string; proximity: string }

// ── Inner wizard (uses useSearchParams) ───────────────────────────────────────

function NuevaTemaWizard() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const tipo         = (searchParams.get('tipo') ?? 'compartido') as 'propio' | 'compartido'

  // ── Auth ──────────────────────────────────────────────────────────────────
  const [userId,    setUserId]    = useState('')
  const [userEmail, setUserEmail] = useState('')

  // ── Step ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // ── Form ──────────────────────────────────────────────────────────────────
  const [nombre,      setNombre]      = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  // ── Invitees — compartido step 2 ──────────────────────────────────────────
  const [invitees,    setInvitees]    = useState<Invitee[]>([{ id: 1, email: '' }])
  const nextInviteeId                 = useRef(2)

  // ── Contacts — propio step 2 ──────────────────────────────────────────────
  const [contacts, setContacts] = useState<Contact[]>([{ id: 1, name: '', proximity: '' }])
  const nextContactId           = useRef(2)

  // ── Created IDs ───────────────────────────────────────────────────────────
  const [caseId,       setCaseId]       = useState<string | null>(null)
  const [sharedCaseId, setSharedCaseId] = useState<string | null>(null)
  const caseCreatedRef                  = useRef(false)

  // ── Context generation ────────────────────────────────────────────────────
  const [generatedSummary, setGeneratedSummary] = useState('')
  const [isGenerating,     setIsGenerating]     = useState(false)
  const [summaryEdited,    setSummaryEdited]     = useState(false)

  // ── Init: fetch user ──────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data?.user?.id ?? '')
      setUserEmail(data?.user?.email ?? '')
    })
  }, [])

  // ── Step 3: create case + generate context ────────────────────────────────
  useEffect(() => {
    if (step !== 3 || !userId || caseCreatedRef.current) return
    caseCreatedRef.current = true

    async function initStep3() {
      setLoading(true)
      setError(null)

      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token ?? ''

      if (tipo === 'propio') {
        // INSERT en cases
        const { data: newCase, error: caseErr } = await supabase
          .from('cases')
          .insert({
            user_id:     userId,
            name:        nombre,
            description: descripcion || null,
            status:      'activa',
          })
          .select('id')
          .single()

        if (caseErr || !newCase) {
          setError(caseErr?.message ?? 'Error al crear el tema')
          setLoading(false)
          return
        }

        setCaseId(newCase.id)
        setLoading(false)

        // Generar contexto
        setIsGenerating(true)
        const res = await fetch('/api/case/generate-context', {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ case_id: newCase.id }),
        })
        const data = await res.json()
        setIsGenerating(false)
        if (data.summary) setGeneratedSummary(data.summary)

      } else {
        // POST /api/shared-case/create
        const res = await fetch('/api/shared-case/create', {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ name: nombre, description: descripcion || undefined }),
        })
        const data = await res.json()

        if (!res.ok) {
          setError(data.error ?? 'Error al crear el tema compartido')
          setLoading(false)
          return
        }

        const newSharedCaseId = data.shared_case_id as string
        setSharedCaseId(newSharedCaseId)

        // Enviar invitaciones fire & forget
        const filledInvitees = invitees.filter(i => i.email.trim())
        filledInvitees.forEach(invitee => {
          fetch('/api/shared-case/invite', {
            method:  'POST',
            headers: {
              'Content-Type':  'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              shared_case_id: newSharedCaseId,
              email:          invitee.email.trim(),
            }),
          })
        })

        setLoading(false)

        // Buscar member_id del usuario actual
        const { data: memberData } = await supabase
          .from('shared_case_members')
          .select('id')
          .eq('shared_case_id', newSharedCaseId)
          .eq('user_id', userId)
          .eq('status', 'active')
          .single()

        if (memberData) {
          // Generar contexto
          setIsGenerating(true)
          const ctxRes = await fetch('/api/case/generate-context', {
            method:  'POST',
            headers: {
              'Content-Type':  'application/json',
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              shared_case_id: newSharedCaseId,
              member_id:      memberData.id,
            }),
          })
          const ctxData = await ctxRes.json()
          setIsGenerating(false)
          if (ctxData.summary) setGeneratedSummary(ctxData.summary)
        }
      }
    }

    initStep3()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, userId])

  // ── Invitee helpers ───────────────────────────────────────────────────────
  function addInvitee() {
    const id = nextInviteeId.current++
    setInvitees(prev => [...prev, { id, email: '' }])
  }
  function removeInvitee(id: number) {
    setInvitees(prev => prev.filter(i => i.id !== id))
  }
  function updateInvitee(id: number, field: 'email', value: string) {
    setInvitees(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  // ── Contact helpers ───────────────────────────────────────────────────────
  function addContact() {
    const id = nextContactId.current++
    setContacts(prev => [...prev, { id, name: '', proximity: '' }])
  }
  function removeContact(id: number) {
    setContacts(prev => prev.filter(c => c.id !== id))
  }
  function updateContact(id: number, field: 'name' | 'proximity', value: string) {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  function goToCase() {
    if (tipo === 'propio' && caseId) {
      router.push('/case/' + caseId)
    } else if (tipo === 'compartido' && sharedCaseId) {
      router.push('/case/shared/' + sharedCaseId)
    } else {
      router.push('/case')
    }
  }

  // ── Stepper state ─────────────────────────────────────────────────────────
  function stepState(pos: number): 'active' | 'done' | 'idle' {
    if (pos < step) return 'done'
    if (pos === step) return 'active'
    return 'idle'
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes heroGradientDrift {
          0%, 100% {
            background:
              radial-gradient(ellipse at 15% 15%, rgba(61,199,166,0.06) 0%, transparent 55%),
              radial-gradient(ellipse at 85% 10%, rgba(80,220,175,0.14) 0%, transparent 50%),
              radial-gradient(ellipse at 88% 82%, rgba(224,121,49,0.16) 0%, transparent 52%),
              radial-gradient(ellipse at 12% 88%, rgba(158,160,81,0.16) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.30) 0%, transparent 65%),
              #f0f4f8;
          }
          25% {
            background:
              radial-gradient(ellipse at 22% 10%, rgba(61,199,166,0.06) 0%, transparent 55%),
              radial-gradient(ellipse at 90% 20%, rgba(80,220,175,0.14) 0%, transparent 50%),
              radial-gradient(ellipse at 80% 88%, rgba(224,121,49,0.16) 0%, transparent 52%),
              radial-gradient(ellipse at  6% 78%, rgba(158,160,81,0.16) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.30) 0%, transparent 65%),
              #f0f4f8;
          }
          50% {
            background:
              radial-gradient(ellipse at 10% 22%, rgba(61,199,166,0.06) 0%, transparent 55%),
              radial-gradient(ellipse at 78%  8%, rgba(80,220,175,0.14) 0%, transparent 50%),
              radial-gradient(ellipse at 92% 75%, rgba(224,121,49,0.16) 0%, transparent 52%),
              radial-gradient(ellipse at 18% 92%, rgba(158,160,81,0.16) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.30) 0%, transparent 65%),
              #f0f4f8;
          }
          75% {
            background:
              radial-gradient(ellipse at 20% 22%, rgba(61,199,166,0.06) 0%, transparent 55%),
              radial-gradient(ellipse at 82% 18%, rgba(80,220,175,0.14) 0%, transparent 50%),
              radial-gradient(ellipse at 85% 90%, rgba(224,121,49,0.16) 0%, transparent 52%),
              radial-gradient(ellipse at 14% 82%, rgba(158,160,81,0.16) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.30) 0%, transparent 65%),
              #f0f4f8;
          }
        }
        .nc-page { animation: heroGradientDrift 30s ease-in-out infinite; }

        @keyframes fadeStep {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0);    }
        }

        .nc-step-panel { animation: fadeStep 0.35s ease forwards; }
      `}</style>

      <div
        className="nc-page min-h-screen flex flex-col items-center justify-center px-4 py-12"
        style={{
          background:
            'radial-gradient(ellipse at 15% 15%, rgba(61,199,166,0.06) 0%, transparent 55%),' +
            'radial-gradient(ellipse at 85% 10%, rgba(80,220,175,0.14) 0%, transparent 50%),' +
            'radial-gradient(ellipse at 88% 82%, rgba(224,121,49,0.16) 0%, transparent 52%),' +
            'radial-gradient(ellipse at 12% 88%, rgba(158,160,81,0.16) 0%, transparent 50%),' +
            'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.30) 0%, transparent 65%),' +
            '#f0f4f8',
        }}
      >
        <div
          className="relative z-10 bg-white rounded-3xl w-full px-8 py-8"
          style={{ maxWidth: 720, boxShadow: '0 4px 24px rgba(10,126,140,0.08)' }}
        >

          {/* ── Stepper ───────────────────────────────────────────────────── */}
          <div className="flex items-center mb-7">
            {(
              [
                { label: 'Tema',     pos: 1 },
                { label: 'Personas', pos: 2 },
                { label: 'Contexto', pos: 3 },
              ] as const
            ).map(({ label, pos }, i) => {
              const st       = stepState(pos)
              const isActive = st === 'active'
              const isDone   = st === 'done'
              return (
                <Fragment key={label}>
                  <div
                    className="flex flex-col items-center gap-[5px]"
                    style={{ opacity: isActive || isDone ? 1 : 0.25, transition: 'opacity 0.2s' }}
                  >
                    <div
                      style={{
                        width: 26, height: 26, borderRadius: '50%',
                        border: `1.5px solid ${isActive || isDone ? '#0A7E8C' : 'rgba(10,126,140,0.12)'}`,
                        background: isActive ? '#0A7E8C' : isDone ? 'rgba(10,126,140,0.10)' : 'white',
                        color: isActive ? 'white' : isDone ? '#0A7E8C' : '#5a7478',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700,
                        transition: 'all 0.2s',
                      }}
                    >
                      {isDone ? '✓' : pos}
                    </div>
                    <span
                      style={{
                        fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
                        textTransform: 'uppercase', whiteSpace: 'nowrap',
                        color: isActive || isDone ? '#0A7E8C' : '#5a7478',
                      }}
                    >
                      {label}
                    </span>
                  </div>
                  {i < 2 && (
                    <div
                      style={{
                        flex: 1, height: 1.5, minWidth: 32, marginBottom: 17,
                        background: isDone ? '#0A7E8C' : 'rgba(10,126,140,0.12)',
                        transition: 'background 0.2s',
                      }}
                    />
                  )}
                </Fragment>
              )
            })}
          </div>

          {/* ══ STEP 1 — Nombre del tema ════════════════════════════════════ */}
          {step === 1 && (
            <div className="nc-step-panel">
              <p className="text-2xl font-extrabold text-[#1A1A2E] mb-2 tracking-tight">
                {tipo === 'compartido'
                  ? '¿En qué puedo ayudar?'
                  : '¿En qué puedo ayudar?'}
              </p>
              <p className="text-[#5a7478] mb-6 leading-relaxed" style={{ fontSize: '0.95rem' }}>
                Todo lo que me cuentes me va a ayudar a entender mejor la situación.
              </p>

              <div className="flex flex-col gap-3 mb-2">
                <input
                  type="text"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && nombre.trim()) setStep(2) }}
                  placeholder="Nombre del tema"
                  autoFocus
                  className="w-full rounded-2xl px-4 py-3 text-[#1A1A2E] text-sm outline-none transition-all"
                  style={{ background: '#FAF8F5', border: '1.5px solid rgba(10,126,140,0.12)', fontFamily: 'inherit' }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#0A7E8C'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(10,126,140,0.09)' }}
                  onBlur={e  => { e.currentTarget.style.borderColor = 'rgba(10,126,140,0.12)'; e.currentTarget.style.boxShadow = 'none' }}
                />
                <textarea
                  rows={3}
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  placeholder={
                    tipo === 'compartido'
                      ? 'Descripción del tema compartido (opcional)…'
                      : 'Descripción de la situación (opcional)…'
                  }
                  className="w-full rounded-2xl px-4 py-3 text-[#1A1A2E] text-sm outline-none resize-none transition-all"
                  style={{ background: '#FAF8F5', border: '1.5px solid rgba(10,126,140,0.12)', fontFamily: 'inherit' }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#0A7E8C'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(10,126,140,0.09)' }}
                  onBlur={e  => { e.currentTarget.style.borderColor = 'rgba(10,126,140,0.12)'; e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>

              <div className="flex items-center justify-between gap-3 mt-7">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="inline-flex items-center gap-1.5 rounded-full px-[22px] py-3 font-bold text-[#5a7478] cursor-pointer transition-colors"
                  style={{ border: '1.5px solid rgba(10,126,140,0.12)', background: 'none', fontFamily: 'inherit', fontSize: 'inherit' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#0A7E8C'; e.currentTarget.style.color = '#0A7E8C' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(10,126,140,0.12)'; e.currentTarget.style.color = '#5a7478' }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => { if (nombre.trim()) setStep(2) }}
                  disabled={!nombre.trim()}
                  className="bg-[#0A7E8C] text-white font-bold rounded-full py-3 px-6 transition-all"
                  style={{
                    fontFamily: 'inherit',
                    opacity: nombre.trim() ? 1 : 0.5,
                    cursor: nombre.trim() ? 'pointer' : 'not-allowed',
                  }}
                  onMouseEnter={e => { if (nombre.trim()) e.currentTarget.style.filter = 'brightness(1.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.filter = 'brightness(1)' }}
                >
                  Continuar
                </button>
              </div>
            </div>
          )}

          {/* ══ STEP 2 — Personas ═══════════════════════════════════════════ */}
          {step === 2 && (
            <div className="nc-step-panel">

              {/* ── Compartido: email invitees ─────────────────────────────── */}
              {tipo === 'compartido' ? (
                <>
                  <p className="text-2xl font-extrabold text-[#1A1A2E] mb-2 tracking-tight">
                    ¿Quién más va a trabajar en este tema?
                  </p>
                  <p className="text-[#5a7478] mb-6 leading-relaxed" style={{ fontSize: '0.95rem' }}>
                    Agregá los emails de las personas que querés invitar.
                  </p>

                  <div className="flex flex-col gap-2.5 mb-3">
                    {invitees.map((inv) => (
                      <div
                        key={inv.id}
                        className="rounded-2xl px-4 py-3.5 flex items-center gap-2"
                        style={{ background: '#FAF8F5', border: '1.5px solid rgba(10,126,140,0.12)' }}
                      >
                        <input
                          type="email"
                          placeholder="Email (requerido)"
                          value={inv.email}
                          onChange={e => updateInvitee(inv.id, 'email', e.target.value)}
                          className="flex-1 min-w-0 rounded-xl px-3 py-2 text-[#1A1A2E] text-sm outline-none transition-all"
                          style={{ background: 'white', border: '1.5px solid rgba(10,126,140,0.12)', fontFamily: 'inherit' }}
                          onFocus={e => e.currentTarget.style.borderColor = '#0A7E8C'}
                          onBlur={e  => e.currentTarget.style.borderColor = 'rgba(10,126,140,0.12)'}
                        />
                        {invitees.length >= 2 && (
                          <button
                            type="button"
                            onClick={() => removeInvitee(inv.id)}
                            className="flex-shrink-0 flex items-center justify-center rounded-full cursor-pointer transition-colors"
                            style={{ width: 30, height: 30, border: '1.5px solid rgba(10,126,140,0.12)', background: 'none', color: '#5a7478', fontSize: '1rem', lineHeight: 1, fontFamily: 'inherit' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#ba1a1a'; e.currentTarget.style.color = '#ba1a1a' }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(10,126,140,0.12)'; e.currentTarget.style.color = '#5a7478' }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={addInvitee}
                    className="mt-1 mb-6 rounded-full px-4 py-2 text-sm font-semibold cursor-pointer transition-colors text-[#0A7E8C] hover:bg-[rgba(10,126,140,0.06)]"
                    style={{ border: '1.5px solid rgba(10,126,140,0.20)', background: 'none', fontFamily: 'inherit' }}
                  >
                    + Agregar persona
                  </button>
                </>
              ) : (
                /* ── Propio: contacts with proximity ── */
                <>
                  <p className="text-2xl font-extrabold text-[#1A1A2E] mb-2 tracking-tight">
                    ¿Quién forma tu círculo?
                  </p>
                  <p className="text-[#5a7478] mb-6 leading-relaxed" style={{ fontSize: '0.95rem' }}>
                    Nombre, rol y cercanía. Los activo según lo que necesites.
                  </p>

                  <div className="flex flex-col gap-2.5">
                    {contacts.map((c, idx) => (
                      <div
                        key={c.id}
                        className="rounded-2xl px-4 py-3.5"
                        style={{ background: '#FAF8F5', border: '1.5px solid rgba(10,126,140,0.12)' }}
                      >
                        <div className="flex items-center gap-2 mb-2.5">
                          <div
                            className="flex-shrink-0 flex items-center justify-center rounded-full text-white font-bold"
                            style={{ width: 36, height: 36, background: AV_GRADIENTS[idx % AV_GRADIENTS.length], fontSize: '0.78rem' }}
                          >
                            {INIT_POOL[idx % INIT_POOL.length]}
                          </div>
                          <input
                            type="text"
                            placeholder="Nombre"
                            value={c.name}
                            onChange={e => updateContact(c.id, 'name', e.target.value)}
                            className="flex-1 min-w-0 rounded-xl px-3 py-2 text-[#1A1A2E] text-sm outline-none transition-all"
                            style={{ background: 'white', border: '1.5px solid rgba(10,126,140,0.12)', fontFamily: 'inherit' }}
                            onFocus={e => e.currentTarget.style.borderColor = '#0A7E8C'}
                            onBlur={e  => e.currentTarget.style.borderColor = 'rgba(10,126,140,0.12)'}
                          />
                          <button
                            type="button"
                            onClick={() => removeContact(c.id)}
                            className="flex-shrink-0 flex items-center justify-center rounded-full cursor-pointer transition-colors"
                            style={{ width: 30, height: 30, border: '1.5px solid rgba(10,126,140,0.12)', background: 'none', color: '#5a7478', fontSize: '1rem', lineHeight: 1, fontFamily: 'inherit' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#ba1a1a'; e.currentTarget.style.color = '#ba1a1a' }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(10,126,140,0.12)'; e.currentTarget.style.color = '#5a7478' }}
                            title="Quitar"
                          >
                            ×
                          </button>
                        </div>
                        <div style={{ paddingLeft: 44 }}>
                          <select
                            value={c.proximity}
                            onChange={e => updateContact(c.id, 'proximity', e.target.value)}
                            className="w-full rounded-xl px-3 py-2 text-[#1A1A2E] text-sm outline-none cursor-pointer"
                            style={{ background: 'white', border: '1.5px solid rgba(10,126,140,0.12)', fontFamily: 'inherit' }}
                            aria-label="Cercanía"
                          >
                            <option value="">¿Qué tan cercana?</option>
                            <option value="nucleo">Es parte de mi núcleo</option>
                            <option value="ayuda">Me ayuda o puede ayudar</option>
                            <option value="profesional">Proveedor o profesional</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={addContact}
                    className="mt-3 mb-6 rounded-full px-4 py-2 text-sm font-semibold cursor-pointer transition-colors text-[#0A7E8C] hover:bg-[rgba(10,126,140,0.06)]"
                    style={{ border: '1.5px solid rgba(10,126,140,0.20)', background: 'none', fontFamily: 'inherit' }}
                  >
                    + Agregar persona
                  </button>
                </>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between gap-3 mt-7">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1.5 rounded-full px-[22px] py-3 font-bold text-[#5a7478] cursor-pointer transition-colors"
                  style={{ border: '1.5px solid rgba(10,126,140,0.12)', background: 'none', fontFamily: 'inherit', fontSize: 'inherit' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#0A7E8C'; e.currentTarget.style.color = '#0A7E8C' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(10,126,140,0.12)'; e.currentTarget.style.color = '#5a7478' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                  Atrás
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="px-3 py-2 text-sm font-semibold cursor-pointer bg-transparent border-none text-[#5a7478] transition-colors"
                    style={{ fontFamily: 'inherit' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#0A7E8C')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#5a7478')}
                  >
                    Omitir
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const allFilled = invitees.every(i => i.email.trim())
                      if (allFilled) setStep(3)
                    }}
                    disabled={invitees.some(i => !i.email.trim())}
                    className="bg-[#0A7E8C] text-white font-bold rounded-full py-3 px-6 transition-all"
                    style={{
                      fontFamily: 'inherit',
                      opacity: invitees.some(i => !i.email.trim()) ? 0.5 : 1,
                      cursor: invitees.some(i => !i.email.trim()) ? 'not-allowed' : 'pointer',
                    }}
                    onMouseEnter={e => {
                      if (!invitees.some(i => !i.email.trim()))
                        e.currentTarget.style.filter = 'brightness(1.1)'
                    }}
                    onMouseLeave={e => (e.currentTarget.style.filter = 'brightness(1)')}
                  >
                    Continuar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══ STEP 3 — Contexto ═══════════════════════════════════════════ */}
          {step === 3 && (
            <div className="nc-step-panel">
              <p className="text-2xl font-extrabold text-[#1A1A2E] mb-2 tracking-tight">
                Lo que sé hasta ahora
              </p>
              <p className="text-[#5a7478] mb-5 leading-relaxed" style={{ fontSize: '0.95rem' }}>
                Generé un contexto inicial basado en lo que me contaste.
                Podés editarlo antes de continuar.
              </p>

              {/* Error */}
              {error && (
                <div style={{
                  marginBottom: 16, padding: '10px 16px',
                  borderRadius: '0.75rem',
                  background: 'rgba(186,26,26,0.07)',
                  border: '1px solid rgba(186,26,26,0.18)',
                  fontSize: '0.8125rem', color: '#ba1a1a', fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                }}>
                  <span>{error}</span>
                  <button onClick={() => setError(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer',
                      color: '#ba1a1a', fontSize: '1rem', lineHeight: 1 }}>✕</button>
                </div>
              )}

              {/* Loading / generating / textarea */}
              {loading ? (
                <div style={{
                  border: '1.5px solid rgba(10,126,140,0.12)',
                  borderRadius: '1rem', background: '#FAF8F5',
                  height: 180, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', marginBottom: 20,
                }}>
                  <p style={{ color: '#5a7478', fontSize: '0.875rem' }}>Creando el tema…</p>
                </div>
              ) : isGenerating ? (
                <div style={{
                  border: '1.5px solid rgba(10,126,140,0.12)',
                  borderRadius: '1rem', background: '#FAF8F5',
                  height: 180, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', marginBottom: 20,
                }}>
                  <p style={{ color: '#5a7478', fontSize: '0.875rem' }}>
                    Generando contexto…
                  </p>
                </div>
              ) : (
                <div style={{ marginBottom: 20 }}>
                  <textarea
                    value={generatedSummary}
                    onChange={(e) => {
                      setGeneratedSummary(e.target.value)
                      setSummaryEdited(true)
                    }}
                    rows={6}
                    placeholder="El agente generará un resumen del contexto aquí…"
                    className="w-full rounded-2xl px-4 py-3 text-[#1A1A2E] text-sm outline-none resize-none transition-all"
                    style={{
                      background: '#FAF8F5',
                      border: '1.5px solid rgba(10,126,140,0.12)',
                      fontFamily: 'inherit',
                      lineHeight: 1.7,
                    }}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = '#0A7E8C'
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(10,126,140,0.09)'
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = 'rgba(10,126,140,0.12)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  />
                  {summaryEdited && (
                    <p style={{
                      fontSize: '0.7rem', color: '#5a7478',
                      marginTop: 6, fontStyle: 'italic',
                    }}>
                      Editado por vos
                    </p>
                  )}
                </div>
              )}

              {/* CTA */}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={goToCase}
                  disabled={loading || isGenerating || (!caseId && !sharedCaseId)}
                  className="bg-[#0A7E8C] text-white font-bold rounded-full py-3 px-6 transition-all"
                  style={{
                    fontFamily: 'inherit',
                    opacity: (loading || isGenerating || (!caseId && !sharedCaseId)) ? 0.5 : 1,
                    cursor: (loading || isGenerating || (!caseId && !sharedCaseId))
                      ? 'not-allowed' : 'pointer',
                  }}
                  onMouseEnter={e => {
                    if (!loading && !isGenerating && (caseId || sharedCaseId))
                      e.currentTarget.style.filter = 'brightness(1.1)'
                  }}
                  onMouseLeave={e => (e.currentTarget.style.filter = 'brightness(1)')}
                >
                  Crear tema
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}

// ── Page export — Suspense boundary required for useSearchParams ──────────────

export default function NuevaTemaPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        background: '#f0f4f8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }`}</style>
          <div style={{ height: 28, borderRadius: 8, background: 'rgba(10,126,140,0.08)', animation: 'pulse 1.5s infinite' }} />
          <div style={{ height: 16, borderRadius: 8, background: 'rgba(10,126,140,0.06)', animation: 'pulse 1.5s infinite', width: '70%' }} />
          <div style={{ height: 16, borderRadius: 8, background: 'rgba(10,126,140,0.06)', animation: 'pulse 1.5s infinite', width: '50%' }} />
        </div>
      </div>
    }>
      <NuevaTemaWizard />
    </Suspense>
  )
}
