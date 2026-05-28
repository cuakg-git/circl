'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import {
  SkeletonStyles, SkeletonText, SkeletonCard, SkeletonBase,
} from '@/components/Skeleton'

// ── Types ──────────────────────────────────────────────────────────────────────

type UserContext = {
  identity:       string | null
  history:        string | null
  current_state:  string | null
  current_needs:  string | null
  circle_summary: string | null
  themes_summary: string | null
  last_regen_at:  string | null
}

type Suggestion = {
  id:          string
  type:        'provider' | 'chat' | 'theme' | 'invitation'
  title:       string
  description: string | null
  status:      string
  metadata:    any
}

type CaseRow = {
  id:         string
  name:       string
  status:     string
  ai_summary: string | null
  started_at: string | null
}

type SharedCaseRow = {
  id:   string
  name: string
}

type ContactRow = {
  id:        string
  name:      string
  initials:  string | null
  proximity: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function fmtDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).replace(/^\w/, c => c.toUpperCase())
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#FFFFFF', borderRadius: '1.5rem',
      boxShadow: '0 4px 24px rgba(10,126,140,0.08)', padding: 24, ...style,
    }}>
      {children}
    </div>
  )
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{
      fontSize: '0.7rem', fontWeight: 700,
      letterSpacing: '0.12em', textTransform: 'uppercase',
      color: '#5a7478', marginBottom: 12, marginTop: 0,
      ...style,
    }}>
      {children}
    </p>
  )
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: '0.875rem', color: '#5a7478',
      fontStyle: 'italic', margin: 0, lineHeight: 1.65,
    }}>
      {children}
    </p>
  )
}

// ── OrbitalCard ────────────────────────────────────────────────────────────────

