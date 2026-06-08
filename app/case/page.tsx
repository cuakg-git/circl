'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { SkeletonStyles, SkeletonText, SkeletonCard, SkeletonBase } from '@/components/Skeleton'

// ── Types ──────────────────────────────────────────────────────────────────────

type UserContext = {
  themes_summary: string | null
}

type Case = {
  id:         string
  name:       string
  status:     string
  category:   string | null
  started_at: string | null
}

type CaseWithProgress = Case & {
  totalTasks: number
  doneTasks:  number
}

type SharedCase = {
  id:           string
  name:         string
  status:       string
  created_at:   string
  member_count: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysSince(iso: string | null) {
  if (!iso) return 0
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

function fmtLongDate(iso: string | null) {
  if (!iso) return '—'
  const s = new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function IconWarning() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0A7E8C"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9"  x2="12"    y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function IconChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

// ── Crisis Card ────────────────────────────────────────────────────────────────

function CaseCard({ c, isActive }: { c: CaseWithProgress; isActive: boolean }) {
  const days = daysSince(c.started_at)

  return (
    <Link
      href={`/case/${c.id}`}
      className="block no-underline transition-all"
      style={{
        background:    '#FFFFFF',
        borderRadius:  '1.5rem',
        boxShadow:     '0 4px 24px rgba(10,126,140,0.08)',
        padding:       '24px',
        marginBottom:  16,
        opacity:       isActive ? 1 : 0.65,
        color:         'inherit',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 8px 40px rgba(10,126,140,0.16)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 24px rgba(10,126,140,0.08)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-start" style={{ marginBottom: 10 }}>
        <div>
          <h3
            className="font-extrabold text-[#1A1A2E]"
            style={{ fontSize: '1.125rem', marginBottom: 6, letterSpacing: '-0.01em' }}
          >
            {c.name}
          </h3>
        </div>
        <span
          className="flex-shrink-0"
          style={{
            color:      isActive ? '#0A7E8C' : '#5a7478',
            marginLeft: 12,
          }}
        >
          <IconChevronRight />
        </span>
      </div>

      {/* Days / category */}
      <div className="text-[0.7rem] text-[#5a7478]" style={{ marginTop: 4 }}>
        Inicio: {fmtLongDate(c.started_at)}
        {' · '}
        {days} {days === 1 ? 'día' : 'días'} {isActive ? 'activa' : ''}
        {c.category ? ` · ${c.category}` : ''}
      </div>
    </Link>
  )
}

// ── Shared Case Card ──────────────────────────────────────────────────────────

function SharedCaseCard({ sc }: { sc: SharedCase }) {
  return (
    <Link
      href={`/case/shared/${sc.id}`}
      className="block no-underline transition-all"
      style={{
        background:   '#FFFFFF',
        borderRadius: '1.5rem',
        boxShadow:    '0 4px 24px rgba(10,126,140,0.08)',
        padding:      '24px',
        marginBottom: 16,
        color:        'inherit',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 8px 40px rgba(10,126,140,0.16)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 24px rgba(10,126,140,0.08)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-start" style={{ marginBottom: 10 }}>
        <div>
          <h3
            className="font-extrabold text-[#1A1A2E]"
            style={{ fontSize: '1.125rem', marginBottom: 6, letterSpacing: '-0.01em' }}
          >
            {sc.name}
          </h3>
        </div>
        <span className="flex-shrink-0" style={{ color: '#0A7E8C', marginLeft: 12 }}>
          <IconChevronRight />
        </span>
      </div>

      {/* Meta */}
      <div className="text-[0.7rem] text-[#5a7478]" style={{ marginTop: 4 }}>
        Inicio: {fmtLongDate(sc.created_at)}
        {' · '}
        {sc.member_count} {sc.member_count === 1 ? 'miembro' : 'miembros'}
      </div>
    </Link>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CaseListPage() {
  const router = useRouter()
  const [cases,       setCases]       = useState<CaseWithProgress[]>([])
  const [sharedCases, setSharedCases] = useState<SharedCase[]>([])
  const [loading,     setLoading]     = useState(true)

  const [userCtx,        setUserCtx]        = useState<UserContext | null>(null)
  const [regenerating,   setRegenerating]   = useState(false)
  const [ctxQuestion,    setCtxQuestion]    = useState<string | null>(null)
  const [ctxSuggestions, setCtxSuggestions] = useState<string[]>([])
  const [ctxInput,       setCtxInput]       = useState('')
  const [ctxLoading,     setCtxLoading]     = useState(false)
  const [ctxDone,        setCtxDone]        = useState(false)
  const [ctxTurn,        setCtxTurn]        = useState(1)
  const [ctxError,       setCtxError]       = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) { router.replace('/login'); return }

      const { data: casesData, error: casesError } = await supabase
        .from('cases')
        .select('id, name, status, category, started_at')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })

      if (casesError) console.error('Error cases:', casesError)

      const list = (casesData ?? []) as Case[]

      // Fetch tasks counts in parallel for each case
      const withProgress = await Promise.all(
        list.map(async (c) => {
          const [{ count: total }, { count: done }] = await Promise.all([
            supabase
              .from('tasks')
              .select('id', { count: 'exact', head: true })
              .eq('case_id', c.id),
            supabase
              .from('tasks')
              .select('id', { count: 'exact', head: true })
              .eq('case_id', c.id)
              .eq('status', 'completada'),
          ])
          return { ...c, totalTasks: total ?? 0, doneTasks: done ?? 0 }
        }),
      )

      setCases(withProgress)

      // Paso 1: obtener los shared_case_ids donde el usuario es miembro activo
      const { data: memberRows } = await supabase
        .from('shared_case_members')
        .select('shared_case_id')
        .eq('user_id', user.id)
        .eq('status', 'active')

      const sharedCaseIds = (memberRows ?? []).map((r: any) => r.shared_case_id)

      // Paso 2: si hay IDs, obtener los casos directamente
      if (sharedCaseIds.length === 0) {
        setSharedCases([])
        const { data: ctxEarly } = await supabase
          .from('user_context')
          .select('themes_summary')
          .eq('user_id', user.id)
          .maybeSingle()
        setUserCtx(ctxEarly ?? null)
        setLoading(false)
        return
      }

      const { data: sharedData } = await supabase
        .from('shared_cases')
        .select('id, name, status, created_at')
        .in('id', sharedCaseIds)
        // Sin filtro de status — traemos activos y cerrados

      // Paso 3: member counts
      const sharedWithCounts = await Promise.all(
        (sharedData ?? []).map(async (sc: any) => {
          const { count } = await supabase
            .from('shared_case_members')
            .select('id', { count: 'exact', head: true })
            .eq('shared_case_id', sc.id)
            .eq('status', 'active')
          return { ...sc, member_count: count ?? 0 } as SharedCase
        })
      )

      setSharedCases(sharedWithCounts)

      const { data: ctxData } = await supabase
        .from('user_context')
        .select('themes_summary')
        .eq('user_id', user.id)
        .maybeSingle()
      setUserCtx(ctxData ?? null)

      setLoading(false)
    }

    load()
  }, [router])

  // ── Regen event listeners ──────────────────────────────────────────────────
  useEffect(() => {
    function onRegenerating() { setRegenerating(true) }
    async function onRegenerated() {
      setRegenerating(false)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('user_context')
        .select('themes_summary')
        .eq('user_id', user.id)
        .maybeSingle()
      if (data) setUserCtx(data)
    }
    window.addEventListener('mhiru:context-regenerating', onRegenerating)
    window.addEventListener('mhiru:context-regenerated',  onRegenerated)
    return () => {
      window.removeEventListener('mhiru:context-regenerating', onRegenerating)
      window.removeEventListener('mhiru:context-regenerated',  onRegenerated)
    }
  }, [])

  // ── Init chat ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return
    async function initChat() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const accessToken = session?.access_token ?? ''
        const res = await fetch('/api/user-context/chat/init?dimension=themes_summary', {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        })
        const json = await res.json()
        if (res.ok) {
          setCtxQuestion(json.question)
          setCtxSuggestions(json.suggestions ?? [])
        }
      } catch {
        setCtxQuestion('¿Hay algún tema que te esté ocupando más la cabeza últimamente?')
        setCtxSuggestions([
          'Sí, una situación reciente',
          'Algo que viene de hace tiempo',
          'Nada en particular',
        ])
      }
    }
    initChat()
  }, [loading])

  // ── Context chat submit ────────────────────────────────────────────────────
  async function handleCtxSubmit(response: string) {
    if (!response.trim() || ctxLoading || ctxDone) return
    setRegenerating(true)
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
          dimension:        'themes_summary',
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

      setUserCtx(prev => prev
        ? { ...prev, themes_summary: json.new_summary }
        : { themes_summary: json.new_summary }
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
      setRegenerating(false)
    }
  }

  const active         = cases.filter((c) => c.status === 'activa')
  const resolved       = cases.filter((c) => c.status !== 'activa')
  const activeShared   = sharedCases.filter((sc) => sc.status === 'activa')
  const resolvedShared = sharedCases.filter((sc) => sc.status === 'resuelta')

  return (
    <>
      <style>{`
        @keyframes heroBgDrift {
          0%, 100% {
            background:
              radial-gradient(ellipse at 15% 15%, rgba(61,199,166,0.03)  0%, transparent 55%),
              radial-gradient(ellipse at 85% 10%, rgba(80,220,175,0.07)  0%, transparent 50%),
              radial-gradient(ellipse at 88% 82%, rgba(224,121,49,0.08)  0%, transparent 52%),
              radial-gradient(ellipse at 12% 88%, rgba(158,160,81,0.08)  0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 65%),
              #f0f4f8;
          }
          25% {
            background:
              radial-gradient(ellipse at 22% 10%, rgba(61,199,166,0.03)  0%, transparent 55%),
              radial-gradient(ellipse at 90% 20%, rgba(80,220,175,0.07)  0%, transparent 50%),
              radial-gradient(ellipse at 80% 88%, rgba(224,121,49,0.08)  0%, transparent 52%),
              radial-gradient(ellipse at  6% 78%, rgba(158,160,81,0.08)  0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 65%),
              #f0f4f8;
          }
          50% {
            background:
              radial-gradient(ellipse at 10% 22%, rgba(61,199,166,0.03)  0%, transparent 55%),
              radial-gradient(ellipse at 78%  8%, rgba(80,220,175,0.07)  0%, transparent 50%),
              radial-gradient(ellipse at 92% 75%, rgba(224,121,49,0.08)  0%, transparent 52%),
              radial-gradient(ellipse at 18% 92%, rgba(158,160,81,0.08)  0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 65%),
              #f0f4f8;
          }
          75% {
            background:
              radial-gradient(ellipse at 20% 22%, rgba(61,199,166,0.03)  0%, transparent 55%),
              radial-gradient(ellipse at 82% 18%, rgba(80,220,175,0.07)  0%, transparent 50%),
              radial-gradient(ellipse at 85% 90%, rgba(224,121,49,0.08)  0%, transparent 52%),
              radial-gradient(ellipse at 14% 82%, rgba(158,160,81,0.08)  0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 65%),
              #f0f4f8;
          }
        }
        .crisis-bg { animation: heroBgDrift 30s ease-in-out infinite; }
        @keyframes typingDot {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40%           { transform: scale(1);   opacity: 1;   }
        }
      `}</style>

      <div className="crisis-bg flex min-h-screen">
        <Sidebar />

        <main className="flex-1 ml-0 md:ml-[240px] min-h-screen px-5 py-8 pb-28 md:px-10 md:py-10 md:pb-10">

          {/* ── Page header ─────────────────────────────────────────────── */}
          <div style={{ marginBottom: 40 }}>
            <h1
              className="font-extrabold text-[#1A1A2E]"
              style={{ fontSize: '2rem', letterSpacing: '-0.03em', lineHeight: 1.15 }}
            >
              Temas
            </h1>
            <p className="text-[#5a7478] mt-1.5" style={{ fontSize: '1rem' }}>
              Registros de situaciones activas y resueltas.
            </p>
          </div>

          {/* ── Lo que sé de tus temas ─────────────────────────── */}
          {!loading && (
            <div style={{ 
              margin: '0 auto 32px',
              background: '#FFFFFF',
              borderRadius: '1.5rem',
              boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
              overflow: 'hidden',
            }}>
              <div style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                padding: '14px 24px',
                borderBottom: '1px solid rgba(10,126,140,0.08)',
              }}>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 700,
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: '#5a7478',
                }}>
                  Lo que sé de tus temas
                </span>
              </div>

              {(userCtx?.themes_summary || regenerating) && (
                regenerating
                  ? <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(10,126,140,0.08)', background: 'rgba(10,126,140,0.03)' }}>
                      <SkeletonBase width="95%" height={13} style={{ borderRadius: 6, marginBottom: 8 }} />
                      <SkeletonBase width="80%" height={13} style={{ borderRadius: 6, marginBottom: 8 }} />
                      <SkeletonBase width="60%" height={13} style={{ borderRadius: 6 }} />
                    </div>
                  : <p style={{
                      fontSize: '0.8125rem',
                      color: '#5a7478',
                      lineHeight: 1.55,
                      margin: 0,
                      padding: '16px 24px',
                      borderBottom: '1px solid rgba(10,126,140,0.08)',
                      background: 'rgba(10,126,140,0.03)',
                    }}>
                      {userCtx!.themes_summary}
                    </p>
              )}

              <div style={{ padding: '16px 24px' }}>
                {ctxDone ? (
                  <p style={{
                    fontSize: '0.875rem', color: '#5a7478',
                    fontStyle: 'italic', margin: 0,
                  }}>
                    Ya tengo bastante contexto sobre tus temas. Volvé cuando
                    quieras actualizar.
                  </p>
                ) : ctxQuestion ? (
                  <>
                    <p style={{
                      fontSize: '0.9375rem', fontWeight: 600,
                      color: '#1A1A2E', marginBottom: 14, marginTop: 0,
                    }}>
                      {ctxQuestion}
                    </p>

                    {ctxSuggestions.length > 0 && !ctxLoading && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
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
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(10,126,140,0.06)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'white' }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    )}

                    {ctxLoading && (
                      <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 14 }}>
                        {[0, 1, 2].map(i => (
                          <span key={i} style={{
                            width: 7, height: 7, borderRadius: '50%',
                            background: '#0A7E8C', display: 'inline-block',
                            animation: `typingDot 1.2s ease-in-out ${i * 0.2}s infinite`,
                          }} />
                        ))}
                      </div>
                    )}

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
                          cursor: (ctxLoading || !ctxInput.trim() || ctxDone) ? 'not-allowed' : 'pointer',
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
          )}

          <SkeletonStyles />

          {/* ── Loading skeleton ────────────────────────────────────────── */}
          {loading && (
            <div>
              {/* Section label */}
              <SkeletonText width={80} className="mb-4" />

              {/* Crisis card skeleton */}
              <SkeletonCard style={{ marginBottom: 16 }}>
                {/* Title */}
                <SkeletonText width="55%" className="mb-3" />
                {/* Badge */}
                <SkeletonBase width={64} height={20} style={{ borderRadius: 9999, marginBottom: 14 }} />
                {/* Meta line */}
                <SkeletonText width="70%" className="mb-4" />
                {/* Progress bar */}
                <SkeletonBase width="100%" height={6} style={{ borderRadius: 9999 }} />
              </SkeletonCard>

              <SkeletonCard style={{ marginBottom: 16 }}>
                <SkeletonText width="50%" className="mb-3" />
                <SkeletonBase width={64} height={20} style={{ borderRadius: 9999, marginBottom: 14 }} />
                <SkeletonText width="65%" className="mb-4" />
                <SkeletonBase width="100%" height={6} style={{ borderRadius: 9999 }} />
              </SkeletonCard>

              {/* Shared cases skeleton */}
              <SkeletonText width={100} className="mb-4" style={{ marginTop: 40 }} />
              <SkeletonCard>
                <SkeletonText width="60%" className="mb-3" />
                <SkeletonBase width={80} height={20} style={{ borderRadius: 9999, marginBottom: 14 }} />
                <SkeletonText width="55%" />
              </SkeletonCard>
            </div>
          )}


          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: 24,
            alignItems: 'start',
          }}>
            {/* ── Propios column ──────────────────────────────────────────── */}
            <div>
              {/* ── Propios section ──────────────────────────────────────────── */}
              <>
                <p
                  className="font-bold uppercase text-[#5a7478]"
                  style={{
                    fontSize: '0.875rem',
                    letterSpacing: '0.1em',
                    marginBottom: 16,
                  }}
                >
                  Propios
                </p>
                {active.length > 0 ? (
                  active.map((c) => (
                    <CaseCard key={c.id} c={c} isActive={true} />
                  ))
                ) : !loading ? (
                  <div style={{
                    border: '1.5px dashed rgba(61,199,166,0.35)',
                    borderRadius: '1.5rem',
                    padding: '28px 24px',
                    textAlign: 'center',
                    background: 'transparent',
                    marginBottom: 16,
                  }}>
                    <p className="font-bold text-[#1A1A2E]"
                      style={{ fontSize: '0.875rem', marginBottom: 6 }}>
                      No tenés temas propios todavía
                    </p>
                    <p style={{ fontSize: '0.75rem', color: '#5a7478', lineHeight: 1.6 }}>
                      Acá verás todos los temas tuyos que tengas.
                    </p>
                  </div>
                ) : null}
              </>

              {/* ── Add theme button ────────────────────────────────────────── */}
              <div style={{ marginTop: 16 }}>
                <Link
                  href="/case/shared/nueva?tipo=propio"
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '14px',
                    borderRadius: 9999,
                    border: '1.5px dashed rgba(10,126,140,0.40)',
                    background: 'transparent',
                    color: '#0A7E8C',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLAnchorElement
                    el.style.background = 'rgba(10,126,140,0.06)'
                    el.style.borderColor = 'rgba(10,126,140,0.65)'
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLAnchorElement
                    el.style.background = 'transparent'
                    el.style.borderColor = 'rgba(10,126,140,0.40)'
                  }}
                >
                  + Agregar tema propio
                </Link>
              </div>
            </div>

            {/* ── Shared column ────────────────────────────────────────────── */}
            <div>
              {/* ── Shared section ───────────────────────────────────────────── */}
              {!loading && (
                <>
                  <p
                    className="font-bold uppercase text-[#5a7478]"
                    style={{
                      fontSize:      '0.875rem',
                      letterSpacing: '0.1em',
                      marginBottom:  16,
                    }}
                  >
                    Compartidos
                  </p>
                  {activeShared.length > 0 ? (
                    activeShared.map((sc) => (
                      <SharedCaseCard key={sc.id} sc={sc} />
                    ))
                  ) : (
                    <div style={{
                      border: '1.5px dashed rgba(61,199,166,0.35)',
                      borderRadius: '1.5rem',
                      padding:      '28px 24px',
                      textAlign:    'center',
                      background:   'transparent',
                    }}>
                      <p className="font-bold text-[#1A1A2E]" style={{ fontSize: '0.875rem', marginBottom: 6 }}>
                        No tenés temas compartidos todavía
                      </p>
                      <p style={{ fontSize: '0.75rem', color: '#5a7478', lineHeight: 1.6 }}>
                        Cuando crees o te inviten a un tema compartido, vas a verlo acá.
                      </p>
                    </div>
                  )}

                  <div style={{ marginTop: 16 }}>
                    <Link
                      href="/case/shared/nueva?tipo=compartido"
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '14px',
                        borderRadius: 9999,
                        border: '1.5px dashed rgba(10,126,140,0.40)',
                        background: 'transparent',
                        color: '#0A7E8C',
                        fontWeight: 700,
                        fontSize: '0.875rem',
                        textAlign: 'center',
                        textDecoration: 'none',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(10,126,140,0.06)'
                        e.currentTarget.style.borderColor = 'rgba(10,126,140,0.65)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                        e.currentTarget.style.borderColor = 'rgba(10,126,140,0.40)'
                      }}
                    >
                      + Agregar tema compartido
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Resueltos (propios + compartidos) ─────────────────────── */}
          {(resolved.length > 0 || resolvedShared.length > 0) && (
            <>
              <p
                className="font-bold uppercase text-[#5a7478]"
                style={{
                  fontSize:      '0.875rem',
                  letterSpacing: '0.1em',
                  marginTop:     40,
                  marginBottom:  16,
                }}
              >
                Resueltos
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                gap: 24,
                alignItems: 'start',
              }}>
                <div>
                  {resolved.length > 0 ? (
                    resolved.map((c) => (
                      <CaseCard key={c.id} c={c} isActive={false} />
                    ))
                  ) : (
                    <div style={{
                      border: '1.5px dashed rgba(90,116,120,0.18)',
                      borderRadius: '1.5rem',
                      padding: '24px 20px',
                      textAlign: 'center',
                      background: 'transparent',
                    }}>
                      <p style={{ fontSize: '0.75rem', color: '#5a7478', fontStyle: 'italic', margin: 0 }}>
                        No tenés temas propios cerrados.
                      </p>
                    </div>
                  )}
                </div>
                <div>
                  {resolvedShared.length > 0 ? (
                    resolvedShared.map((sc) => (
                      <SharedCaseCard key={sc.id} sc={sc} />
                    ))
                  ) : (
                    <div style={{
                      border: '1.5px dashed rgba(90,116,120,0.18)',
                      borderRadius: '1.5rem',
                      padding: '24px 20px',
                      textAlign: 'center',
                      background: 'transparent',
                    }}>
                      <p style={{ fontSize: '0.75rem', color: '#5a7478', fontStyle: 'italic', margin: 0 }}>
                        No tenés temas compartidos cerrados.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

        </main>
      </div>
    </>
  )
}
