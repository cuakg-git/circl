'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import {
  SkeletonStyles, SkeletonText, SkeletonAvatar,
  SkeletonCard, SkeletonBase,
} from '@/components/Skeleton'

// ── Types ──────────────────────────────────────────────────────────────────────

type UserContext = {
  circle_summary: string | null
}

type Proximity = 'nucleo' | 'segundo_nivel' | 'tercer_nivel' | 'prestador'

type Contact = {
  id:               string
  name:             string
  initials:         string | null
  role:             string | null
  proximity:        string | null
  phone:            string | null
  email:            string | null
  relationship:     string | null
  avatar_url:       string | null
  sort_order:       number | null
  context_summary:  string | null
}


type Suggestion = {
  id?:         string
  type:        'provider' | 'chat'
  title:       string
  description: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata:    any
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

const RINGS: ('nucleo' | 'segundo' | 'tercero')[] = ['nucleo', 'segundo', 'tercero']

const RING_LABEL: Record<'nucleo' | 'segundo' | 'tercero', string> = {
  nucleo:  'Tu núcleo',
  segundo: 'Segundo nivel de cercanía',
  tercero: 'Tercer nivel de cercanía y prestadores',
}

const RING_RADIUS: Record<'nucleo' | 'segundo' | 'tercero', number> = { nucleo: 89, segundo: 144, tercero: 200 }

// Per-ring rotation (CW/CCW + duration) is hard-coded in the CSS via
// .orbit-r1 / .orbit-r2 / .orbit-r3. The inner of each actor counter-rotates
// at the same speed so avatars remain upright.

// Empty-ring ambient dot: visual placeholder when no contacts in a ring.
const DOT_CFG: Record<'nucleo' | 'segundo' | 'tercero', { size: number; speed: number; dir: 'cw' | 'ccw' }> = {
  nucleo:  { size: 8,  speed: 13, dir: 'cw'  },
  segundo: { size: 13, speed: 20, dir: 'ccw' },
  tercero: { size: 18, speed: 29, dir: 'cw'  },
}

// Match the value used in the existing Crisis page so the labels stay aligned
// with the rest of the app. The DB stores 'logistico' (no -a) and
// 'prestador_servicios'.
const ROLE_LABELS: Record<string, string> = {
  acompanamiento:      'Acompañamiento',
  logistico:           'Logístico',
  prestador_servicios: 'Prestador de servicios',
}

const ROLE_COLORS: Record<string, string> = {
  acompanamiento:      '#E8913A',
  logistico:           '#0A7E8C',
  prestador_servicios: '#5a7478',
}

// Sidesheet hero badge — same palette as Crisis page ROLE_BADGES.
const ROLE_BADGE: Record<string, { bg: string; color: string }> = {
  acompanamiento:      { bg: 'rgba(46,205,167,0.14)', color: '#0a6e5a' },
  logistico:           { bg: 'rgba(232,145,58,0.10)', color: '#b86a10' },
  prestador_servicios: { bg: 'rgba(10,126,140,0.07)', color: '#0A7E8C' },
}

const CARD_W = 270
const CARD_GAP = 12

// ── Helpers ────────────────────────────────────────────────────────────────────

function initialsFrom(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function IconPersonAdd() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0A7E8C"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8"  x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  )
}

function IconGroupAdd() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#0A7E8C"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6" />
      <path d="M22 11h-6" />
    </svg>
  )
}

function IconChevronLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

function IconChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

function IconArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5"  y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

// ── Sub-component: PersonCard ──────────────────────────────────────────────────

function PersonCard({
  contact, avatarUrl,
}: {
  contact:   Contact
  avatarUrl: string | null
}) {
  const initials = (contact.initials ?? initialsFrom(contact.name)).slice(0, 2)
  const roleColor = contact.role ? (ROLE_COLORS[contact.role] ?? '#5a7478') : '#5a7478'
  const roleLabel = contact.role ? (ROLE_LABELS[contact.role] ?? contact.role) : '—'

  return (
    <div className="person-card-slide" style={{ flex: '0 0 270px', boxSizing: 'border-box' }}>
      <Link
        href={`/circulo/${contact.id}`}
        style={{
          width: 270, height: 110,
          display: 'flex', flexDirection: 'row',
          overflow: 'hidden', cursor: 'pointer',
          background: '#FFFFFF',
          borderRadius: '1.5rem',
          boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
          transition: 'box-shadow 0.22s',
          textDecoration: 'none',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 40px rgba(10,126,140,0.16)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(10,126,140,0.08)' }}
      >
        {/* Photo (38% width) */}
        <div style={{
          flex: '0 0 38%', position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={contact.name}
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                objectFit: 'cover', display: 'block', pointerEvents: 'none',
              }}
            />
          ) : (
            <div style={{
              fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.02em',
              color: 'rgba(255,255,255,0.88)', pointerEvents: 'none',
            }}>{initials}</div>
          )}
          {/* Right-edge vignette */}
          <div style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: 24,
            background: 'linear-gradient(to right, transparent, rgba(0,0,0,0.10))',
            pointerEvents: 'none',
          }} />
        </div>

        {/* Body */}
        <div style={{
          flex: 1, minWidth: 0, overflow: 'hidden',
          padding: '10px 12px',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            fontSize: 13, fontWeight: 800, letterSpacing: '-0.015em',
            marginBottom: 1, flexShrink: 0,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            color: '#1A1A2E',
          }}>{contact.name}</div>
          <div style={{
            fontSize: 11, color: '#5a7478',
            flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{contact.relationship ?? '—'}</div>
          <hr style={{
            border: 'none', borderTop: '1px solid rgba(10,126,140,0.12)',
            margin: '7px 0', flexShrink: 0,
          }} />
          <div style={{
            fontSize: 11, color: roleColor,
            flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            marginTop: 'auto', fontWeight: 600,
          }}>{roleLabel}</div>
        </div>
      </Link>
    </div>
  )
}

// ── Sub-component: RingCarousel ────────────────────────────────────────────────