function OrbitalCardDash() {
  const size = 180
  const r1   = 140
  const r2   = 88
  const p1   = size - r1
  const p2   = size - r2

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0,
      width: size, height: size,
      pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <path d={`M ${p1} ${size} A ${r1} ${r1} 0 0 1 ${size} ${p1}`}
          fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5"
          strokeDasharray="2 6" strokeLinecap="round" />
        <path d={`M ${p2} ${size} A ${r2} ${r2} 0 0 1 ${size} ${p2}`}
          fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1"
          strokeDasharray="2 5" strokeLinecap="round" />
        <circle cx={50} cy={50} r={6} fill="#2ECDA7" opacity="0.85" />
      </svg>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()

  const [loading,     setLoading]     = useState(true)
  const [firstName,   setFirstName]   = useState('')
  const [userCtx,     setUserCtx]     = useState<UserContext | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [cases,       setCases]       = useState<CaseRow[]>([])
  const [sharedCases, setSharedCases] = useState<SharedCaseRow[]>([])
  const [contacts,    setContacts]    = useState<ContactRow[]>([])

  // ── Chat "Lo que sé sobre vos" ────────────────────────────────────────────
  const [ctxQuestion,    setCtxQuestion]    = useState<string | null>(null)
  const [ctxSuggestions, setCtxSuggestions] = useState<string[]>([])
  const [ctxInput,       setCtxInput]       = useState('')
  const [ctxLoading,     setCtxLoading]     = useState(false)
  const [ctxDone,        setCtxDone]        = useState(false)
  const [ctxTurn,        setCtxTurn]        = useState(1)
  const [ctxError,       setCtxError]       = useState<string | null>(null)

  const [ctxOpen, setCtxOpen] = useState(true)

  // ── Auth + onboarding check ───────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed, full_name')
        .eq('id', user.id)
        .single()

      if (!profile?.onboarding_completed) {
        router.replace('/onboarding')
        return
      }

      const full  = profile?.full_name ?? user.user_metadata?.full_name ?? ''
      const first = full.trim().split(/\s+/)[0] || 'vos'
      setFirstName(first)

      // ── Cargar todos los datos en paralelo ──────────────────────────────
      const [ctxRes, sugRes, casesRes, membersRes, contactsRes] = await Promise.all([
        supabase
          .from('user_context')
          .select('identity, history, current_state, current_needs, circle_summary, themes_summary, last_regen_at')
          .eq('user_id', user.id)
          .maybeSingle(),

        supabase
          .from('suggestions')
          .select('id, type, title, description, status, metadata')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .order('generated_at', { ascending: false })
          .limit(6),

        supabase
          .from('cases')
          .select('id, name, status, ai_summary, started_at')
          .eq('user_id', user.id)
          .eq('status', 'activa')
          .order('started_at', { ascending: false }),

        supabase
          .from('shared_case_members')
          .select('shared_case_id')
          .eq('user_id', user.id)
          .eq('status', 'active'),

        supabase
          .from('contacts')
          .select('id, name, initials, proximity')
          .eq('user_id', user.id)
          .order('sort_order', { ascending: true, nullsFirst: false })
          .limit(4),
      ])

      setUserCtx(ctxRes.data ?? null)
      setSuggestions((sugRes.data ?? []) as Suggestion[])
      setCases((casesRes.data ?? []) as CaseRow[])
      setContacts((contactsRes.data ?? []) as ContactRow[])

      // Cargar nombres de shared cases
      const ids = (membersRes.data ?? []).map((r: any) => r.shared_case_id)
      if (ids.length > 0) {
        const { data: scData } = await supabase
          .from('shared_cases')
          .select('id, name')
          .in('id', ids)
        setSharedCases((scData ?? []) as SharedCaseRow[])
      }

      setLoading(false)
    }
    init()
  }, [router])

  // ── Init chat "Lo que sé sobre vos" ──────────────────────────────────────
  useEffect(() => {
    if (loading) return
    async function initChat() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const accessToken = session?.access_token ?? ''
        const res = await fetch('/api/user-context/chat/init', {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        })
        const json = await res.json()
        if (res.ok) {
          setCtxQuestion(json.question)
          setCtxSuggestions(json.suggestions ?? [])
        }
      } catch {
        setCtxQuestion('¿Cómo describirías quién sos más allá de tu trabajo o rol familiar?')
        setCtxSuggestions([
          'Soy muy familiar y cercano',
          'Me defino por mis proyectos',
          'Soy alguien muy independiente',
        ])
      }
    }
    initChat()
  }, [loading])

  // ── Dismiss suggestion ────────────────────────────────────────────────────
  async function dismissSuggestion(id: string) {
    await supabase
      .from('suggestions')
      .update({ status: 'dismissed' })
      .eq('id', id)
    setSuggestions(prev => prev.filter(s => s.id !== id))
  }

  // ── Handle context chat submit ────────────────────────────────────────────
  async function handleCtxSubmit(response: string) {
    if (!response.trim() || ctxLoading || ctxDone) return
    setCtxLoading(true)
    setCtxError(null)
    setCtxInput('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token ?? ''

      const res = await fetch('/api/user-context/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          current_question: ctxQuestion,
          user_response:    response,
          turn:             ctxTurn,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setCtxError(json.error ?? 'Hubo un error. Intentá de nuevo.')
        setCtxLoading(false)
        return
      }

      // Actualizar identity en el estado local
      setUserCtx(prev => prev
        ? { ...prev, identity: json.new_identity }
        : {
            identity: json.new_identity, history: null, current_state: null,
            current_needs: null, circle_summary: null, themes_summary: null,
            last_regen_at: null,
          }
      )

      const newTurn = ctxTurn + 1
      setCtxTurn(newTurn)

      if (json.next_question && newTurn <= 3) {
        setCtxQuestion(json.next_question)
        setCtxSuggestions(json.suggestions ?? [])
      } else {
        setCtxDone(true)
        setCtxSuggestions([])
        setCtxQuestion(null)
      }
    } catch {
      setCtxError('No se pudo conectar. Intentá de nuevo.')
    } finally {
      setCtxLoading(false)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const today      = fmtDate(new Date().toISOString())
  const totalTemas = cases.length + sharedCases.length

  // Frases del saludo
  const greetingLine1 = userCtx?.current_needs
    ? `Hola, ${firstName}. Tenés ${totalTemas} ${totalTemas === 1 ? 'tema activo' : 'temas activos'}.`
    : `Hola, ${firstName}.`

  const greetingLine2 = userCtx?.current_state ?? null

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes heroBgDrift {
          0%, 100% {
            background:
              radial-gradient(ellipse at 15% 15%, rgba(61,199,166,0.03) 0%, transparent 55%),
              radial-gradient(ellipse at 85% 10%, rgba(80,220,175,0.07) 0%, transparent 50%),
              radial-gradient(ellipse at 88% 82%, rgba(224,121,49,0.08) 0%, transparent 52%),
              radial-gradient(ellipse at 12% 88%, rgba(158,160,81,0.08) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 65%),
              #f0f4f8;
          }
          50% {
            background:
              radial-gradient(ellipse at 10% 22%, rgba(61,199,166,0.03) 0%, transparent 55%),
              radial-gradient(ellipse at 78%  8%, rgba(80,220,175,0.07) 0%, transparent 50%),
              radial-gradient(ellipse at 92% 75%, rgba(224,121,49,0.08) 0%, transparent 52%),
              radial-gradient(ellipse at 18% 92%, rgba(158,160,81,0.08) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 65%),
              #f0f4f8;
          }
        }
        .dash-bg { animation: heroBgDrift 30s ease-in-out infinite; }
        @media (max-width: 768px) {
          .dash-grid { grid-template-columns: 1fr !important; }
        }
        @keyframes typingDot {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40%           { transform: scale(1);   opacity: 1;   }
        }
      `}</style>

      <div className="dash-bg flex min-h-screen">
        <Sidebar />

        <main className="flex-1 ml-0 md:ml-[240px] min-h-screen px-5 py-8 pb-28 md:px-10 md:py-10 md:pb-10">
          <SkeletonStyles />

          {/* ── Skeleton ──────────────────────────────────────────────── */}
          {loading && (
            <div>
              <SkeletonBase width="50%" height={32} style={{ borderRadius: 8, marginBottom: 10 }} />
              <SkeletonBase width="70%" height={18} style={{ borderRadius: 8, marginBottom: 40 }} />
              <SkeletonCard style={{ marginBottom: 20 }}>
                <SkeletonText width="30%" style={{ marginBottom: 10 }} />
                <SkeletonText width="90%" style={{ marginBottom: 6 }} />
                <SkeletonText width="75%" />
              </SkeletonCard>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                <SkeletonCard><SkeletonText width="40%" style={{ marginBottom: 10 }} /><SkeletonText width="85%" /><SkeletonText width="60%" /></SkeletonCard>
                <SkeletonCard><SkeletonText width="40%" style={{ marginBottom: 10 }} /><SkeletonText width="85%" /><SkeletonText width="60%" /></SkeletonCard>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <SkeletonCard><SkeletonText width="40%" style={{ marginBottom: 10 }} /><SkeletonText width="80%" /><SkeletonText width="50%" /></SkeletonCard>
                <SkeletonCard><SkeletonText width="40%" style={{ marginBottom: 10 }} /><SkeletonText width="80%" /><SkeletonText width="50%" /></SkeletonCard>
              </div>
            </div>
          )}

          {!loading && (
            <>
              {/* ── Saludo narrativo ──────────────────────────────────── */}
              <div style={{
                borderLeft: '3px solid #0A7E8C',
                paddingLeft: 16,
                marginBottom: 32,
              }}>
                <h1 style={{
                  fontSize: '1.375rem',
                  fontWeight: 800,
                  color: '#1A1A2E',
                  letterSpacing: '-0.02em',
                  marginBottom: 0,
                  lineHeight: 1.25,
                }}>
                  {greetingLine1}
                </h1>
                <p style={{
                  fontSize: '0.75rem',
                  color: '#5a7478',
                  marginTop: 6,
                  marginBottom: 0,
                }}>
                  {today}
                </p>
              </div>

              {/* ── Card de contexto narrativo ────────────────────────── */}
              {greetingLine2 && (
                <div style={{
                  background: '#1A1A2E',
                  borderRadius: '1.5rem',
                  padding: '28px',
                  position: 'relative',
                  overflow: 'hidden',
                  marginBottom: 20,
                }}>
                  <OrbitalCardDash />
                  <p style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase' as const,
                    color: '#2ECDA7',
                    marginBottom: 12,
                    position: 'relative',
                    zIndex: 1,
                  }}>
                    Cómo pienso que estás
                  </p>
                  <p style={{
                    fontSize: '0.9375rem',
                    color: 'rgba(255,255,255,0.82)',
                    lineHeight: 1.7,
                    margin: 0,
                    position: 'relative',
                    zIndex: 1,
                  }}>
                    {greetingLine2}
                  </p>
                </div>
              )}

              {/* ── Lo que sé sobre vos — full width ────────────────── */}
              <div style={{
                background: '#FFFFFF',
                borderRadius: '1.5rem',
                boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                marginBottom: 20,
                overflow: 'hidden',
              }}>
                {/* ── Header colapsable ── */}
                <button
                  type="button"
                  onClick={() => setCtxOpen(prev => !prev)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 24px',
                    background: 'none',
                    border: 'none',
                    borderBottom: '1px solid rgba(10,126,140,0.08)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700,
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: '#5a7478',
                  }}>
                    Lo que sé sobre vos
                  </span>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24"
                    fill="none" stroke="#5a7478"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{
                      flexShrink: 0,
                      transition: 'transform 0.2s',
                      transform: ctxOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {/* ── Párrafo de contexto — colapsable ── */}
                {ctxOpen && userCtx?.identity && (
                  <p style={{
                    fontSize: '0.8125rem',
                    color: '#5a7478',
                    lineHeight: 1.55,
                    margin: 0,
                    padding: '16px 24px',
                    borderBottom: '1px solid rgba(10,126,140,0.08)',
                    background: 'rgba(10,126,140,0.03)',
                  }}>
                    {userCtx.identity}
                  </p>
                )}

                {/* ── Minichat — siempre visible ── */}
                <div style={{ padding: '16px 24px' }}>
                  {ctxDone ? (
                    <p style={{
                      fontSize: '0.875rem', color: '#5a7478',
                      fontStyle: 'italic', margin: 0,
                    }}>
                      Ya tengo bastante contexto sobre vos. Volvé cuando
                      quieras actualizar tu perfil.
                    </p>
                  ) : ctxQuestion ? (
                    <>
                      {/* Pregunta */}
                      <p style={{
                        fontSize: '0.9375rem', fontWeight: 600,
                        color: '#1A1A2E', marginBottom: 14, marginTop: 0,
                      }}>
                        {ctxQuestion}
                      </p>

                      {/* Chips */}
                      {ctxSuggestions.length > 0 && !ctxLoading && (
                        <div style={{
                          display: 'flex', flexWrap: 'wrap', gap: 8,
                          marginBottom: 14,
                        }}>
                          {ctxSuggestions.map((s, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => handleCtxSubmit(s)}
                              disabled={ctxLoading}
                              style={{
                                padding: '7px 16px', borderRadius: 9999,
                                border: '1.5px solid rgba(10,126,140,0.25)',
                                background: 'white', color: '#0A7E8C',
                                fontSize: '0.875rem', fontWeight: 600,
                                cursor: 'pointer', fontFamily: 'inherit',
                                transition: 'background 0.15s',
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(10,126,140,0.06)'
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = 'white'
                              }}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Typing indicator */}
                      {ctxLoading && (
                        <div style={{
                          display: 'flex', gap: 5, alignItems: 'center',
                          marginBottom: 14,
                        }}>
                          {[0, 1, 2].map(i => (
                            <span key={i} style={{
                              width: 7, height: 7, borderRadius: '50%',
                              background: '#0A7E8C', display: 'inline-block',
                              animation: `typingDot 1.2s ease-in-out ${i * 0.2}s infinite`,
                            }} />
                          ))}
                        </div>
                      )}

                      {/* Input libre */}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                        <textarea
                          value={ctxInput}
                          onChange={e => setCtxInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              handleCtxSubmit(ctxInput)
                            }
                          }}
                          disabled={ctxLoading || ctxDone}
                          placeholder="O escribí tu respuesta…"
                          rows={1}
                          style={{
                            flex: 1,
                            border: '1.5px solid rgba(10,126,140,0.12)',
                            borderRadius: '1rem',
                            padding: '10px 14px',
                            fontSize: '0.875rem',
                            lineHeight: 1.5,
                            resize: 'none',
                            outline: 'none',
                            fontFamily: 'inherit',
                            color: '#1A1A2E',
                            background: '#FAF8F5',
                            minHeight: 42,
                            maxHeight: 100,
                            opacity: ctxLoading ? 0.5 : 1,
                          }}
                          onFocus={e => { e.currentTarget.style.borderColor = '#0A7E8C' }}
                          onBlur={e  => { e.currentTarget.style.borderColor = 'rgba(10,126,140,0.12)' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleCtxSubmit(ctxInput)}
                          disabled={ctxLoading || !ctxInput.trim() || ctxDone}
                          style={{
                            width: 42, height: 42, borderRadius: '50%',
                            border: 'none',
                            cursor: (ctxLoading || !ctxInput.trim() || ctxDone)
                              ? 'not-allowed' : 'pointer',
                            background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                            display: 'flex', alignItems: 'center',
                            justifyContent: 'center', flexShrink: 0,
                            opacity: (ctxLoading || !ctxInput.trim() || ctxDone) ? 0.4 : 1,
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24"
                            fill="none" stroke="white"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                          </svg>
                        </button>
                      </div>

                      {/* Error */}
                      {ctxError && (
                        <div style={{
                          marginTop: 10, padding: '8px 14px',
                          borderRadius: '0.75rem',
                          background: 'rgba(186,26,26,0.07)',
                          border: '1px solid rgba(186,26,26,0.18)',
                          fontSize: '0.8125rem', color: '#ba1a1a', fontWeight: 600,
                          display: 'flex', alignItems: 'center',
                          justifyContent: 'space-between', gap: 8,
                        }}>
                          <span>{ctxError}</span>
                          <button
                            onClick={() => setCtxError(null)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: '#ba1a1a', fontSize: '1rem', lineHeight: 1,
                            }}
                          >✕</button>
                        </div>
                      )}
                    </>
                  ) : null}
                </div>
              </div>

              {/* ── Grid principal — 4 bloques ────────────────────────── */}
              <div
                className="dash-grid"
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}
              >

                {/* ── 1. En qué hacer foco ───────────────────────────── */}
                <Card>
                  <SectionLabel>En qué hacer foco</SectionLabel>
                  {userCtx?.current_needs ? (
                    <p style={{
                      fontSize: '0.9375rem', color: '#1A1A2E',
                      lineHeight: 1.7, margin: 0,
                    }}>
                      {userCtx.current_needs}
                    </p>
                  ) : (
                    <EmptyText>Sin datos de necesidades todavía.</EmptyText>
                  )}
                </Card>

                {/* ── 2. Sugerencias ─────────────────────────────────── */}
                <Card>
                  <SectionLabel>Sugerencias</SectionLabel>
                  {suggestions.length === 0 ? (
                    <EmptyText>No hay sugerencias pendientes.</EmptyText>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {suggestions.slice(0, 4).map(s => (
                        <div
                          key={s.id}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: 10,
                            padding: '10px 12px',
                            background: 'rgba(10,126,140,0.04)',
                            borderRadius: '0.75rem',
                          }}
                        >
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                            background: s.type === 'chat'
                              ? 'rgba(10,126,140,0.10)'
                              : s.type === 'theme'
                              ? 'rgba(83,74,183,0.10)'
                              : s.type === 'invitation'
                              ? 'rgba(46,205,167,0.10)'
                              : 'rgba(232,145,58,0.10)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.7rem', fontWeight: 700,
                            color: s.type === 'chat'
                              ? '#0A7E8C'
                              : s.type === 'theme'
                              ? '#534AB7'
                              : s.type === 'invitation'
                              ? '#0a6e5a'
                              : '#b86a10',
                          }}>
                            {s.type === 'chat' ? '💬' : s.type === 'theme' ? '📁' : s.type === 'invitation' ? '👥' : '🔗'}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1A1A2E', marginBottom: 2 }}>
                              {s.title}
                            </div>
                            {s.description && (
                              <div style={{ fontSize: '0.75rem', color: '#5a7478', lineHeight: 1.4 }}>
                                {s.description}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => dismissSuggestion(s.id)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: '#5a7478', padding: 2, flexShrink: 0,
                              fontSize: '1rem', lineHeight: 1,
                            }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#ba1a1a' }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#5a7478' }}
                            title="Descartar"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* ── 3. Tu círculo ──────────────────────────────────── */}
                <Card>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <SectionLabel style={{ marginBottom: 0 }}>Tu círculo</SectionLabel>
                    <Link href="/circulo" style={{ fontSize: '0.75rem', color: '#0A7E8C', fontWeight: 600, textDecoration: 'none' }}>
                      Ver todos →
                    </Link>
                  </div>
                  {userCtx?.circle_summary && (
                    <p style={{
                      fontSize: '0.875rem', color: '#5a7478',
                      fontStyle: 'italic', lineHeight: 1.65,
                      margin: '0 0 14px',
                    }}>
                      {userCtx.circle_summary}
                    </p>
                  )}
                  {contacts.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {contacts.map(c => {
                        const initials = (c.initials ?? getInitials(c.name)).slice(0, 2)
                        return (
                          <Link
                            key={c.id}
                            href={`/circulo/${c.id}`}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
                          >
                            <div style={{
                              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                              background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.75rem', fontWeight: 700, color: 'white',
                            }}>
                              {initials}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1A1A2E', lineHeight: 1.2 }}>
                                {c.name}
                              </div>
                              {c.proximity && (
                                <div style={{ fontSize: '0.7rem', color: '#5a7478', marginTop: 1 }}>
                                  {c.proximity === 'nucleo' ? 'Núcleo' : c.proximity === 'ayuda' ? 'Red de ayuda' : 'Profesional'}
                                </div>
                              )}
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  ) : (
                    <EmptyText>Todavía no agregaste personas a tu círculo.</EmptyText>
                  )}
                </Card>

                {/* ── 4. Tus temas ───────────────────────────────────── */}
                <Card>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <SectionLabel style={{ marginBottom: 0 }}>Tus temas</SectionLabel>
                    <Link href="/case" style={{ fontSize: '0.75rem', color: '#0A7E8C', fontWeight: 600, textDecoration: 'none' }}>
                      Ver todos →
                    </Link>
                  </div>
                  {userCtx?.themes_summary && (
                    <p style={{
                      fontSize: '0.875rem', color: '#5a7478',
                      fontStyle: 'italic', lineHeight: 1.65,
                      margin: '0 0 14px',
                    }}>
                      {userCtx.themes_summary}
                    </p>
                  )}
                  {cases.length === 0 && sharedCases.length === 0 ? (
                    <EmptyText>No tenés temas activos todavía.</EmptyText>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {cases.map(c => (
                        <Link
                          key={c.id}
                          href={`/case/${c.id}`}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 10px', borderRadius: '0.75rem',
                            background: 'rgba(10,126,140,0.04)',
                            textDecoration: 'none', transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(61,199,166,0.08)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(10,126,140,0.04)' }}
                        >
                          <div style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: '#0A7E8C', flexShrink: 0,
                          }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1A1A2E' }}>
                              {c.name}
                            </div>
                          </div>
                          <span style={{
                            fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em',
                            textTransform: 'uppercase', color: '#0A7E8C',
                            background: 'rgba(10,126,140,0.08)', borderRadius: 9999,
                            padding: '2px 8px', flexShrink: 0,
                          }}>
                            Propio
                          </span>
                        </Link>
                      ))}
                      {sharedCases.map(sc => (
                        <Link
                          key={sc.id}
                          href={`/case/shared/${sc.id}`}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 10px', borderRadius: '0.75rem',
                            background: 'rgba(83,74,183,0.04)',
                            textDecoration: 'none', transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(83,74,183,0.08)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(83,74,183,0.04)' }}
                        >
                          <div style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: '#534AB7', flexShrink: 0,
                          }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1A1A2E' }}>
                              {sc.name}
                            </div>
                          </div>
                          <span style={{
                            fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em',
                            textTransform: 'uppercase', color: '#534AB7',
                            background: 'rgba(83,74,183,0.08)', borderRadius: 9999,
                            padding: '2px 8px', flexShrink: 0,
                          }}>
                            Compartido
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </Card>

              </div>
            </>
          )}
        </main>
      </div>
    </>
  )
}
