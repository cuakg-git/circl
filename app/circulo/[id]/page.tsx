'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import {
  SkeletonStyles, SkeletonText, SkeletonAvatar, SkeletonBase,
} from '@/components/Skeleton'

// ── Types ──────────────────────────────────────────────────────────────────────

type Proximity = 'nucleo' | 'ayuda' | 'profesional'

type Contact = {
  id:                  string
  name:                string
  initials:            string | null
  role:                string | null
  proximity:           string | null
  phone:               string | null
  email:               string | null
  relationship:        string | null
  avatar_url:          string | null
  sort_order:          number | null
  context_summary:     string | null
  context_description: string | null
  ctx_last_question:   string | null
}

type CrisisRow = {
  id:         string
  name:       string
  status:     string
  started_at: string | null
}

type CrisisJoinRow = {
  crisis: CrisisRow | CrisisRow[] | null
}

// ── Constants ──────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  acompanamiento:      'Acompañamiento',
  logistico:           'Logístico',
  prestador_servicios: 'Prestador de servicios',
}

const ROLE_BADGE: Record<string, { bg: string; color: string }> = {
  acompanamiento:      { bg: 'rgba(46,205,167,0.14)', color: '#0a6e5a' },
  logistico:           { bg: 'rgba(232,145,58,0.10)', color: '#b86a10' },
  prestador_servicios: { bg: 'rgba(10,126,140,0.07)', color: '#0A7E8C' },
}

const PROXIMITY_LABELS: Record<Proximity, string> = {
  nucleo:      'Es parte de mi núcleo',
  ayuda:       'Es alguien que me ayuda o puede ayudar',
  profesional: 'Es un proveedor de servicios o un profesional',
}

const SELECT_BASE: React.CSSProperties = {
  flex: 1, maxWidth: 220,
  background: '#FAF8F5',
  border: '1.5px solid rgba(10,126,140,0.12)',
  borderRadius: 9999,
  padding: '8px 36px 8px 16px',
  fontSize: '0.875rem', color: '#1A1A2E',
  outline: 'none', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235a7478' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  backgroundSize: 16,
}

const ENABLED_SELECT_STYLE: React.CSSProperties  = { ...SELECT_BASE, cursor: 'pointer' }
const DISABLED_SELECT_STYLE: React.CSSProperties = { ...SELECT_BASE, cursor: 'not-allowed', opacity: 0.65 }

// ── Helper ─────────────────────────────────────────────────────────────────────

