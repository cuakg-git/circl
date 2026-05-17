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

type Proximity = 'nucleo' | 'ayuda' | 'profesional'

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

type Provider = {
  id:         string
  name:       string
  phone:      string | null
  email:      string | null
  prestacion: string | null
  notes:      string | null
}

type Suggestion = {
  name:       string
  prestacion: string
  razon:      string
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

const RINGS: Proximity[] = ['nucleo', 'ayuda', 'profesional']

const RING_LABEL: Record<Proximity, string> = {
  nucleo:      'Tu núcleo',
  ayuda:       'Tu red de contención',
  profesional: 'Tu red de prestadores',
}

const RING_RADIUS: Record<Proximity, number> = { nucleo: 89, ayuda: 144, profesional: 200 }

// Per-ring rotation (CW/CCW + duration) is hard-coded in the CSS via
// .orbit-r1 / .orbit-r2 / .orbit-r3. The inner of each actor counter-rotates
// at the same speed so avatars remain upright.

// Empty-ring ambient dot: visual placeholder when no contacts in a ring.
const DOT_CFG: Record<Proximity, { size: number; speed: number; dir: 'cw' | 'ccw' }> = {
  nucleo:      { size: 8,  speed: 13, dir: 'cw'  },
  ayuda:       { size: 13, speed: 20, dir: 'ccw' },
  profesional: { size: 18, speed: 29, dir: 'cw'  },
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
        }}>{RING_LABEL[ring]}</span>
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

  const [loading,     setLoading]     = useState(true)
  const [contacts,    setContacts]    = useState<Contact[]>([])
  const [avatarUrls,  setAvatarUrls]  = useState<Record<string, string>>({})
  const [providers,          setProviders]          = useState<Provider[]>([])
  const [suggestions,        setSuggestions]        = useState<Suggestion[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [userName,    setUserName]    = useState('')
  const [userAvatar,  setUserAvatar]  = useState<string | null>(null)

  // Mobile orbit scaling
  const orbitWrapRef = useRef<HTMLDivElement | null>(null)
  const [orbitScale, setOrbitScale] = useState(1)

  // ── Suggestions ──────────────────────────────────────────────────────────────

  async function fetchSuggestions(user: { id: string }) {
    const cached = sessionStorage.getItem('mhiru_suggestions')
    if (cached) { setSuggestions(JSON.parse(cached)); return }

    setSuggestionsLoading(true)
    try {
      const res = await fetch('/api/suggest-providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      })
      const json = await res.json()
      if (json.suggestions?.length > 0) {
        setSuggestions(json.suggestions)
        sessionStorage.setItem('mhiru_suggestions', JSON.stringify(json.suggestions))
      }
    } catch (e) {
      console.error('[fetchSuggestions]', e)
    }
    setSuggestionsLoading(false)
  }

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

      // Providers
      const { data: providersData } = await supabase
        .from('providers')
        .select('id, name, phone, email, prestacion, notes')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      setProviders((providersData ?? []) as Provider[])

      setLoading(false)
      fetchSuggestions(user)
    }
    load()
  }, [router])

  // ── Group contacts by proximity ──────────────────────────────────────────────

  const groups: Record<Proximity, Contact[]> = {
    nucleo:      contacts.filter((c) => c.proximity === 'nucleo'),
    ayuda:       contacts.filter((c) => c.proximity === 'ayuda'),
    profesional: [],
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
      `}</style>

      <div className="circulo-bg flex min-h-screen">
        <Sidebar />

        <main className="flex-1 ml-0 md:ml-[240px] min-h-screen px-5 py-8 pb-28 md:px-10 md:py-10 md:pb-10 min-w-0">
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
              style={{
                flex: '0 0 auto', display: 'flex',
                alignItems: 'center', justifyContent: 'center', width: '100%',
              }}
              className="md:!w-auto"
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
                  const isProviderRing = ring === 'profesional'
                  const list = isProviderRing ? [] : groups[ring]
                  const providerList = isProviderRing ? providers : []
                  const effectiveCount = isProviderRing ? providerList.length : list.length

                  const rotatorClass =
                    ring === 'nucleo'      ? 'orbit-rotator orbit-r1'
                    : ring === 'ayuda'     ? 'orbit-rotator orbit-r2'
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

                  const offset = ring === 'nucleo' ? 90 : ring === 'ayuda' ? 30 : 45

                  if (isProviderRing) {
                    return (
                      <div key={ring} className={rotatorClass}>
                        {providerList.map((p, i) => {
                          const angle = (i * 360 / providerList.length) - offset
                          const initials = p.name.trim().split(/\s+/).filter(Boolean)
                            .slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
                          return (
                            <Link
                              key={p.id}
                              href={`/circulo/prestador/${p.id}`}
                              title={p.name}
                              className="orbit-actor"
                              style={{ ['--a' as string]: `${angle}deg` } as React.CSSProperties}
                            >
                              <div className="orbit-actor-inner">
                                <span style={{ fontSize: '0.9rem' }}>{initials}</span>
                              </div>
                            </Link>
                          )
                        })}
                      </div>
                    )
                  }

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

                {/* Add buttons inside orbit */}
                <div style={{
                  position: 'absolute',
                  bottom: 16,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  zIndex: 10,
                }}>
                  <Link
                    href="/circulo/nuevo"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '8px 18px', borderRadius: 9999,
                      background: 'white',
                      border: '1.5px solid rgba(10,126,140,0.25)',
                      color: '#0A7E8C',
                      fontWeight: 700, fontSize: '0.8125rem',
                      whiteSpace: 'nowrap',
                      textDecoration: 'none',
                    }}
                  >
                    <IconPersonAdd />
                    Agregar personas
                  </Link>
                  <Link
                    href="/circulo/prestador/nuevo"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '8px 18px', borderRadius: 9999,
                      background: 'white',
                      border: '1.5px solid rgba(10,126,140,0.25)',
                      color: '#0A7E8C',
                      fontWeight: 700, fontSize: '0.8125rem',
                      whiteSpace: 'nowrap',
                      textDecoration: 'none',
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                      stroke="#0A7E8C" strokeWidth="1.8" strokeLinecap="round"
                      strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <line x1="12" y1="8" x2="12" y2="16" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                    Agregar prestador
                  </Link>
                </div>
              </div>
            </div>

            {/* ── Sugerencias de prestadores ─────────────────────────────── */}
            {(suggestionsLoading || suggestions.length > 0) && (
              <div style={{ width: '100%', maxWidth: 800, marginBottom: 8 }}>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#5a7478',
                  marginBottom: 12, marginTop: 0,
                }}>
                  Sugerencias para tu círculo
                </p>

                {suggestionsLoading ? (
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {[0, 1, 2].map((i) => (
                      <div key={i} style={{
                        flex: '1 1 180px', minWidth: 160,
                        borderRadius: '1rem', height: 110,
                        background: 'linear-gradient(90deg, #f0f4f8 25%, #e8edf0 50%, #f0f4f8 75%)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 1.5s infinite',
                      }} />
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {suggestions.map((s, i) => (
                      <div
                        key={i}
                        style={{
                          flex: '1 1 180px', minWidth: 160,
                          background: '#FFFFFF', borderRadius: '1rem',
                          boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                          padding: '16px 18px',
                          display: 'flex', flexDirection: 'column', gap: 6,
                        }}
                      >
                        <div style={{
                          fontSize: '0.875rem', fontWeight: 700, color: '#1A1A2E',
                          lineHeight: 1.3,
                        }}>{s.name}</div>
                        <div style={{
                          fontSize: '0.7rem', fontWeight: 700,
                          letterSpacing: '0.06em', textTransform: 'uppercase',
                          color: '#0A7E8C',
                        }}>{s.prestacion}</div>
                        <div style={{
                          fontSize: '0.75rem', color: '#5a7478',
                          lineHeight: 1.5, flex: 1,
                        }}>{s.razon}</div>
                        <Link
                          href={`/circulo/prestador/nuevo?name=${encodeURIComponent(s.name)}&prestacion=${encodeURIComponent(s.prestacion)}`}
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            marginTop: 4, padding: '6px 14px', borderRadius: 9999,
                            background: 'rgba(10,126,140,0.08)',
                            color: '#0A7E8C', fontWeight: 700, fontSize: '0.75rem',
                            textDecoration: 'none', transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(10,126,140,0.15)' }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(10,126,140,0.08)' }}
                        >
                          + Agregar
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* ── fin sugerencias ──────────────────────────────────────────── */}

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
                }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700,
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: '#5a7478',
                  }}>Personas</span>
                </div>
                {contacts.map((c) => {
                  const avatarUrl = avatarUrls[c.id] ?? null
                  const initials = (c.initials ?? initialsFrom(c.name)).slice(0, 2)
                  const roleLabel = c.role ? (ROLE_LABELS[c.role] ?? c.role) : '—'
                  const roleBadge = ROLE_BADGE[c.role ?? ''] ?? { bg: 'rgba(10,126,140,0.07)', color: '#0A7E8C' }
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
                      <div style={{ flex: '0 0 160px', minWidth: 0 }}>
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
 

                      {/* Context summary */}
                      <div style={{
                        flex: 1, minWidth: 0,
                        fontSize: '0.8125rem', color: '#5a7478',
                        lineHeight: 1.5,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}>
                        {c.context_summary ?? '—'}
                      </div>

                      {/* Arrow */}
                      <div style={{ flexShrink: 0, color: '#5a7478', display: 'flex' }}>
                        <IconArrow />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}

            {/* Tabla de providers */}
            {providers.length > 0 && (
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
                }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700,
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: '#5a7478',
                  }}>Prestadores</span>
                </div>
                {providers.map((p) => {
                  const initials = p.name.trim().split(/\s+/).filter(Boolean)
                    .slice(0, 2).map((w) => w[0]).join('').toUpperCase()
                  return (
                    <Link
                      key={p.id}
                      href={`/circulo/prestador/${p.id}`}
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
                      {/* Avatar */}
                      <div style={{
                        width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                        background: 'linear-gradient(135deg, #5a7478, #8a9fa3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, color: 'white', fontSize: '0.9rem',
                      }}>
                        {initials}
                      </div>

                      {/* Nombre + prestación */}
                      <div style={{ flex: '0 0 200px', minWidth: 0 }}>
                        <div style={{
                          fontSize: '0.9375rem', fontWeight: 700,
                          color: '#1A1A2E', whiteSpace: 'nowrap',
                          overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>{p.name}</div>
                        {p.prestacion && (
                          <div style={{
                            fontSize: '0.75rem', color: '#5a7478',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}>{p.prestacion}</div>
                        )}
                      </div>

                      {/* Contacto */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '0.8125rem', color: '#5a7478',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {p.phone ?? p.email ?? '—'}
                        </div>
                      </div>

                      {/* Arrow */}
                      <div style={{ flexShrink: 0, color: '#5a7478', display: 'flex' }}>
                        <IconArrow />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>}  {/* end !loading */}
        </main>
      </div>

    </>
  )
}