function RingCarousel({
  ring, contacts, avatarUrls,
}: {
  ring:       Proximity
  contacts:   Contact[]
  avatarUrls: Record<string, string>
}) {
  const [idx, setIdx] = useState(0)
  const [hasOverflow, setHasOverflow] = useState(false)

  const wrapRef  = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)

  // Drag (touch only — desktop relies on arrows)
  const dragActiveRef = useRef(false)
  const dragStartXRef = useRef(0)
  const dragOffsetRef = useRef(0)

  const total      = contacts.length
  const trackWidth = total * CARD_W + Math.max(0, total - 1) * CARD_GAP

  // Recompute overflow when track or wrap size changes
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    function update() {
      const w = wrap?.offsetWidth ?? 0
      setHasOverflow(total >= 2 && trackWidth > w + 1)
    }
    update()
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(update)
      ro.observe(wrap)
      return () => ro.disconnect()
    }
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [total, trackWidth])

  // Clamp idx so it never points past the last card after items shrink
  const clampedIdx = Math.max(0, Math.min(idx, Math.max(0, total - 1)))
  const translateX = -clampedIdx * (CARD_W + CARD_GAP)

  function goTo(next: number) {
    const n = Math.max(0, Math.min(total - 1, next))
    setIdx(n)
    if (trackRef.current) {
      trackRef.current.style.transition = 'transform 0.4s cubic-bezier(0.4,0,0.2,1)'
      trackRef.current.style.transform  = `translateX(${-n * (CARD_W + CARD_GAP)}px)`
    }
  }

  // Touch drag
  function onTouchStart(e: React.TouchEvent) {
    dragActiveRef.current = true
    dragStartXRef.current = e.touches[0].clientX
    dragOffsetRef.current = 0
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!dragActiveRef.current) return
    dragOffsetRef.current = e.touches[0].clientX - dragStartXRef.current
    if (trackRef.current) {
      const base = -clampedIdx * (CARD_W + CARD_GAP)
      trackRef.current.style.transition = 'none'
      trackRef.current.style.transform  = `translateX(${base + dragOffsetRef.current}px)`
    }
  }
  function onTouchEnd() {
    if (!dragActiveRef.current) return
    dragActiveRef.current = false
    if      (dragOffsetRef.current < -60) goTo(clampedIdx + 1)
    else if (dragOffsetRef.current >  60) goTo(clampedIdx - 1)
    else                                    goTo(clampedIdx)
  }

  return (
    <div style={{ minWidth: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{
          fontSize: '0.75rem', fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5a7478',
        }}>{RING_LABEL[ring as keyof typeof RING_LABEL]}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, color: 'white',
          background: '#0A7E8C', borderRadius: 9999,
          padding: '1px 7px', lineHeight: '16px',
        }}>{total}</span>
      </div>

      {total === 0 ? (
        <div style={{
          fontSize: '0.75rem', color: '#5a7478',
          padding: '10px 2px', fontStyle: 'italic',
        }}>Nadie aún en este círculo.</div>
      ) : (
        <div style={{ position: 'relative', minWidth: 0, width: '100%' }}>
          <div
            ref={wrapRef}
            style={{ position: 'relative', overflow: 'hidden', minWidth: 0, width: '100%' }}
          >
            <div
              ref={trackRef}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              style={{
                display: 'flex', gap: CARD_GAP,
                willChange: 'transform',
                transition: 'transform 0.4s cubic-bezier(0.4,0,0.2,1)',
                cursor: 'default', userSelect: 'none',
                transform: `translateX(${translateX}px)`,
              }}
            >
              {contacts.map((c) => (
                <PersonCard
                  key={c.id}
                  contact={c}
                  avatarUrl={avatarUrls[c.id] ?? null}
                />
              ))}
            </div>
          </div>

          {hasOverflow && (
            <>
              <button
                onClick={() => goTo(clampedIdx - 1)}
                disabled={clampedIdx <= 0}
                aria-label="Anterior"
                style={{
                  position: 'absolute', top: '50%', left: 2, transform: 'translateY(-50%)',
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'white', border: '1px solid rgba(10,126,140,0.12)',
                  cursor: clampedIdx <= 0 ? 'default' : 'pointer', zIndex: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#1A1A2E',
                  opacity: clampedIdx <= 0 ? 0.35 : 1,
                  transition: 'box-shadow 0.2s, background 0.15s',
                }}
              >
                <IconChevronLeft />
              </button>
              <button
                onClick={() => goTo(clampedIdx + 1)}
                disabled={clampedIdx >= total - 1}
                aria-label="Siguiente"
                style={{
                  position: 'absolute', top: '50%', right: '5%', transform: 'translateY(-50%)',
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'white', border: '1px solid rgba(10,126,140,0.12)',
                  cursor: clampedIdx >= total - 1 ? 'default' : 'pointer', zIndex: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#1A1A2E',
                  opacity: clampedIdx >= total - 1 ? 0.35 : 1,
                  transition: 'box-shadow 0.2s, background 0.15s',
                }}
              >
                <IconChevronRight />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sub-component: OrbitActor ──────────────────────────────────────────────────
//
// Sits in a `.orbit-rotator.orbit-rN` parent which provides the per-ring
// translate transform via `--a`. Inner counter-rotates to keep avatars upright.

function OrbitActor({
  contact, avatarUrl, angle,
}: {
  contact:   Contact
  avatarUrl: string | null
  angle:     number
}) {
  const initials = (contact.initials ?? initialsFrom(contact.name)).slice(0, 2)

  return (
    <Link
      href={`/circulo/${contact.id}`}
      title={contact.name}
      className="orbit-actor"
      style={{ ['--a' as string]: `${angle}deg` } as React.CSSProperties}
    >
      <div className="orbit-actor-inner">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={contact.name} />
        ) : (
          <span style={{ fontSize: '0.9rem' }}>{initials}</span>
        )}
      </div>
    </Link>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CirculoPage() {
  const router = useRouter()

  const [loading,      setLoading]      = useState(true)
  const [userCtx,      setUserCtx]      = useState<UserContext | null>(null)
  const [regenerating, setRegenerating] = useState(false)
  const [ctxOpen,      setCtxOpen]      = useState(true)
  const [ctxQuestion,    setCtxQuestion]    = useState<string | null>(null)
  const [ctxSuggestions, setCtxSuggestions] = useState<string[]>([])
  const [ctxInput,       setCtxInput]       = useState('')
  const [ctxLoading,     setCtxLoading]     = useState(false)
  const [ctxDone,        setCtxDone]        = useState(false)
  const [ctxTurn,        setCtxTurn]        = useState(1)
  const [ctxError,       setCtxError]       = useState<string | null>(null)
  const [contacts,     setContacts]     = useState<Contact[]>([])
  const [avatarUrls,  setAvatarUrls]  = useState<Record<string, string>>({})
  const [suggestions,        setSuggestions]        = useState<Suggestion[]>([])
  const [userName,    setUserName]    = useState('')
  const [userAvatar,  setUserAvatar]  = useState<string | null>(null)
  const [obrasSociales, setObrasSociales] = useState<string[]>([])
  const [addingOS,      setAddingOS]      = useState(false)
  const [newOSInput,    setNewOSInput]    = useState('')
  const [savingOS,      setSavingOS]      = useState(false)
  const [newProviderModal, setNewProviderModal] = useState<{
    open:      boolean
    name:      string
    phone:     string
    email:     string
    specialty: string
    saving:    boolean
    error:     string | null
  }>({
    open: false, name: '', phone: '', email: '',
    specialty: '', saving: false, error: null,
  })

  // Mobile orbit scaling
  const orbitWrapRef = useRef<HTMLDivElement | null>(null)
  const [orbitScale, setOrbitScale] = useState(1)

  // ── Load data ────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) { router.replace('/login'); return }

      const meta = user.user_metadata ?? {}

      // User avatar: profiles table is the source of truth, falls back to
      // user_metadata.avatar_url (matches profile/page.tsx pattern).
      const profileRes = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .maybeSingle()

      setUserName(meta.full_name ?? user.email?.split('@')[0] ?? 'Yo')
      setUserAvatar((profileRes.data?.avatar_url as string | null) ?? meta.avatar_url ?? null)

      // Contacts
      const { data: contactsData, error: contactsErr } = await supabase
        .from('contacts')
        .select('id, name, initials, role, proximity, phone, email, relationship, avatar_url, sort_order, context_summary')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true, nullsFirst: false })

      if (contactsErr) console.error('Error contacts:', contactsErr)
      const list = (contactsData ?? []) as Contact[]
      setContacts(list)

      // Resolve all contact-avatar storage paths into signed URLs in parallel
      const withAvatars = list.filter((c) => c.avatar_url)
      const entries = await Promise.all(
        withAvatars.map(async (c) => {
          const { data } = await supabase.storage
            .from('contact-avatars')
            .createSignedUrl(c.avatar_url!, 3600)
          return [c.id, data?.signedUrl ?? null] as const
        }),
      )
      const map: Record<string, string> = {}
      for (const [id, url] of entries) {
        if (url) map[id] = url
      }
      setAvatarUrls(map)

      const { data: profileData } = await supabase
        .from('profiles')
        .select('health_insurances')
        .eq('id', user.id)
        .maybeSingle()

      setObrasSociales(profileData?.health_insurances ?? [])

      // Load suggestions from Supabase
      const { data: sugData } = await supabase
        .from('suggestions')
        .select('id, type, title, description, status, metadata')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .in('type', ['provider', 'chat'])
        .order('generated_at', { ascending: false })
        .limit(6)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const loadedSuggestions = (sugData ?? []).map((s: any) => ({
        id:          s.id,
        type:        s.type as 'provider' | 'chat',
        title:       s.type === 'provider'
          ? (s.metadata?.name ?? s.title ?? '')
          : (s.title ?? ''),
        description: s.type === 'provider'
          ? (s.metadata?.razon ?? s.description ?? null)
          : (s.description ?? null),
        metadata:    s.metadata,
      }))
      setSuggestions(loadedSuggestions)

      const { data: ctxData } = await supabase
        .from('user_context')
        .select('circle_summary')
        .eq('user_id', user.id)
        .maybeSingle()
      setUserCtx(ctxData ?? null)

      setLoading(false)
    }
    load()
  }, [router])

  // ── Obras sociales ───────────────────────────────────────────────────────────

  async function handleAddOS() {
    if (!newOSInput.trim() || savingOS) return
    setSavingOS(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSavingOS(false); return }

    const updated = [...obrasSociales, newOSInput.trim()]
    const { error } = await supabase
      .from('profiles')
      .update({ health_insurances: updated })
      .eq('id', user.id)

    if (!error) {
      setObrasSociales(updated)
      setNewOSInput('')
      setAddingOS(false)
      window.dispatchEvent(new CustomEvent('mhiru:context-stale'))
    }
    setSavingOS(false)
  }

  async function handleRemoveOS(index: number) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const updated = obrasSociales.filter((_, i) => i !== index)
    const { error } = await supabase
      .from('profiles')
      .update({ health_insurances: updated })
      .eq('id', user.id)
    if (!error) {
      setObrasSociales(updated)
      window.dispatchEvent(new CustomEvent('mhiru:context-stale'))
    }
  }

  // ── Agregar prestador externo ────────────────────────────────────────────────

  async function handleAddExternalProvider() {
    if (!newProviderModal.name.trim()) {
      setNewProviderModal(prev => ({ ...prev, error: 'El nombre es obligatorio.' }))
      return
    }
    setNewProviderModal(prev => ({ ...prev, saving: true, error: null }))

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: newContact, error } = await supabase
      .from('contacts')
      .insert({
        user_id:        user.id,
        name:           newProviderModal.name.trim(),
        phone:          newProviderModal.phone.trim()     || null,
        email:          newProviderModal.email.trim()     || null,
        relationship:   newProviderModal.specialty.trim() || null,
        role:           'prestador_servicios',
        proximity:      'prestador',
        is_institution: false,
        sort_order:     0,
      })
      .select('id, name, initials, role, proximity, phone, email, relationship, avatar_url, sort_order, context_summary')
      .single()

    if (error) {
      setNewProviderModal(prev => ({ ...prev, saving: false, error: error.message }))
      return
    }

    setContacts(prev => [...prev, newContact as Contact])
    setNewProviderModal({
      open: false, name: '', phone: '', email: '',
      specialty: '', saving: false, error: null,
    })
    window.dispatchEvent(new CustomEvent('mhiru:context-stale'))
  }

  // ── Init chat "Lo que sé de tu círculo" ─────────────────────────────────────

  useEffect(() => {
    if (loading) return
    async function initChat() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const accessToken = session?.access_token ?? ''
        const res = await fetch('/api/user-context/chat/init?dimension=circle_summary', {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        })
        const json = await res.json()
        if (res.ok) {
          setCtxQuestion(json.question)
          setCtxSuggestions(json.suggestions ?? [])
        }
      } catch {
        setCtxQuestion('¿Hay alguien que esté apareciendo más en tu día a día últimamente?')
        setCtxSuggestions([
          'Sí, alguien cercano',
          'Más bien gente del trabajo',
          'Nadie en particular',
        ])
      }
    }
    initChat()
  }, [loading])

  // ── Regen event listeners ────────────────────────────────────────────────────

  useEffect(() => {
    function onRegenerating() { setRegenerating(true) }
    async function onRegenerated() {
      setRegenerating(false)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('user_context')
        .select('circle_summary')
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

  // ── Context chat submit ───────────────────────────────────────────────────────

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
          dimension:        'circle_summary',
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
        ? { ...prev, circle_summary: json.new_summary }
        : { circle_summary: json.new_summary }
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

  // ── Group contacts by proximity ──────────────────────────────────────────────

  const groups: Record<'nucleo' | 'segundo' | 'tercero', Contact[]> = {
    nucleo:  contacts.filter((c) => c.proximity === 'nucleo'),
    segundo: contacts.filter((c) => c.proximity === 'segundo_nivel'),
    tercero: contacts.filter((c) =>
      c.proximity === 'tercer_nivel' || c.proximity === 'prestador'
    ),
  }
  const totalContacts = contacts.length

  // ── Mobile orbit scale ───────────────────────────────────────────────────────
  // Match the maqueta: scale the 460×460 orbit down to fit narrow viewports.

  useEffect(() => {
    function update() {
      const el = orbitWrapRef.current
      if (!el) return
      const available = el.getBoundingClientRect().width
      const next = Math.min(1, available / 460)
      setOrbitScale(Number.isFinite(next) && next > 0 ? next : 1)
    }
    update()
    if (typeof ResizeObserver !== 'undefined' && orbitWrapRef.current) {
      const ro = new ResizeObserver(update)
      ro.observe(orbitWrapRef.current)
      return () => ro.disconnect()
    }
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* All bespoke styles — animations, orbit geometry, glow + actors. */}
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
        .circulo-bg { animation: heroBgDrift 30s ease-in-out infinite; }

        @keyframes orbit-spin-cw  { to { transform: rotate( 360deg); } }
        @keyframes orbit-spin-ccw { to { transform: rotate(-360deg); } }

        @property --gc-r { syntax: '<integer>'; inherits: false; initial-value: 61;  }
        @property --gc-g { syntax: '<integer>'; inherits: false; initial-value: 200; }
        @property --gc-b { syntax: '<integer>'; inherits: false; initial-value: 168; }

        @keyframes orbit-glow-hue {
          0%, 100% { --gc-r: 61;  --gc-g: 200; --gc-b: 168; }
          33%      { --gc-r: 159; --gc-g: 161; --gc-b: 81;  }
          66%      { --gc-r: 223; --gc-g: 120; --gc-b: 48;  }
        }

        /* Orbit stage geometry */
        .orbit-stage {
          position: relative;
          width: 460px; height: 460px;
          flex-shrink: 0; aspect-ratio: 1; overflow: hidden;
        }
        .orbit-line {
          position: absolute; top: 50%; left: 50%;
          border-radius: 50%; border: 1px solid rgba(0,0,0,0.08);
          pointer-events: none;
        }
        .orbit-line-1 { width: 178px; height: 178px; margin:  -89px 0 0  -89px; }
        .orbit-line-2 { width: 288px; height: 288px; margin: -144px 0 0 -144px; }
        .orbit-line-3 { width: 400px; height: 400px; margin: -200px 0 0 -200px; }
        .orbit-glow {
          position: absolute; top: 50%; left: 50%;
          width: 558px; height: 558px; margin: -279px 0 0 -279px;
          border-radius: 50%;
          background: conic-gradient(from 0deg,
            rgba(var(--gc-r), var(--gc-g), var(--gc-b), 0.00)   0deg,
            rgba(var(--gc-r), var(--gc-g), var(--gc-b), 0.45)  80deg,
            rgba(var(--gc-r), var(--gc-g), var(--gc-b), 0.55) 160deg,
            rgba(var(--gc-r), var(--gc-g), var(--gc-b), 0.30) 240deg,
            rgba(var(--gc-r), var(--gc-g), var(--gc-b), 0.05) 320deg,
            rgba(var(--gc-r), var(--gc-g), var(--gc-b), 0.00) 360deg
          );
          -webkit-mask: radial-gradient(circle, transparent 200px, #000 200px, #000 216px, transparent 216px);
                  mask: radial-gradient(circle, transparent 200px, #000 200px, #000 216px, transparent 216px);
          filter: blur(8px);
          animation: orbit-spin-cw 90s linear infinite, orbit-glow-hue 24s ease-in-out infinite;
          pointer-events: none;
        }

        .orbit-rotator { position: absolute; inset: 0; pointer-events: none; }
        .orbit-r1 { animation: orbit-spin-cw  80s  linear infinite; }
        .orbit-r2 { animation: orbit-spin-ccw 110s linear infinite; }
        .orbit-r3 { animation: orbit-spin-cw  140s linear infinite; }

        .orbit-actor {
          --s: 40.5px;
          position: absolute; top: 50%; left: 50%;
          width: var(--s); height: var(--s);
          margin-top:  calc(var(--s) / -2);
          margin-left: calc(var(--s) / -2);
          pointer-events: auto;
          text-decoration: none;
        }
        .orbit-r1 .orbit-actor { transform: translate(calc( 89px * sin(var(--a))), calc( -89px * cos(var(--a)))); }
        .orbit-r2 .orbit-actor { transform: translate(calc(144px * sin(var(--a))), calc(-144px * cos(var(--a)))); }
        .orbit-r3 .orbit-actor { transform: translate(calc(200px * sin(var(--a))), calc(-200px * cos(var(--a)))); }

        .orbit-actor-inner {
          width: 100%; height: 100%;
          border-radius: 50%;
          background: linear-gradient(135deg, #0A7E8C, #2ECDA7);
          border: 2px solid rgba(0,0,0,0.08);
          box-shadow: 0 6px 16px rgba(0,0,0,0.10);
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
          font-weight: 700; color: white;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .orbit-actor:hover .orbit-actor-inner {
          box-shadow: 0 0 0 3px rgba(61,199,166,0.55), 0 6px 20px rgba(0,0,0,0.16);
        }
        .orbit-actor-inner img { width: 100%; height: 100%; object-fit: cover; }
        .orbit-r1 .orbit-actor-inner { animation: orbit-spin-ccw  80s linear infinite; }
        .orbit-r2 .orbit-actor-inner { animation: orbit-spin-cw  110s linear infinite; }
        .orbit-r3 .orbit-actor-inner { animation: orbit-spin-ccw 140s linear infinite; }

        .orbit-center {
          position: absolute; top: 50%; left: 50%;
          width: 88px; height: 88px;
          margin: -44px 0 0 -44px;
          border-radius: 50%; overflow: hidden;
          border: 2px solid rgba(0,0,0,0.08);
          box-shadow: 0 8px 22px rgba(0,0,0,0.18);
          z-index: 5;
          background: linear-gradient(135deg, #0A7E8C, #2ECDA7);
          display: flex; align-items: center; justify-content: center;
          color: white; font-weight: 800; font-size: 1.5rem;
        }
        .orbit-center img { width: 100%; height: 100%; object-fit: cover; display: block; }

        /* Empty-ring ambient dot */
        .orbit-dot-wrap { position: absolute; inset: 0; pointer-events: none; }
        .orbit-dot-cw  { animation: orbit-spin-cw  var(--speed) linear infinite; }
        .orbit-dot-ccw { animation: orbit-spin-ccw var(--speed) linear infinite; }
        .orbit-dot {
          position: absolute; top: 50%; left: 50%;
          border-radius: 50%; background: #e8eae4;
          border: 1.5px solid rgba(10,126,140,0.14);
        }
        @keyframes typingDot {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40%           { transform: scale(1);   opacity: 1;   }
        }
      `}</style>

      <div className="circulo-bg flex min-h-screen" style={{ overflowX: 'hidden' }}>
        <Sidebar />

        <main className="flex-1 ml-0 md:ml-[240px] min-h-screen px-5 py-8 pb-28 md:px-10 md:py-10 md:pb-10 min-w-0" style={{ overflowX: 'hidden' }}>
          <SkeletonStyles />

          {/* Page header */}
          <div className="mb-5">
            <h1 className="text-[2rem] font-extrabold text-[#1A1A2E] tracking-[-0.03em] leading-tight">
              Tu círculo
            </h1>
            <p className="mt-1.5 text-[15px] text-[#5a7478]">
              Quienes te acompañan en esta etapa.
            </p>
          </div>

          {/* ── Loading skeleton ──────────────────────────────────────── */}
          {loading && (
            <div className="flex flex-col md:flex-row items-center md:items-start"
              style={{ gap: 28, minWidth: 0 }}>

              {/* Left: orbit stage skeleton */}
              <div className="flex-shrink-0 flex items-center justify-center w-full md:w-auto">
                <div style={{
                  position: 'relative', width: 460, height: 460, flexShrink: 0,
                }}>
                  {/* Concentric ring skeletons (no spin animation) */}
                  {[
                    { d: 178, m: 89 },
                    { d: 288, m: 144 },
                    { d: 400, m: 200 },
                  ].map(({ d, m }, i) => (
                    <SkeletonBase key={i} style={{
                      position: 'absolute', top: '50%', left: '50%',
                      width: d, height: d,
                      marginTop: -m, marginLeft: -m,
                      borderRadius: '50%',
                      background: 'none',
                      border: '1.5px solid rgba(10,126,140,0.10)',
                      animationName: 'none',
                    }} />
                  ))}
                  {/* Center circle */}
                  <SkeletonAvatar size={88} />
                  {/* A few dot placeholders on rings */}
                  {[
                    { top: '50%', left: '50%', mt: -89 - 20, ml: -20 },
                    { top: '50%', left: '50%', mt: -144 - 22, ml: 12 },
                    { top: '50%', left: '50%', mt: -200 - 26, ml: -10 },
                  ].map(({ top, left, mt, ml }, i) => (
                    <SkeletonBase key={i} style={{
                      position: 'absolute', top, left,
                      width: [40, 44, 50][i], height: [40, 44, 50][i],
                      marginTop: mt, marginLeft: ml,
                      borderRadius: '50%',
                    }} />
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* Single-column layout */}
          {!loading && <div
            className="flex flex-col items-center"
            style={{ gap: 28, minWidth: 0 }}
          >
            {/* ── Left: Orbit stage ───────────────────────────────────────── */}
            <div
              ref={orbitWrapRef}
              className="md:!w-auto flex flex-col md:!flex-row items-center justify-center w-full overflow-hidden"
              style={{ flex: '0 0 auto' }}
            >
              <div
                className="orbit-stage"
                style={{
                  transform: `scale(${orbitScale})`,
                  transformOrigin: 'top center',
                  marginBottom: orbitScale < 1 ? `calc(${orbitScale - 1} * 460px)` : 0,
                }}
              >
                <div className="orbit-glow" />
                <div className="orbit-line orbit-line-1" />
                <div className="orbit-line orbit-line-2" />
                <div className="orbit-line orbit-line-3" />

                {/* Per-ring rotator */}
                {RINGS.map((ring) => {
                  const list = groups[ring]
                  const effectiveCount = list.length

                  const rotatorClass =
                    ring === 'nucleo'      ? 'orbit-rotator orbit-r1'
                    : ring === 'segundo'   ? 'orbit-rotator orbit-r2'
                    :                        'orbit-rotator orbit-r3'

                  if (effectiveCount === 0) {
                    const cfg = DOT_CFG[ring]
                    const r   = RING_RADIUS[ring]
                    return (
                      <div
                        key={ring}
                        className={`orbit-dot-wrap ${cfg.dir === 'cw' ? 'orbit-dot-cw' : 'orbit-dot-ccw'}`}
                        style={{ ['--speed' as string]: `${cfg.speed}s` } as React.CSSProperties}
                      >
                        <div
                          className="orbit-dot"
                          style={{
                            width:      cfg.size,
                            height:     cfg.size,
                            marginTop:  -r - cfg.size / 2,
                            marginLeft: -cfg.size / 2,
                          }}
                        />
                      </div>
                    )
                  }

                  const offset = ring === 'nucleo' ? 90 : ring === 'segundo' ? 30 : 45

                  const n = list.length
                  return (
                    <div key={ring} className={rotatorClass}>
                      {list.map((c, i) => {
                        const angle = (i * 360 / n) - offset
                        return (
                          <OrbitActor
                            key={c.id}
                            contact={c}
                            avatarUrl={avatarUrls[c.id] ?? null}
                            angle={angle}
                          />
                        )
                      })}
                    </div>
                  )
                })}

                {/* Center: user avatar */}
                <div className="orbit-center">
                  {userAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={userAvatar} alt={userName} />
                  ) : (
                    <span>{userName ? initialsFrom(userName) : ''}</span>
                  )}
                </div>
              </div>

              {/* Botones — fuera del orbit-stage */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '12px 24px 0',
                  boxSizing: 'border-box',
                }}
                className="flex flex-col items-center"
              >
                <Link
                  href="/circulo/nuevo"
                  style={{
                    display: 'inline-flex', alignItems: 'center',
                    justifyContent: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 9999,
                    background: 'white',
                    border: '1.5px solid rgba(10,126,140,0.25)',
                    color: '#0A7E8C', fontWeight: 700, fontSize: '0.8rem',
                    whiteSpace: 'nowrap', textDecoration: 'none',
                    width: '100%', maxWidth: 260, boxSizing: 'border-box',
                  }}
                >
                  <IconPersonAdd />
                  + Personas
                </Link>
                <button
                  type="button"
                  onClick={() => setNewProviderModal(prev => ({
                    ...prev, open: true, name: '', phone: '',
                    email: '', specialty: '', error: null,
                  }))}
                  style={{
                    display: 'inline-flex', alignItems: 'center',
                    justifyContent: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 9999,
                    background: 'white',
                    border: '1.5px solid rgba(10,126,140,0.25)',
                    color: '#0A7E8C', fontWeight: 700, fontSize: '0.8rem',
                    whiteSpace: 'nowrap', cursor: 'pointer',
                    fontFamily: 'inherit',
                    width: '100%', maxWidth: 260, boxSizing: 'border-box',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="#0A7E8C" strokeWidth="1.8" strokeLinecap="round"
                    strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                  + Prestador externo
                </button>
                <Link
                  href="/prestadores"
                  style={{
                    display: 'inline-flex', alignItems: 'center',
                    justifyContent: 'center', gap: 6,
                    padding: '8px 16px', borderRadius: 9999,
                    background: 'white',
                    border: '1.5px solid rgba(10,126,140,0.25)',
                    color: '#0A7E8C', fontWeight: 700, fontSize: '0.8rem',
                    whiteSpace: 'nowrap', textDecoration: 'none',
                    width: '100%', maxWidth: 260, boxSizing: 'border-box',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="#0A7E8C" strokeWidth="1.8" strokeLinecap="round"
                    strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  Buscar prestador
                </Link>
              </div>
            </div>

            {/* ── Sugerencias de prestadores ─────────────────────────────── */}
            {suggestions.length > 0 && (
              <div style={{ width: '100%', maxWidth: 800, marginBottom: 8 }}>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#5a7478',
                  marginBottom: 12, marginTop: 0,
                }}>
                  Sugerencias para tu círculo
                </p>

                <div style={{
                  background: '#FFFFFF', borderRadius: '1.5rem',
                  boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                  padding: 24,
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  {suggestions.map((s, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          padding: '10px 12px',
                          background: 'rgb(255 255 255)',
                          borderRadius: '0.75rem',
                        }}
                      >
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                          background: s.type === 'chat'
                            ? 'rgba(10,126,140,0.10)'
                            : 'rgba(232,145,58,0.10)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.85rem',
                        }}>
                          {s.type === 'chat' ? '💬' : '🔗'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '0.8125rem', fontWeight: 700,
                            color: '#1A1A2E', marginBottom: 2,
                          }}>
                            {s.title}
                          </div>
                          {s.description && (
                            <div style={{
                              fontSize: '0.75rem', color: '#5a7478', lineHeight: 1.4,
                            }}>
                              {s.description}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (s.id) {
                              supabase
                                .from('suggestions')
                                .update({ status: 'dismissed' })
                                .eq('id', s.id)
                                .then(() => {})
                            }
                            setSuggestions(prev => prev.filter((_, j) => j !== i))
                          }}
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
              </div>
            )}
            {/* ── fin sugerencias ──────────────────────────────────────────── */}

            {/* ── Lo que sé del círculo (con minichat) ───────────────── */}
            <div style={{
              width: '100%',
              maxWidth: 800,
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
                  Lo que sé de tu círculo
                </span>
              </div>

              {/* Summary actual */}
              {(userCtx?.circle_summary || regenerating) && (
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
                      {userCtx!.circle_summary}
                    </p>
              )}

              {/* Minichat */}
              <div style={{ padding: '16px 24px' }}>
                  {ctxDone ? (
                    <p style={{
                      fontSize: '0.875rem', color: '#5a7478',
                      fontStyle: 'italic', margin: 0,
                    }}>
                      Ya tengo bastante contexto sobre tu círculo. Volvé cuando
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

            {/* ── Tabla de contactos ───────────────────────────────────────── */}
            {totalContacts === 0 ? (
              /* Empty state */
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                textAlign: 'center', padding: '40px 24px',
                border: '1.5px dashed rgba(10,126,140,0.20)',
                borderRadius: 20, width: '100%',
              }}>
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: 'rgba(10,126,140,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 16,
                }}>
                  <IconGroupAdd />
                </div>
                <h2 style={{
                  fontSize: '1.25rem', fontWeight: 800, color: '#1A1A2E',
                  letterSpacing: '-0.02em', marginBottom: 8,
                }}>Tu círculo está vacío</h2>
                <p style={{
                  fontSize: '0.875rem', color: '#5a7478', marginBottom: 20,
                  maxWidth: 360, lineHeight: 1.5,
                }}>
                  Agregá las personas que te acompañan en esta etapa.
                </p>
              </div>
            ) : (
              <div style={{
                width: '100%', maxWidth: 800,
                background: '#FFFFFF',
                borderRadius: '1.5rem',
                boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                overflow: 'hidden',
                padding: '0 8px',
              }}>
                <div style={{
                  padding: '14px 8px 10px',
                  borderBottom: '1px solid rgba(10,126,140,0.08)',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700,
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: '#5a7478',
                  }}>Personas</span>
                  <Link
                    href="/circulo/nuevo"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#0A7E8C', fontSize: '0.75rem', fontWeight: 700,
                      fontFamily: 'inherit', padding: '2px 8px',
                      textDecoration: 'none',
                    }}
                  >
                    + Agregar persona
                  </Link>
                </div>
                {contacts
                  .filter((c) => c.role !== 'prestador_servicios')
                  .map((c) => {
                  const avatarUrl = avatarUrls[c.id] ?? null
                  const initials = (c.initials ?? initialsFrom(c.name)).slice(0, 2)
                  const roleLabel = c.role ? (ROLE_LABELS[c.role] ?? c.role) : '—'
                  const roleBadge = ROLE_BADGE[c.role ?? ''] ?? { bg: 'rgba(10,126,140,0.07)', color: '#0A7E8C' }
                  return (
                    <Link
                      key={c.id}
                      href={`/circulo/${c.id}`}
                      style={{
                        display: 'flex', flexDirection: 'column', gap: 6,
                        padding: '14px 8px',
                        borderBottom: '1px solid rgba(10,126,140,0.08)',
                        textDecoration: 'none', color: 'inherit',
                        transition: 'background 0.15s',
                        borderRadius: 12,
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(10,126,140,0.03)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      {/* Fila superior */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {/* Avatar */}
                        <div style={{
                          width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                          background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          overflow: 'hidden', fontWeight: 700, color: 'white', fontSize: '0.9rem',
                        }}>
                          {avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={avatarUrl} alt={c.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : initials}
                        </div>

                        {/* Nombre */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '0.9375rem', fontWeight: 700,
                            color: '#1A1A2E', whiteSpace: 'nowrap',
                            overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>{c.name}</div>
                          {c.relationship && (
                            <div style={{
                              fontSize: '0.75rem', color: '#5a7478',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>{c.relationship}</div>
                          )}
                        </div>

                        {/* Arrow */}
                        <div style={{ flexShrink: 0, color: '#5a7478', display: 'flex' }}>
                          <IconArrow />
                        </div>
                      </div>

                      {/* Context summary — debajo, 2 líneas */}
                      {c.context_summary && (
                        <div style={{
                          fontSize: '0.8125rem', color: '#5a7478',
                          lineHeight: 1.5, paddingLeft: 56,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}>
                          {c.context_summary}
                        </div>
                      )}
                    </Link>
                  )
                })}
              </div>
            )}

            {/* Tabla de Prestadores */}
            {contacts.filter((c) => c.role === 'prestador_servicios').length > 0 && (
              <div style={{
                width: '100%', maxWidth: 800,
                background: '#FFFFFF',
                borderRadius: '1.5rem',
                boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                overflow: 'hidden',
                padding: '0 8px',
                marginTop: 16,
              }}>
                <div style={{
                  padding: '14px 8px 10px',
                  borderBottom: '1px solid rgba(10,126,140,0.08)',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700,
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: '#5a7478',
                  }}>Prestadores</span>
                  <button
                    type="button"
                    onClick={() => setNewProviderModal(prev => ({
                      ...prev, open: true, name: '', phone: '',
                      email: '', specialty: '', error: null,
                    }))}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#0A7E8C', fontSize: '0.75rem', fontWeight: 700,
                      fontFamily: 'inherit', padding: '2px 8px',
                    }}
                  >
                    + Agregar prestador externo
                  </button>
                </div>
                {contacts
                  .filter((c) => c.role === 'prestador_servicios')
                  .map((c) => {
                    const avatarUrl = avatarUrls[c.id] ?? null
                    const initials = (c.initials ?? initialsFrom(c.name)).slice(0, 2)
                    return (
                      <Link
                        key={c.id}
                        href={`/circulo/${c.id}`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 16,
                          padding: '14px 8px',
                          borderBottom: '1px solid rgba(10,126,140,0.08)',
                          textDecoration: 'none', color: 'inherit',
                          transition: 'background 0.15s',
                          borderRadius: 12,
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(10,126,140,0.03)' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        <div style={{
                          width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                          background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          overflow: 'hidden', fontWeight: 700, color: 'white', fontSize: '0.9rem',
                        }}>
                          {avatarUrl ? (
                            <img src={avatarUrl} alt={c.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : initials}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '0.9375rem', fontWeight: 700,
                            color: '#1A1A2E', whiteSpace: 'nowrap',
                            overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>{c.name}</div>
                          {c.relationship && (
                            <div style={{
                              fontSize: '0.75rem', color: '#5a7478',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>{c.relationship}</div>
                          )}
                        </div>
                        <div style={{ flexShrink: 0, color: '#5a7478', display: 'flex' }}>
                          <IconArrow />
                        </div>
                      </Link>
                    )
                  })}
              </div>
            )}
            {/* Card Obras Sociales */}
            <div style={{
              width: '100%', maxWidth: 800,
              background: '#FFFFFF',
              borderRadius: '1.5rem',
              boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
              overflow: 'hidden',
              padding: '0 8px',
              marginTop: 16,
            }}>
              {/* Header */}
              <div style={{
                padding: '14px 8px 10px',
                borderBottom: '1px solid rgba(10,126,140,0.08)',
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 700,
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: '#5a7478',
                }}>Obras sociales</span>
                <button
                  type="button"
                  onClick={() => { setAddingOS(true); setNewOSInput('') }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#0A7E8C', fontSize: '0.75rem', fontWeight: 700,
                    fontFamily: 'inherit', padding: '2px 8px',
                  }}
                >
                  + Agregar obra social
                </button>
              </div>

              {/* Lista de obras sociales */}
              {obrasSociales.length === 0 && !addingOS ? (
                <div style={{ padding: '16px 8px' }}>
                  <p style={{
                    fontSize: '0.875rem', color: '#5a7478',
                    fontStyle: 'italic', margin: 0,
                  }}>
                    No tenés obras sociales registradas.
                  </p>
                </div>
              ) : (
                <>
                  {obrasSociales.map((os, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 8px',
                        borderBottom: '1px solid rgba(10,126,140,0.08)',
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                        background: 'rgba(10,126,140,0.08)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                          stroke="#0A7E8C" strokeWidth="1.8"
                          strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: '0.9375rem', fontWeight: 700, color: '#1A1A2E',
                        }}>{os}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveOS(index)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: '#5a7478', padding: 4, flexShrink: 0,
                          fontSize: '1rem', lineHeight: 1,
                          transition: 'color 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#ba1a1a' }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#5a7478' }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </>
              )}

              {/* Input para agregar */}
              {addingOS && (
                <div style={{ padding: '12px 8px 16px' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="text"
                      value={newOSInput}
                      onChange={(e) => setNewOSInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddOS()
                        if (e.key === 'Escape') { setAddingOS(false); setNewOSInput('') }
                      }}
                      autoFocus
                      placeholder="Ej: OSDE 210, Swiss Medical, IOMA…"
                      style={{
                        flex: 1,
                        border: '1.5px solid rgba(10,126,140,0.20)',
                        borderRadius: '0.75rem',
                        padding: '8px 12px',
                        fontSize: '0.875rem',
                        outline: 'none',
                        color: '#1A1A2E',
                        fontFamily: 'inherit',
                        background: '#FAF8F5',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#0A7E8C' }}
                      onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(10,126,140,0.20)' }}
                    />
                    <button
                      type="button"
                      onClick={handleAddOS}
                      disabled={savingOS || !newOSInput.trim()}
                      style={{
                        padding: '8px 16px', borderRadius: 9999,
                        background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                        color: 'white', border: 'none', cursor: 'pointer',
                        fontSize: '0.8125rem', fontWeight: 700,
                        fontFamily: 'inherit',
                        opacity: (savingOS || !newOSInput.trim()) ? 0.5 : 1,
                      }}
                    >
                      {savingOS ? '…' : 'Agregar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAddingOS(false); setNewOSInput('') }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#5a7478', fontSize: '0.8125rem',
                        fontFamily: 'inherit',
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>}  {/* end !loading */}
        </main>
      </div>

      {/* Modal: Agregar prestador externo */}
      {newProviderModal.open && (
        <>
          <div
            onClick={() => !newProviderModal.saving && setNewProviderModal(prev => ({ ...prev, open: false }))}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.40)', zIndex: 600,
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
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'flex-start',
              justifyContent: 'space-between', marginBottom: 20,
            }}>
              <div>
                <p style={{
                  fontSize: '1rem', fontWeight: 800,
                  color: '#1A1A2E', margin: '0 0 4px',
                }}>
                  Agregar prestador
                </p>
                <p style={{
                  fontSize: '0.8125rem', color: '#5a7478',
                  margin: 0, lineHeight: 1.5,
                }}>
                  Agregá un profesional que no está en el catálogo de Mhiru.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNewProviderModal(prev => ({ ...prev, open: false }))}
                disabled={newProviderModal.saving}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#5a7478', fontSize: '1.2rem', lineHeight: 1,
                  padding: '0 0 0 12px', flexShrink: 0,
                }}
              >✕</button>
            </div>

            {/* Campos */}
            {[
              { key: 'name',      label: 'Nombre *',     placeholder: 'Ej: Dr. Juan Pérez',  type: 'text'  },
              { key: 'specialty', label: 'Especialidad', placeholder: 'Ej: Cardiología',      type: 'text'  },
              { key: 'phone',     label: 'Teléfono',     placeholder: '+54 11 1234-5678',     type: 'tel'   },
              { key: 'email',     label: 'Email',        placeholder: 'doctor@ejemplo.com',   type: 'email' },
            ].map(({ key, label, placeholder, type }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: '#5a7478', marginBottom: 6,
                }}>
                  {label}
                </p>
                <input
                  type={type}
                  value={(newProviderModal as any)[key]}
                  onChange={(e) => setNewProviderModal(prev => ({
                    ...prev, [key]: e.target.value, error: null,
                  }))}
                  placeholder={placeholder}
                  disabled={newProviderModal.saving}
                  style={{
                    width: '100%', padding: '10px 14px',
                    border: '1.5px solid rgba(10,126,140,0.20)',
                    borderRadius: '0.75rem', fontSize: '0.875rem',
                    outline: 'none', color: '#1A1A2E',
                    fontFamily: 'inherit', background: '#FAF8F5',
                    boxSizing: 'border-box',
                    opacity: newProviderModal.saving ? 0.6 : 1,
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#0A7E8C' }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(10,126,140,0.20)' }}
                />
              </div>
            ))}

            {/* Error */}
            {newProviderModal.error && (
              <p style={{
                fontSize: '0.8125rem', color: '#ba1a1a', fontWeight: 600,
                marginBottom: 12, padding: '8px 12px',
                background: 'rgba(186,26,26,0.07)', borderRadius: '0.5rem',
              }}>
                {newProviderModal.error}
              </p>
            )}

            {/* Botones */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setNewProviderModal(prev => ({ ...prev, open: false }))}
                disabled={newProviderModal.saving}
                style={{
                  flex: 1, padding: '11px 0',
                  background: 'rgba(10,126,140,0.07)',
                  color: '#0A7E8C', border: 'none', borderRadius: 9999,
                  fontWeight: 700, fontSize: '0.875rem',
                  cursor: 'pointer', fontFamily: 'inherit',
                  opacity: newProviderModal.saving ? 0.5 : 1,
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAddExternalProvider}
                disabled={newProviderModal.saving || !newProviderModal.name.trim()}
                style={{
                  flex: 1, padding: '11px 0',
                  background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                  color: 'white', border: 'none', borderRadius: 9999,
                  fontWeight: 700, fontSize: '0.875rem',
                  cursor: (newProviderModal.saving || !newProviderModal.name.trim())
                    ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: (newProviderModal.saving || !newProviderModal.name.trim()) ? 0.6 : 1,
                }}
              >
                {newProviderModal.saving ? 'Guardando…' : 'Agregar'}
              </button>
            </div>
          </div>
        </>
      )}

    </>
  )
}