function initialsFrom(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

// ── Sub-component: SSDataRow ───────────────────────────────────────────────────

function SSDataRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '13px 20px',
      borderBottom: last ? 'none' : '1px solid rgba(10,126,140,0.12)',
      gap: 12,
    }}>
      <span style={{
        fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
        textTransform: 'uppercase', color: '#5a7478', minWidth: 80,
      }}>{label}</span>
      <span style={{
        fontSize: '0.875rem', fontWeight: 600, color: '#1A1A2E', flex: 1,
        wordBreak: 'break-word',
      }}>{value}</span>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ContactoDetailPage() {
  const router    = useRouter()
  const params    = useParams()
  const contactId = params.id as string

  const [loading,          setLoading]          = useState(true)
  const [contact,          setContact]          = useState<Contact | null>(null)
  const [avatarUrl,        setAvatarUrl]        = useState<string | null>(null)
  const [crises,           setCrises]           = useState<CrisisRow[]>([])
  const [crisesLoading,    setCrisesLoading]    = useState(false)
  const [userId,           setUserId]           = useState<string | null>(null)
  const [proximityLoading, setProximityLoading] = useState(false)
  const [proximityError,   setProximityError]   = useState<string | null>(null)
  const [deleteConfirm,    setDeleteConfirm]    = useState(false)
  const [deleteLoading,    setDeleteLoading]    = useState(false)
  const [deleteError,      setDeleteError]      = useState<string | null>(null)

  const [editingPhone,    setEditingPhone]    = useState(false)
  const [editingEmail,    setEditingEmail]    = useState(false)
  const [editingRelation, setEditingRelation] = useState(false)
  const [phoneVal,        setPhoneVal]        = useState('')
  const [emailVal,        setEmailVal]        = useState('')
  const [relationVal,     setRelationVal]     = useState('')
  const [dataLoading,     setDataLoading]     = useState(false)
  const [dataError,       setDataError]       = useState<string | null>(null)

  const [ctxQuestion,    setCtxQuestion]    = useState<string>('')
  const [ctxSuggestions, setCtxSuggestions] = useState<string[]>([])
  const [ctxInput,       setCtxInput]       = useState<string>('')
  const [ctxLoading,     setCtxLoading]     = useState(false)
  const [ctxError,       setCtxError]       = useState<string | null>(null)
  const [ctxDone,        setCtxDone]        = useState(false)
  const [ctxDescOpen,    setCtxDescOpen]    = useState(true)

  // ── Load ──────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) { router.replace('/login'); return }

      setUserId(user.id)

      // Load contact (RLS enforced via user_id check)
      const { data: contactData } = await supabase
        .from('contacts')
        .select('id, name, initials, role, proximity, phone, email, relationship, avatar_url, sort_order, context_summary, context_description, ctx_last_question')
        .eq('id', contactId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!contactData) {
        // Contact not found or doesn't belong to this user
        router.replace('/circulo')
        return
      }

      const c = contactData as Contact
      setContact(c)

      setPhoneVal(c.phone ?? '')
      setEmailVal(c.email ?? '')
      setRelationVal(c.relationship ?? '')

      if (c.ctx_last_question) {
        setCtxQuestion(c.ctx_last_question)
        setCtxSuggestions([])
        setCtxDone(false)
      } else {
        // Generar primera pregunta dinámicamente
        fetch('/api/contact-context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id:          user.id,
            contact_id:       contactId,
            current_question: null,
            user_response:    null,
            generate_first_question: true,
          }),
        })
          .then(r => r.json())
          .then(json => {
            if (json.next_question) {
              setCtxQuestion(json.next_question)
              setCtxSuggestions(json.suggestions ?? [])
            }
          })
          .catch(() => {
            // fallback si el endpoint falla
            setCtxQuestion(`¿Quién es ${c.name} en tu vida?`)
            setCtxSuggestions([])
          })
        setCtxDone(false)
      }

      // Resolve avatar signed URL
      if (c.avatar_url) {
        const { data: signedData } = await supabase.storage
          .from('contact-avatars')
          .createSignedUrl(c.avatar_url, 3600)
        if (signedData?.signedUrl) setAvatarUrl(signedData.signedUrl)
      }

      setLoading(false)

      // Load crises in parallel (after setting loading=false for faster perceived load)
      setCrisesLoading(true)
      const { data: crisesData, error: crisesErr } = await supabase
        .from('case_contacts')
        .select('crisis:cases(id, name, status, started_at)')
        .eq('contact_id', contactId)

      setCrisesLoading(false)
      if (crisesErr) { console.error('Error loading crises:', crisesErr); return }

      const rows = (crisesData ?? []) as CrisisJoinRow[]
      const flat: CrisisRow[] = []
      for (const r of rows) {
        const cr = Array.isArray(r.crisis) ? r.crisis[0] : r.crisis
        if (cr) flat.push(cr)
      }
      setCrises(flat)
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
        method: 'POST',
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

  async function handleDataSave(field: 'phone' | 'email' | 'relationship', value: string) {
    if (!userId) return
    setDataLoading(true)
    setDataError(null)
    const { error } = await supabase
      .from('contacts')
      .update({ [field]: value.trim() || null })
      .eq('id', contactId)
      .eq('user_id', userId)
    if (error) {
      setDataLoading(false)
      setDataError('No se pudo guardar. Intentá de nuevo.')
      return
    }
    setContact((prev) => prev ? { ...prev, [field]: value.trim() || null } : null)
    setDataLoading(false)
    if (field === 'phone')        setEditingPhone(false)
    if (field === 'email')        setEditingEmail(false)
    if (field === 'relationship') setEditingRelation(false)
  }

  const handleProximityChange = useCallback(async (val: string) => {
    if (!userId) return
    setProximityLoading(true)
    setProximityError(null)
    const { error } = await supabase
      .from('contacts')
      .update({ proximity: val || null })
      .eq('id', contactId)
      .eq('user_id', userId)
    if (error) {
      setProximityLoading(false)
      setProximityError('No se pudo actualizar la cercanía. Intentá de nuevo.')
      return
    }
    setContact((prev) => prev ? { ...prev, proximity: val || null } : null)
    setProximityLoading(false)
  }, [userId, contactId])

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
      if (error.code === '23503') {
        setDeleteError('No se puede eliminar: este contacto está asignado a una o más crisis.')
      } else {
        setDeleteError('No se pudo eliminar el contacto. Intentá de nuevo.')
      }
      return
    }
    router.replace('/circulo')
  }, [userId, contactId, router])

  // ── Computed ──────────────────────────────────────────────────────────────────

  const c = contact
  const firstName = c?.name.split(' ')[0] ?? c?.name ?? ''
  const initials  = c ? (c.initials ?? initialsFrom(c.name)).slice(0, 2) : ''
  const roleKey   = c?.role ?? ''
  const roleBadge = ROLE_BADGE[roleKey] ?? { bg: 'rgba(10,126,140,0.07)', color: '#0A7E8C' }
  const roleLabel = ROLE_LABELS[roleKey] ?? '—'

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
        .contacto-bg { animation: heroBgDrift 30s ease-in-out infinite; }
      `}</style>

      <div className="contacto-bg flex min-h-screen" style={{ overflowX: 'hidden' }}>
        <Sidebar />

        <main className="flex-1 ml-0 md:ml-[240px] min-h-screen px-5 py-8 pb-28 md:px-10 md:py-10 md:pb-10" style={{ overflowX: 'hidden', minWidth: 0 }}>
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
            <span style={{ fontSize: '0.8125rem', color: '#5a7478', fontWeight: 500 }}>
              {contact?.name ?? '…'}
            </span>
          </nav>

          {/* ── Loading skeleton ──────────────────────────────────────────────── */}
          {loading && (
            <div className="flex flex-col"
              style={{ gap: 0, maxWidth: 680, margin: '0 auto' }}>

              {/* Skeleton izquierdo: hero */}
              <div className="flex-1 w-full md:w-[280px]">
                <div style={{
                  background: '#FFFFFF', borderRadius: '1.5rem',
                  boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                  padding: 32, textAlign: 'center',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                    <SkeletonAvatar size={96} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                    <SkeletonText width={160} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <SkeletonBase width={60} height={22} style={{ borderRadius: 9999 }} />
                  </div>
                </div>
              </div>

              {/* Skeleton derecho: section cards */}
              <div className="flex-1 min-w-0">
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
            </div>
          )}

          {/* ── Content ──────────────────────────────────────────────────────── */}
          {!loading && c && (
            <div className="flex flex-col"
              style={{ gap: 0, minWidth: 0, maxWidth: 680, margin: '0 auto' }}>

              {/* 1. Hero */}
              <div>

                {/* Hero sin card */}
                <div style={{ padding: '16px 0 24px', textAlign: 'center' }}>
                  {/* Avatar */}
                  <div style={{
                    width: 96, height: 96, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '1.75rem', color: 'white',
                    boxShadow: '0 8px 40px rgba(10,126,140,0.16)',
                    margin: '0 auto 14px', overflow: 'hidden',
                  }}>
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt={c.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : initials}
                  </div>

                  {/* Name */}
                  <div style={{
                    fontSize: '1.5rem', fontWeight: 800,
                    letterSpacing: '-0.02em', color: '#1A1A2E', marginBottom: 10,
                  }}>{c.name}</div>

                  {/* Role badge */}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', borderRadius: 9999,
                    padding: '3px 11px', fontSize: '0.7rem', fontWeight: 700,
                    letterSpacing: '0.05em', textTransform: 'uppercase',
                    background: roleBadge.bg, color: roleBadge.color,
                  }}>{roleLabel}</span>
                </div>

                {/* ── Módulo Lo que sé (unificado) ─────────────────────────────── */}
                <div style={{
                  background: '#FFFFFF',
                  borderRadius: '1.5rem',
                  boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                  marginBottom: 24,
                  overflow: 'hidden',
                }}>
                  {/* Header colapsable — solo visible si hay context_description */}
                  {c.context_description && (
                    <button
                      type="button"
                      onClick={() => setCtxDescOpen(prev => !prev)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        gap: 8,
                        padding: '14px 20px',
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
                        Lo que sé de {firstName}
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
                  )}

                  {/* Bloque de contexto — colapsable */}
                  {ctxDescOpen && c.context_description && (
                    <p style={{
                      fontSize: '0.8125rem',
                      color: '#5a7478',
                      lineHeight: 1.55,
                      margin: 0,
                      padding: '16px 20px',
                      borderBottom: '1px solid rgba(10,126,140,0.08)',
                      background: 'rgba(10,126,140,0.03)',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {c.context_description}
                    </p>
                  )}

                  {/* Mini-chat — siempre visible */}
                  <div style={{ padding: '16px 20px' }}>
                    {ctxDone ? (
                      <p style={{
                        fontSize: '0.8125rem', color: '#5a7478',
                        fontStyle: 'italic', margin: 0,
                      }}>
                        Por ahora ya tengo bastante contexto sobre {contact.name.split(' ')[0]}.
                        Volvé cuando quieras agregar más.
                      </p>
                    ) : (
                      <>
                        {/* Pregunta actual */}
                        <p style={{
                          fontSize: '0.875rem', fontWeight: 600,
                          color: '#1A1A2E', marginBottom: 12, marginTop: 0,
                        }}>
                          {ctxQuestion}
                        </p>

                        {/* Sugerencias */}
                        {ctxSuggestions.length > 0 && (
                          <div style={{
                            display: 'flex', flexWrap: 'wrap', gap: 8,
                            marginBottom: 12,
                          }}>
                            {ctxSuggestions.map((s, i) => (
                              <button
                                key={i}
                                onClick={() => handleCtxSubmit(s)}
                                disabled={ctxLoading}
                                style={{
                                  padding: '6px 14px',
                                  borderRadius: 9999,
                                  border: '1.5px solid rgba(10,126,140,0.25)',
                                  background: 'white',
                                  color: '#0A7E8C',
                                  fontSize: '0.8125rem',
                                  fontWeight: 600,
                                  cursor: ctxLoading ? 'not-allowed' : 'pointer',
                                  opacity: ctxLoading ? 0.5 : 1,
                                  transition: 'background 0.15s',
                                  fontFamily: 'inherit',
                                }}
                                onMouseEnter={(e) => {
                                  if (!ctxLoading)
                                    e.currentTarget.style.background = 'rgba(10,126,140,0.06)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'white'
                                }}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Input libre */}
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
                    )}
                  </div>
                </div>
                {/* ── fin módulo Lo que sé (unificado) ──────────────────────────── */}

              </div>

              <div>
              
 
              {/* 2. Datos */}
              <div style={{ marginBottom: 24 }}>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
                }}>Datos</p>

                {dataError && (
                  <div style={{
                    marginBottom: 10, padding: '8px 14px',
                    borderRadius: '0.75rem',
                    background: 'rgba(186,26,26,0.07)',
                    border: '1px solid rgba(186,26,26,0.18)',
                    fontSize: '0.8125rem', color: '#ba1a1a', fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  }}>
                    <span>{dataError}</span>
                    <button onClick={() => setDataError(null)} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#ba1a1a', fontSize: '1rem', lineHeight: 1,
                    }}>✕</button>
                  </div>
                )}

                <div style={{
                  background: '#FFFFFF', borderRadius: '1rem',
                  boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                }}>
                  {/* Teléfono */}
                  <div style={{
                    display: 'flex', alignItems: 'center',
                    padding: '13px 20px',
                    borderBottom: '1px solid rgba(10,126,140,0.12)',
                    gap: 12, minHeight: 52,
                  }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                      textTransform: 'uppercase', color: '#5a7478', minWidth: 80, flexShrink: 0,
                    }}>Teléfono</span>
                    {editingPhone ? (
                      <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="tel"
                          value={phoneVal}
                          onChange={(e) => setPhoneVal(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleDataSave('phone', phoneVal)
                            if (e.key === 'Escape') setEditingPhone(false)
                          }}
                          autoFocus
                          disabled={dataLoading}
                          style={{
                            flex: 1, border: 'none', borderBottom: '1.5px solid #0A7E8C',
                            background: 'transparent', fontSize: '0.875rem', fontWeight: 600,
                            outline: 'none', color: '#1A1A2E', fontFamily: 'inherit', padding: '2px 0',
                          }}
                        />
                        <button onClick={() => handleDataSave('phone', phoneVal)} disabled={dataLoading}
                          style={{
                            background: '#0A7E8C', color: 'white', border: 'none',
                            borderRadius: '0.5rem', padding: '4px 12px', fontSize: '0.75rem',
                            fontWeight: 700, cursor: dataLoading ? 'not-allowed' : 'pointer',
                            opacity: dataLoading ? 0.6 : 1, fontFamily: 'inherit',
                          }}>
                          {dataLoading ? '…' : 'Guardar'}
                        </button>
                        <button onClick={() => setEditingPhone(false)} disabled={dataLoading}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#5a7478', fontSize: '0.75rem', fontFamily: 'inherit',
                          }}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <>
                        <span style={{
                          fontSize: '0.875rem', fontWeight: 600, color: '#1A1A2E', flex: 1,
                        }}>{c.phone ?? '—'}</span>
                        <button onClick={() => setEditingPhone(true)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#0A7E8C', fontSize: '0.75rem', fontWeight: 600,
                            fontFamily: 'inherit',
                          }}>
                          Editar
                        </button>
                      </>
                    )}
                  </div>

                  {/* Email */}
                  <div style={{
                    display: 'flex', alignItems: 'center',
                    padding: '13px 20px',
                    borderBottom: '1px solid rgba(10,126,140,0.12)',
                    gap: 12, minHeight: 52,
                  }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                      textTransform: 'uppercase', color: '#5a7478', minWidth: 80, flexShrink: 0,
                    }}>Email</span>
                    {editingEmail ? (
                      <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="email"
                          value={emailVal}
                          onChange={(e) => setEmailVal(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleDataSave('email', emailVal)
                            if (e.key === 'Escape') setEditingEmail(false)
                          }}
                          autoFocus
                          disabled={dataLoading}
                          style={{
                            flex: 1, border: 'none', borderBottom: '1.5px solid #0A7E8C',
                            background: 'transparent', fontSize: '0.875rem', fontWeight: 600,
                            outline: 'none', color: '#1A1A2E', fontFamily: 'inherit', padding: '2px 0',
                          }}
                        />
                        <button onClick={() => handleDataSave('email', emailVal)} disabled={dataLoading}
                          style={{
                            background: '#0A7E8C', color: 'white', border: 'none',
                            borderRadius: '0.5rem', padding: '4px 12px', fontSize: '0.75rem',
                            fontWeight: 700, cursor: dataLoading ? 'not-allowed' : 'pointer',
                            opacity: dataLoading ? 0.6 : 1, fontFamily: 'inherit',
                          }}>
                          {dataLoading ? '…' : 'Guardar'}
                        </button>
                        <button onClick={() => setEditingEmail(false)} disabled={dataLoading}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#5a7478', fontSize: '0.75rem', fontFamily: 'inherit',
                          }}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <>
                        <span style={{
                          fontSize: '0.875rem', fontWeight: 600, color: '#1A1A2E', flex: 1,
                        }}>{c.email ?? '—'}</span>
                        <button onClick={() => setEditingEmail(true)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#0A7E8C', fontSize: '0.75rem', fontWeight: 600,
                            fontFamily: 'inherit',
                          }}>
                          Editar
                        </button>
                      </>
                    )}
                  </div>

                  {/* Relación */}
                  <div style={{
                    display: 'flex', alignItems: 'center',
                    padding: '13px 20px',
                    gap: 12, minHeight: 52,
                  }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                      textTransform: 'uppercase', color: '#5a7478', minWidth: 80, flexShrink: 0,
                    }}>Servicio/Profesión</span>
                    {editingRelation ? (
                      <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="text"
                          value={relationVal}
                          onChange={(e) => setRelationVal(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleDataSave('relationship', relationVal)
                            if (e.key === 'Escape') setEditingRelation(false)
                          }}
                          autoFocus
                          disabled={dataLoading}
                          placeholder="Ej: Amiga, Hermano…"
                          style={{
                            flex: 1, border: 'none', borderBottom: '1.5px solid #0A7E8C',
                            background: 'transparent', fontSize: '0.875rem', fontWeight: 600,
                            outline: 'none', color: '#1A1A2E', fontFamily: 'inherit', padding: '2px 0',
                          }}
                        />
                        <button onClick={() => handleDataSave('relationship', relationVal)} disabled={dataLoading}
                          style={{
                            background: '#0A7E8C', color: 'white', border: 'none',
                            borderRadius: '0.5rem', padding: '4px 12px', fontSize: '0.75rem',
                            fontWeight: 700, cursor: dataLoading ? 'not-allowed' : 'pointer',
                            opacity: dataLoading ? 0.6 : 1, fontFamily: 'inherit',
                          }}>
                          {dataLoading ? '…' : 'Guardar'}
                        </button>
                        <button onClick={() => setEditingRelation(false)} disabled={dataLoading}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#5a7478', fontSize: '0.75rem', fontFamily: 'inherit',
                          }}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <>
                        <span style={{
                          fontSize: '0.875rem', fontWeight: 600, color: '#1A1A2E', flex: 1,
                        }}>{c.relationship ?? '—'}</span>
                        <button onClick={() => setEditingRelation(true)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#0A7E8C', fontSize: '0.75rem', fontWeight: 600,
                            fontFamily: 'inherit',
                          }}>
                          Editar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* 5. Acciones */}
              <div style={{ marginBottom: 24 }}>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
                }}>Acciones</p>

                {/* Delete error banner */}
                {deleteError && (
                  <div style={{
                    marginBottom: 12, padding: '10px 16px',
                    borderRadius: '0.75rem',
                    background: 'rgba(186,26,26,0.07)',
                    border: '1px solid rgba(186,26,26,0.18)',
                    fontSize: '0.8125rem', color: '#ba1a1a', fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  }}>
                    <span>{deleteError}</span>
                    <button
                      onClick={() => setDeleteError(null)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#ba1a1a', fontSize: '1rem', lineHeight: 1, flexShrink: 0,
                      }}
                    >✕</button>
                  </div>
                )}

                <div style={{
                  background: '#FFFFFF', borderRadius: '1rem',
                  boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                  padding: '13px 20px',
                }}>
                  {deleteConfirm ? (
                    <div>
                      <p style={{
                        fontSize: '0.875rem', color: '#1A1A2E',
                        fontWeight: 600, marginBottom: 12,
                      }}>
                        ¿Eliminar a <strong>{firstName}</strong> del círculo?<br />
                        <span style={{ fontWeight: 400, fontSize: '0.8125rem', color: '#5a7478' }}>
                          Esta acción no se puede deshacer.
                        </span>
                      </p>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button
                          onClick={() => { setDeleteConfirm(false); setDeleteError(null) }}
                          disabled={deleteLoading}
                          style={{
                            flex: 1, padding: '9px 0',
                            background: 'rgba(10,126,140,0.07)',
                            color: '#0A7E8C', border: 'none', borderRadius: '0.6rem',
                            fontWeight: 700, fontSize: '0.875rem',
                            cursor: deleteLoading ? 'not-allowed' : 'pointer',
                            opacity: deleteLoading ? 0.5 : 1,
                          }}
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleDelete}
                          disabled={deleteLoading}
                          style={{
                            flex: 1, padding: '9px 0',
                            background: deleteLoading
                              ? 'rgba(186,26,26,0.06)' : 'rgba(186,26,26,0.10)',
                            color: '#ba1a1a', border: 'none', borderRadius: '0.6rem',
                            fontWeight: 700, fontSize: '0.875rem',
                            cursor: deleteLoading ? 'not-allowed' : 'pointer',
                            opacity: deleteLoading ? 0.6 : 1,
                            transition: 'background 0.15s',
                          }}
                        >
                          {deleteLoading ? 'Eliminando…' : 'Eliminar definitivamente'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', gap: 12,
                    }}>
                      <span style={{ fontSize: '0.875rem', color: '#5a7478', flex: 1 }}>
                        Eliminar a {firstName} del círculo
                      </span>
                      <button
                        onClick={() => setDeleteConfirm(true)}
                        style={{
                          background: 'rgba(186,26,26,0.06)', color: '#ba1a1a',
                          border: 'none', borderRadius: '0.6rem',
                          padding: '7px 16px', fontSize: '0.875rem', fontWeight: 700,
                          cursor: 'pointer', transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(186,26,26,0.14)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(186,26,26,0.06)' }}
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>
              </div>

              </div> {/* end cards column */}
            </div>
          )}
        </main>
      </div>
    </>
  )
}
