'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  metadata:    unknown
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

// ── Helpers ────────────────────────────────────────────────────────────────────

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

  const [loading,      setLoading]      = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [firstName,    setFirstName]    = useState('')
  const [userCtx,      setUserCtx]      = useState<UserContext | null>(null)
  const [suggestions,  setSuggestions]  = useState<Suggestion[]>([])
  const [cases,        setCases]        = useState<CaseRow[]>([])
  const [sharedCases,  setSharedCases]  = useState<SharedCaseRow[]>([])

  // ── Invites notice modal ──────────────────────────────────────────────────
  const [invitesModalOpen, setInvitesModalOpen] = useState(false)
  const [invitedEmails,    setInvitedEmails]    = useState<string[]>([])

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

      // ── Cargar datos en paralelo ──────────────────────────────────────
      const [ctxRes, sugRes, casesRes, membersRes] = await Promise.all([
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
      ])

      setUserCtx(ctxRes.data ?? null)
      setSuggestions((sugRes.data ?? []) as Suggestion[])
      setCases((casesRes.data ?? []) as CaseRow[])

      // Cargar shared cases para totalTemas
      const ids = (membersRes.data ?? []).map((r: { shared_case_id: string }) => r.shared_case_id)
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

  // ── Invites pending notice from onboarding compartido ───────────────────
  useEffect(() => {
    if (loading) return
    try {
      const stored = localStorage.getItem('mhiru:pending-invites-notice')
      if (stored) {
        const emails = JSON.parse(stored) as string[]
        if (Array.isArray(emails) && emails.length > 0) {
          setInvitedEmails(emails)
          setInvitesModalOpen(true)
        }
        localStorage.removeItem('mhiru:pending-invites-notice')
      }
    } catch {
      // silenciar — si el localStorage está corrupto, ignorar
    }
  }, [loading])

  // ── Reload user context from Supabase ────────────────────────────────────
  async function reloadUserContext() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('user_context')
      .select('identity, history, current_state, current_needs, circle_summary, themes_summary, last_regen_at')
      .eq('user_id', user.id)
      .maybeSingle()
    if (data) setUserCtx(data)
  }

  // ── Listen for regen events from Sidebar ─────────────────────────────────
  useEffect(() => {
    function onRegenerating() { setRegenerating(true) }
    function onRegenerated()  { setRegenerating(false); reloadUserContext() }
    window.addEventListener('mhiru:context-regenerating', onRegenerating)
    window.addEventListener('mhiru:context-regenerated',  onRegenerated)
    return () => {
      window.removeEventListener('mhiru:context-regenerating', onRegenerating)
      window.removeEventListener('mhiru:context-regenerated',  onRegenerated)
    }
  }, [])

  // ── Dismiss suggestion ────────────────────────────────────────────────────
  async function dismissSuggestion(id: string) {
    await supabase
      .from('suggestions')
      .update({ status: 'dismissed' })
      .eq('id', id)
    setSuggestions(prev => prev.filter(s => s.id !== id))
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const today      = fmtDate(new Date().toISOString())
  const totalTemas = cases.length + sharedCases.length

  const greetingLine1 = userCtx?.current_needs
    ? `Hola, ${firstName}. Tenés ${totalTemas} ${totalTemas === 1 ? 'tema activo' : 'temas activos'}.`
    : `Hola, ${firstName}.`

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
              <SkeletonCard>
                <SkeletonText width="40%" style={{ marginBottom: 10 }} />
                <SkeletonText width="85%" style={{ marginBottom: 6 }} />
                <SkeletonText width="60%" />
              </SkeletonCard>
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

              {/* ── En qué hacer foco — dark, full-width ─────────────── */}
              {(userCtx?.current_needs || regenerating) && (
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
                    En qué hacer foco
                  </p>
                  {regenerating ? (
                    <div style={{ position: 'relative', zIndex: 1 }}>
                      <SkeletonBase width="95%" height={13} style={{ borderRadius: 6, marginBottom: 8, background: 'rgba(255,255,255,0.12)' }} />
                      <SkeletonBase width="80%" height={13} style={{ borderRadius: 6, marginBottom: 8, background: 'rgba(255,255,255,0.12)' }} />
                      <SkeletonBase width="60%" height={13} style={{ borderRadius: 6, background: 'rgba(255,255,255,0.12)' }} />
                    </div>
                  ) : (
                    <p style={{
                      fontSize: '0.9375rem',
                      color: 'rgba(255,255,255,0.82)',
                      lineHeight: 1.7,
                      margin: 0,
                      position: 'relative',
                      zIndex: 1,
                    }}>
                      {userCtx?.current_needs}
                    </p>
                  )}
                </div>
              )}

              {/* ── Sugerencias — full-width ──────────────────────────── */}
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
            </>
          )}
        </main>
      </div>

      {/* ── Invites sent notice modal ──────────────────────────────────── */}
      {invitesModalOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(26,26,46,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setInvitesModalOpen(false)}
        >
          <div
            style={{
              background: 'white', borderRadius: '1.5rem',
              padding: '32px 28px', maxWidth: 440, width: '100%',
              boxShadow: '0 8px 40px rgba(10,126,140,0.16)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{
              fontSize: '1.125rem', fontWeight: 800,
              color: '#1A1A2E', marginBottom: 8,
            }}>
              Listo, las invitaciones salieron
            </p>
            <p style={{
              fontSize: '0.875rem', color: '#5a7478',
              lineHeight: 1.6, marginBottom: 20,
            }}>
              Estas personas van a recibir una invitación para sumarse al tema:
            </p>

            <div style={{
              display: 'flex', flexDirection: 'column', gap: 8,
              marginBottom: 24,
              padding: '12px 16px',
              background: 'rgba(10,126,140,0.04)',
              borderRadius: '0.75rem',
            }}>
              {invitedEmails.map((email, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: '0.875rem', color: '#1A1A2E', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  <svg
                    width="14" height="14" viewBox="0 0 24 24"
                    fill="none" stroke="#0A7E8C"
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {email}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setInvitesModalOpen(false)}
              style={{
                width: '100%', padding: '12px 0',
                background: '#0A7E8C',
                color: 'white', border: 'none',
                borderRadius: '0.75rem', fontWeight: 700,
                fontSize: '0.875rem', cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  )
}
