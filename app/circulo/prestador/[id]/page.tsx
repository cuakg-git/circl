'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { SkeletonStyles, SkeletonText, SkeletonAvatar, SkeletonBase } from '@/components/Skeleton'

// ── Types ──────────────────────────────────────────────────────────────────────

type ProviderContact = {
  id:                  string
  name:                string
  initials:            string | null
  phone:               string | null
  email:               string | null
  relationship:        string | null
  avatar_url:          string | null
  context_description: string | null
  context_summary:     string | null
  ctx_last_question:   string | null
  provider_catalog_id: string | null
}

type CatalogData = {
  name:              string
  specialty:         string | null
  category:          string | null
  description:       string | null
  phone:             string | null
  email:             string | null
  website:           string | null
  location:          string | null
  zones:             string[] | null
  health_insurances: string[] | null
}

// ── Helper ─────────────────────────────────────────────────────────────────────

function initialsFrom(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function buildInviteMessage(_name: string) {
  return `Hola, te escribo porque uso Mhiru, una plataforma que me ayuda a coordinar mi salud y mi red de apoyo. Me gustaría sumarte como prestador para poder conectarnos mejor desde ahí. ¿Te interesa conocerla? Es gratis para prestadores.`
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PrestadorDetailPage() {
  const router    = useRouter()
  const params    = useParams()
  const contactId = params.id as string

  const [loading,       setLoading]       = useState(true)
  const [contact,       setContact]       = useState<ProviderContact | null>(null)
  const [catalogData,   setCatalogData]   = useState<CatalogData | null>(null)
  const [userId,        setUserId]        = useState<string | null>(null)
  const [ctxDescOpen,    setCtxDescOpen]    = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError,   setDeleteError]   = useState<string | null>(null)

  const [ctxQuestion,    setCtxQuestion]    = useState('')
  const [ctxSuggestions, setCtxSuggestions] = useState<string[]>([])
  const [ctxInput,       setCtxInput]       = useState('')
  const [ctxLoading,     setCtxLoading]     = useState(false)
  const [ctxError,       setCtxError]       = useState<string | null>(null)
  const [ctxDone,        setCtxDone]        = useState(false)

  const [inviteModal, setInviteModal] = useState<{
    open:    boolean
    message: string
    sent:    boolean
  }>({ open: false, message: '', sent: false })

  // ── Load ──────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) { router.replace('/login'); return }

      setUserId(user.id)

      const { data: contactData } = await supabase
        .from('contacts')
        .select('id, name, initials, phone, email, relationship, avatar_url, context_description, context_summary, ctx_last_question, provider_catalog_id')
        .eq('id', contactId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!contactData) { router.replace('/circulo'); return }

      const c = contactData as ProviderContact
      setContact(c)

      if (c.ctx_last_question) {
        setCtxQuestion(c.ctx_last_question)
        setCtxSuggestions([])
        setCtxDone(false)
      } else {
        setCtxQuestion(`¿Cómo llegaste a trabajar con ${c.name}?`)
        setCtxSuggestions([
          'Me lo recomendaron',
          'Lo encontré en Mhiru',
          'Ya lo conocía de antes',
        ])
        setCtxDone(false)
      }

      if (c.provider_catalog_id) {
        const { data: catData } = await supabase
          .from('provider_catalog')
          .select('name, specialty, category, description, phone, email, website, location, zones, health_insurances')
          .eq('id', c.provider_catalog_id)
          .maybeSingle()
        if (catData) setCatalogData(catData as CatalogData)
      }

      setLoading(false)
    }
    load()
  }, [router, contactId])

  // ── Handlers ──────────────────────────────────────────────────────────────────

  async function handleCtxSubmit(response: string) {
    if (!response.trim() || ctxLoading || !userId || !contactId) return
    setCtxLoading(true)
    setCtxError(null)
    setCtxInput('')

    try {
      const res = await fetch('/api/contact-context', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id:          userId,
          contact_id:       contactId,
          current_question: ctxQuestion,
          user_response:    response,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        setCtxError(json.error || 'Hubo un error. Intentá de nuevo.')
        setCtxLoading(false)
        return
      }

      setContact((prev) => prev ? {
        ...prev,
        context_summary:     json.new_summary,
        context_description: json.new_description ?? prev.context_description,
      } : null)

      if (json.next_question) {
        setCtxQuestion(json.next_question)
        setCtxSuggestions(json.suggestions || [])
      } else {
        setCtxDone(true)
        setCtxSuggestions([])
      }
    } catch {
      setCtxError('No se pudo conectar. Intentá de nuevo.')
    } finally {
      setCtxLoading(false)
    }
  }

  const handleDelete = useCallback(async () => {
    if (!userId) return
    setDeleteLoading(true)
    setDeleteError(null)
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', contactId)
      .eq('user_id', userId)
    if (error) {
      setDeleteLoading(false)
      setDeleteConfirm(false)
      setDeleteError('No se pudo eliminar el prestador. Intentá de nuevo.')
      return
    }
    router.replace('/circulo')
  }, [userId, contactId, router])

  // ── Computed ──────────────────────────────────────────────────────────────────

  const c         = contact
  const firstName = c?.name.split(' ')[0] ?? c?.name ?? ''
  const initials  = c ? (c.initials ?? initialsFrom(c.name)).slice(0, 2) : ''
  const phone     = c?.phone        || catalogData?.phone     || null
  const email     = c?.email        || catalogData?.email     || null
  const specialty = c?.relationship || catalogData?.specialty || null

  // ── Render ────────────────────────────────────────────────────────────────────

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
          50% {
            background:
              radial-gradient(ellipse at 10% 22%, rgba(61,199,166,0.03)  0%, transparent 55%),
              radial-gradient(ellipse at 78%  8%, rgba(80,220,175,0.07)  0%, transparent 50%),
              radial-gradient(ellipse at 92% 75%, rgba(224,121,49,0.08)  0%, transparent 52%),
              radial-gradient(ellipse at 18% 92%, rgba(158,160,81,0.08)  0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 65%),
              #f0f4f8;
          }
        }
        .prestador-detail-bg { animation: heroBgDrift 30s ease-in-out infinite; }
      `}</style>

      <div className="prestador-detail-bg flex min-h-screen" style={{ overflowX: 'hidden' }}>
        <Sidebar />

        <main
          className="flex-1 ml-0 md:ml-[240px] min-h-screen px-5 py-8 pb-28 md:px-10 md:py-10 md:pb-10"
          style={{ overflowX: 'hidden', minWidth: 0 }}
        >
          <SkeletonStyles />

          {/* Breadcrumb */}
          <nav style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Link href="/circulo" style={{
              fontSize: '0.8125rem', color: '#0A7E8C', fontWeight: 600,
              textDecoration: 'none',
            }}>
              Tu círculo
            </Link>
            <span style={{ color: '#5a7478', fontSize: '0.8125rem' }}>→</span>
            <Link href="/circulo" style={{
              fontSize: '0.8125rem', color: '#0A7E8C', fontWeight: 600,
              textDecoration: 'none',
            }}>
              Prestadores
            </Link>
            <span style={{ color: '#5a7478', fontSize: '0.8125rem' }}>→</span>
            <span style={{ fontSize: '0.8125rem', color: '#5a7478', fontWeight: 500 }}>
              {contact?.name ?? '…'}
            </span>
          </nav>

          {/* ── Loading skeleton ──────────────────────────────────────────────── */}
          {loading && (
            <div className="flex flex-col" style={{ gap: 0, maxWidth: 680, margin: '0 auto' }}>
              <div style={{
                background: '#FFFFFF', borderRadius: '1.5rem',
                boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                padding: 32, textAlign: 'center', marginBottom: 24,
              }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                  <SkeletonAvatar size={96} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                  <SkeletonText width={160} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                  <SkeletonBase width={120} height={22} style={{ borderRadius: 9999 }} />
                  <SkeletonBase width={80} height={22} style={{ borderRadius: 9999 }} />
                </div>
              </div>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ marginBottom: 24 }}>
                  <SkeletonBase width={100} height={12} style={{ borderRadius: 4, marginBottom: 12 }} />
                  <div style={{
                    background: '#FFFFFF', borderRadius: '1rem',
                    boxShadow: '0 4px 24px rgba(10,126,140,0.08)', padding: '13px 20px',
                  }}>
                    {[0, 1].map((j) => (
                      <div key={j} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '10px 0',
                        borderBottom: j === 0 ? '1px solid rgba(10,126,140,0.08)' : 'none',
                      }}>
                        <SkeletonBase width={70} height={10} style={{ borderRadius: 4 }} />
                        <SkeletonText width="60%" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Content ──────────────────────────────────────────────────────── */}
          {!loading && c && (
            <div className="flex flex-col" style={{ gap: 0, minWidth: 0, maxWidth: 680, margin: '0 auto' }}>

              {/* ── Hero ─────────────────────────────────────────────────────── */}
              <div style={{ padding: '16px 0 24px', textAlign: 'center' }}>
                <div style={{
                  width: 96, height: 96, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '1.75rem', color: 'white',
                  boxShadow: '0 8px 40px rgba(10,126,140,0.16)',
                  margin: '0 auto 14px', overflow: 'hidden',
                }}>
                  {initials}
                </div>

                <div style={{
                  fontSize: '1.5rem', fontWeight: 800,
                  letterSpacing: '-0.02em', color: '#1A1A2E', marginBottom: 10,
                }}>
                  {c.name}
                </div>

                <div style={{
                  display: 'flex', gap: 8, justifyContent: 'center',
                  flexWrap: 'wrap', marginBottom: 12,
                }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', borderRadius: 9999,
                    padding: '3px 11px', fontSize: '0.7rem', fontWeight: 700,
                    letterSpacing: '0.05em', textTransform: 'uppercase',
                    background: 'rgba(10,126,140,0.07)', color: '#0A7E8C',
                  }}>
                    Prestador de servicios
                  </span>
                  {catalogData && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      borderRadius: 9999, padding: '3px 11px',
                      fontSize: '0.7rem', fontWeight: 700,
                      letterSpacing: '0.05em', textTransform: 'uppercase',
                      background: 'rgba(46,205,167,0.14)', color: '#0a6e5a',
                    }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="3"
                        strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      En Mhiru
                    </span>
                  )}
                </div>

                {!catalogData && (
                  <button
                    type="button"
                    onClick={() => setInviteModal({
                      open:    true,
                      message: buildInviteMessage(c.name),
                      sent:    false,
                    })}
                    style={{
                      background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                      color: 'white', border: 'none', borderRadius: 9999,
                      padding: '8px 20px', fontSize: '0.8125rem', fontWeight: 700,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Invitar a Mhiru
                  </button>
                )}
              </div>

              {/* ── Card Lo que sé (unificado) ──────────────────────────────── */}
              {(c.context_description || !ctxDone) && (
              <div style={{
                background: '#FFFFFF',
                borderRadius: '1.5rem',
                boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                marginBottom: 24,
                overflow: 'hidden',
              }}>
                <button
                  type="button"
                  onClick={() => setCtxDescOpen(prev => !prev)}
                  style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'flex-start', gap: 8,
                    padding: '14px 20px',
                    background: 'none', border: 'none',
                    borderBottom: '1px solid rgba(10,126,140,0.08)',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700,
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: '#5a7478',
                  }}>
                    Lo que sé
                  </span>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24"
                    fill="none" stroke="#5a7478"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{
                      flexShrink: 0,
                      transition: 'transform 0.2s',
                      transform: ctxDescOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {ctxDescOpen && c.context_description && (
                  <p style={{
                    fontSize: '0.8125rem', color: '#5a7478',
                    lineHeight: 1.55, margin: 0,
                    padding: '16px 20px',
                    borderBottom: '1px solid rgba(10,126,140,0.08)',
                    background: 'rgba(10,126,140,0.03)',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {c.context_description}
                  </p>
                )}

                <div style={{ padding: '16px 20px' }}>
                  {ctxDone ? (
                    <p style={{
                      fontSize: '0.8125rem', color: '#5a7478',
                      fontStyle: 'italic', margin: 0,
                    }}>
                      Por ahora ya tengo bastante contexto sobre {firstName}.
                      Volvé cuando quieras agregar más.
                    </p>
                  ) : (
                    <>
                      <p style={{
                        fontSize: '0.875rem', fontWeight: 600,
                        color: '#1A1A2E', marginBottom: 12, marginTop: 0,
                      }}>
                        {ctxQuestion}
                      </p>

                      {ctxSuggestions.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                          {ctxSuggestions.map((s, i) => (
                            <button
                              key={i}
                              onClick={() => handleCtxSubmit(s)}
                              disabled={ctxLoading}
                              style={{
                                padding: '6px 14px', borderRadius: 9999,
                                border: '1.5px solid rgba(10,126,140,0.25)',
                                background: 'white', color: '#0A7E8C',
                                fontSize: '0.8125rem', fontWeight: 600,
                                cursor: ctxLoading ? 'not-allowed' : 'pointer',
                                opacity: ctxLoading ? 0.5 : 1,
                                transition: 'background 0.15s',
                                fontFamily: 'inherit',
                              }}
                              onMouseEnter={(e) => { if (!ctxLoading) e.currentTarget.style.background = 'rgba(10,126,140,0.06)' }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'white' }}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                        <textarea
                          value={ctxInput}
                          onChange={(e) => setCtxInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              handleCtxSubmit(ctxInput)
                            }
                          }}
                          disabled={ctxLoading}
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
                            transition: 'border-color 0.2s',
                          }}
                          onFocus={(e) => { e.currentTarget.style.borderColor = '#0A7E8C' }}
                          onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(10,126,140,0.12)' }}
                        />
                        <button
                          onClick={() => handleCtxSubmit(ctxInput)}
                          disabled={ctxLoading || !ctxInput.trim()}
                          style={{
                            width: 42, height: 42, borderRadius: '50%',
                            border: 'none',
                            cursor: ctxLoading || !ctxInput.trim() ? 'not-allowed' : 'pointer',
                            background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                            color: 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                            opacity: ctxLoading || !ctxInput.trim() ? 0.4 : 1,
                            transition: 'opacity 0.15s',
                          }}
                        >
                          {ctxLoading ? (
                            <span style={{ fontSize: 10 }}>…</span>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24"
                              fill="none" stroke="currentColor"
                              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="22" y1="2" x2="11" y2="13" />
                              <polygon points="22 2 15 22 11 13 2 9 22 2" />
                            </svg>
                          )}
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
                  )}
                </div>
              </div>
              )}

              {/* ── Card Datos ───────────────────────────────────────────────── */}
              {(phone || email || specialty) && (
                <div style={{ marginBottom: 24 }}>
                  <p style={{
                    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                    textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
                  }}>Datos</p>
                  <div style={{
                    background: '#FFFFFF', borderRadius: '1rem',
                    boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                  }}>
                    {phone && (
                      <div style={{
                        display: 'flex', alignItems: 'center',
                        padding: '13px 20px', gap: 12,
                        borderBottom: (email || specialty) ? '1px solid rgba(10,126,140,0.12)' : 'none',
                      }}>
                        <span style={{
                          fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                          textTransform: 'uppercase', color: '#5a7478', minWidth: 90,
                        }}>Teléfono</span>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1A1A2E', flex: 1 }}>
                          {phone}
                        </span>
                      </div>
                    )}
                    {email && (
                      <div style={{
                        display: 'flex', alignItems: 'center',
                        padding: '13px 20px', gap: 12,
                        borderBottom: specialty ? '1px solid rgba(10,126,140,0.12)' : 'none',
                      }}>
                        <span style={{
                          fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                          textTransform: 'uppercase', color: '#5a7478', minWidth: 90,
                        }}>Email</span>
                        <span style={{
                          fontSize: '0.875rem', fontWeight: 600, color: '#1A1A2E', flex: 1,
                          wordBreak: 'break-word',
                        }}>
                          {email}
                        </span>
                      </div>
                    )}
                    {specialty && (
                      <div style={{
                        display: 'flex', alignItems: 'center',
                        padding: '13px 20px', gap: 12,
                      }}>
                        <span style={{
                          fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                          textTransform: 'uppercase', color: '#5a7478', minWidth: 90,
                        }}>Especialidad</span>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1A1A2E', flex: 1 }}>
                          {specialty}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Card Datos del catálogo Mhiru ────────────────────────────── */}
              {catalogData && (
                <div style={{ marginBottom: 24 }}>
                  <p style={{
                    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                    textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
                  }}>Datos del catálogo Mhiru</p>
                  <div style={{
                    background: '#FFFFFF', borderRadius: '1rem',
                    boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                    padding: '16px 20px',
                  }}>
                    {catalogData.category && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        paddingBottom: 12, marginBottom: 12,
                        borderBottom: '1px solid rgba(10,126,140,0.08)',
                      }}>
                        <span style={{
                          fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                          textTransform: 'uppercase', color: '#5a7478', minWidth: 90,
                        }}>Categoría</span>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1A1A2E' }}>
                          {catalogData.category}
                        </span>
                      </div>
                    )}

                    {catalogData.description && (
                      <p style={{
                        fontSize: '0.8125rem', color: '#5a7478',
                        lineHeight: 1.55, margin: '0 0 12px',
                        paddingBottom: 12,
                        borderBottom: '1px solid rgba(10,126,140,0.08)',
                      }}>
                        {catalogData.description}
                      </p>
                    )}

                    {catalogData.health_insurances && catalogData.health_insurances.length > 0 && (
                      <div style={{
                        marginBottom: 12, paddingBottom: 12,
                        borderBottom: '1px solid rgba(10,126,140,0.08)',
                      }}>
                        <p style={{
                          fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                          textTransform: 'uppercase', color: '#5a7478', margin: '0 0 8px',
                        }}>Obras sociales</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {catalogData.health_insurances.map((hi) => (
                            <span key={hi} style={{
                              background: 'rgba(10,126,140,0.08)', color: '#0A7E8C',
                              borderRadius: 9999, padding: '3px 10px',
                              fontSize: '0.7rem', fontWeight: 700,
                            }}>{hi}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {catalogData.zones && catalogData.zones.length > 0 && (
                      <div style={{
                        marginBottom: catalogData.website ? 12 : 0,
                        paddingBottom: catalogData.website ? 12 : 0,
                        borderBottom: catalogData.website ? '1px solid rgba(10,126,140,0.08)' : 'none',
                      }}>
                        <p style={{
                          fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                          textTransform: 'uppercase', color: '#5a7478', margin: '0 0 8px',
                        }}>Zonas</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {catalogData.zones.map((z) => (
                            <span key={z} style={{
                              background: 'rgba(83,74,183,0.08)', color: '#534AB7',
                              borderRadius: 9999, padding: '3px 10px',
                              fontSize: '0.7rem', fontWeight: 700,
                            }}>{z}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {catalogData.website && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{
                          fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                          textTransform: 'uppercase', color: '#5a7478', minWidth: 90,
                        }}>Sitio web</span>
                        <a
                          href={catalogData.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: '0.875rem', fontWeight: 600, color: '#0A7E8C',
                            textDecoration: 'none',
                          }}
                        >
                          {catalogData.website}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Card Acciones ────────────────────────────────────────────── */}
              <div style={{ marginBottom: 24 }}>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
                }}>Acciones</p>
                <div style={{
                  background: '#FFFFFF', borderRadius: '1rem',
                  boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                  padding: '16px 20px',
                }}>
                  {deleteError && (
                    <div style={{
                      marginBottom: 12, padding: '8px 14px',
                      borderRadius: '0.75rem',
                      background: 'rgba(186,26,26,0.07)',
                      border: '1px solid rgba(186,26,26,0.18)',
                      fontSize: '0.8125rem', color: '#ba1a1a', fontWeight: 600,
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', gap: 8,
                    }}>
                      <span>{deleteError}</span>
                      <button
                        onClick={() => setDeleteError(null)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: '#ba1a1a', fontSize: '1rem', lineHeight: 1,
                        }}
                      >✕</button>
                    </div>
                  )}

                  {!deleteConfirm ? (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(true)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#ba1a1a', fontSize: '0.875rem', fontWeight: 600,
                        fontFamily: 'inherit', padding: 0,
                      }}
                    >
                      Eliminar a {firstName} de tu círculo
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <p style={{
                        fontSize: '0.875rem', color: '#1A1A2E', fontWeight: 600, margin: 0,
                      }}>
                        ¿Confirmás que querés eliminar a {firstName} de tu círculo?
                      </p>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(false)}
                          disabled={deleteLoading}
                          style={{
                            flex: 1, padding: '10px 0',
                            background: 'rgba(10,126,140,0.07)',
                            color: '#0A7E8C', border: 'none', borderRadius: 9999,
                            fontWeight: 700, fontSize: '0.875rem',
                            cursor: 'pointer', fontFamily: 'inherit',
                            opacity: deleteLoading ? 0.5 : 1,
                          }}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={deleteLoading}
                          style={{
                            flex: 1, padding: '10px 0',
                            background: '#ba1a1a',
                            color: 'white', border: 'none', borderRadius: 9999,
                            fontWeight: 700, fontSize: '0.875rem',
                            cursor: deleteLoading ? 'not-allowed' : 'pointer',
                            fontFamily: 'inherit',
                            opacity: deleteLoading ? 0.6 : 1,
                          }}
                        >
                          {deleteLoading ? 'Eliminando…' : 'Confirmar'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </main>
      </div>

      {/* ── Modal de invitación ──────────────────────────────────────────────── */}
      {inviteModal.open && (
        <>
          <div
            onClick={() => setInviteModal(prev => ({ ...prev, open: false }))}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.45)', zIndex: 600,
            }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 601, width: 'min(92vw, 420px)',
            background: '#FFFFFF', borderRadius: '1.5rem',
            boxShadow: '0 24px 80px rgba(0,0,0,0.20)',
            padding: '28px 28px 24px',
          }}>
            {!inviteModal.sent ? (
              <>
                <div style={{
                  display: 'flex', alignItems: 'flex-start',
                  justifyContent: 'space-between', marginBottom: 20,
                }}>
                  <div>
                    <p style={{
                      fontSize: '1rem', fontWeight: 800,
                      color: '#1A1A2E', margin: '0 0 4px',
                    }}>
                      Invitar a {c?.name} a Mhiru
                    </p>
                    <p style={{
                      fontSize: '0.8125rem', color: '#5a7478',
                      margin: 0, lineHeight: 1.5,
                    }}>
                      Podés editar el mensaje antes de enviarlo.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInviteModal(prev => ({ ...prev, open: false }))}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#5a7478', fontSize: '1.2rem', lineHeight: 1,
                      padding: '0 0 0 12px', flexShrink: 0,
                    }}
                  >✕</button>
                </div>

                <p style={{
                  fontSize: '0.7rem', fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: '#5a7478', marginBottom: 8,
                }}>Mensaje</p>
                <textarea
                  value={inviteModal.message}
                  onChange={(e) => setInviteModal(prev => ({ ...prev, message: e.target.value }))}
                  rows={6}
                  style={{
                    width: '100%', padding: '10px 14px',
                    border: '1.5px solid rgba(10,126,140,0.20)',
                    borderRadius: '0.75rem', fontSize: '0.875rem',
                    outline: 'none', color: '#1A1A2E',
                    fontFamily: 'inherit', background: '#FAF8F5',
                    resize: 'vertical', lineHeight: 1.5,
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#0A7E8C' }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(10,126,140,0.20)' }}
                />

                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button
                    type="button"
                    onClick={() => setInviteModal(prev => ({ ...prev, open: false }))}
                    style={{
                      flex: 1, padding: '11px 0',
                      background: 'rgba(10,126,140,0.07)',
                      color: '#0A7E8C', border: 'none', borderRadius: 9999,
                      fontWeight: 700, fontSize: '0.875rem',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviteModal(prev => ({ ...prev, sent: true }))}
                    style={{
                      flex: 1, padding: '11px 0',
                      background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                      color: 'white', border: 'none', borderRadius: 9999,
                      fontWeight: 700, fontSize: '0.875rem',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Enviar invitación
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'rgba(46,205,167,0.14)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                    stroke="#0a6e5a" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p style={{
                  fontSize: '1rem', fontWeight: 800,
                  color: '#1A1A2E', margin: '0 0 8px',
                }}>
                  Invitación enviada
                </p>
                <p style={{
                  fontSize: '0.8125rem', color: '#5a7478',
                  margin: '0 0 24px', lineHeight: 1.5,
                }}>
                  Le avisamos a {c?.name} sobre Mhiru.
                </p>
                <button
                  type="button"
                  onClick={() => setInviteModal({ open: false, message: '', sent: false })}
                  style={{
                    width: '100%', padding: '11px 0',
                    background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                    color: 'white', border: 'none', borderRadius: 9999,
                    fontWeight: 700, fontSize: '0.875rem',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Listo
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  )
}
