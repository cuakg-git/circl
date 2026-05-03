'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
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
  id:           string
  name:         string
  initials:     string | null
  role:         string | null
  proximity:    string | null
  phone:        string | null
  email:        string | null
  relationship: string | null
  avatar_url:   string | null
  sort_order:   number | null
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

type SSMode = null | 'view' | 'add'

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

const PROXIMITY_LABELS: Record<Proximity, string> = {
  nucleo:      'Es parte de mi núcleo',
  ayuda:       'Es alguien que me ayuda o puede ayudar',
  profesional: 'Es un proveedor de servicios o un profesional',
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
  contact, avatarUrl, onClick,
}: {
  contact:   Contact
  avatarUrl: string | null
  onClick:   () => void
}) {
  const initials = (contact.initials ?? initialsFrom(contact.name)).slice(0, 2)
  const roleColor = contact.role ? (ROLE_COLORS[contact.role] ?? '#5a7478') : '#5a7478'
  const roleLabel = contact.role ? (ROLE_LABELS[contact.role] ?? contact.role) : '—'

  return (
    <div className="person-card-slide" style={{ flex: '0 0 270px', boxSizing: 'border-box' }}>
      <div
        onClick={onClick}
        style={{
          width: 270, height: 110,
          display: 'flex', flexDirection: 'row',
          overflow: 'hidden', cursor: 'pointer',
          background: '#FFFFFF',
          borderRadius: '1.5rem',
          boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
          transition: 'box-shadow 0.22s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 40px rgba(10,126,140,0.16)' }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 24px rgba(10,126,140,0.08)' }}
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
      </div>
    </div>
  )
}

// ── Sub-component: RingCarousel ────────────────────────────────────────────────

function RingCarousel({
  ring, contacts, avatarUrls, onContactClick,
}: {
  ring:           Proximity
  contacts:       Contact[]
  avatarUrls:     Record<string, string>
  onContactClick: (c: Contact) => void
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
                  onClick={() => onContactClick(c)}
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
  contact, avatarUrl, angle, onClick,
}: {
  contact:   Contact
  avatarUrl: string | null
  angle:     number
  onClick:   () => void
}) {
  const initials = (contact.initials ?? initialsFrom(contact.name)).slice(0, 2)

  return (
    <a
      href="#"
      onClick={(e) => { e.preventDefault(); onClick() }}
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
    </a>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CirculoPage() {
  const router = useRouter()

  const [loading,     setLoading]     = useState(true)
  const [contacts,    setContacts]    = useState<Contact[]>([])
  const [avatarUrls,  setAvatarUrls]  = useState<Record<string, string>>({})
  const [userName,    setUserName]    = useState('')
  const [userAvatar,  setUserAvatar]  = useState<string | null>(null)

  // Sidesheet
  const [ssMode,          setSsMode]          = useState<SSMode>(null)
  const [ssContact,       setSsContact]       = useState<Contact | null>(null)
  const [ssCrises,        setSsCrises]        = useState<CrisisRow[]>([])
  const [ssCrisesLoading, setSsCrisesLoading] = useState(false)
  const [ssLoading,       setSsLoading]       = useState(false)
  const [ssError,         setSsError]         = useState<string | null>(null)
  const [ssDeleteConfirm, setSsDeleteConfirm] = useState(false)

  // Authenticated user id (needed for write operations)
  const [userId, setUserId] = useState<string | null>(null)

  // ADD form state
  const [addName,         setAddName]         = useState('')
  const [addPhone,        setAddPhone]        = useState('')
  const [addEmail,        setAddEmail]        = useState('')
  const [addRelation,     setAddRelation]     = useState('')
  const [addRole,         setAddRole]         = useState('acompanamiento')
  const [addProximity,    setAddProximity]    = useState<Proximity>('nucleo')
  const [addPhotoFile,    setAddPhotoFile]    = useState<File | null>(null)
  const [addPhotoPreview, setAddPhotoPreview] = useState<string | null>(null)
  const [addLoading,      setAddLoading]      = useState(false)
  const [addError,        setAddError]        = useState<string | null>(null)
  const addFileInputRef = useRef<HTMLInputElement | null>(null)

  // VIEW: photo upload state + refs
  const [ssPhotoLoading, setSsPhotoLoading] = useState(false)
  const viewPhotoInputRef = useRef<HTMLInputElement | null>(null)

  // Mobile orbit scaling
  const orbitWrapRef = useRef<HTMLDivElement | null>(null)
  const [orbitScale, setOrbitScale] = useState(1)

  // ── Load data ────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) { router.replace('/login'); return }

      setUserId(user.id)
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
        .select('id, name, initials, role, proximity, phone, email, relationship, avatar_url, sort_order')
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

      setLoading(false)
    }
    load()
  }, [router])

  // ── Group contacts by proximity ──────────────────────────────────────────────

  const groups: Record<Proximity, Contact[]> = {
    nucleo:      contacts.filter((c) => c.proximity === 'nucleo'),
    ayuda:       contacts.filter((c) => c.proximity === 'ayuda'),
    profesional: contacts.filter((c) => c.proximity === 'profesional'),
  }
  const totalContacts = contacts.length

  // ── Sidesheet handlers ───────────────────────────────────────────────────────

  const openView = useCallback(async (c: Contact) => {
    setSsContact(c)
    setSsCrises([])
    setSsMode('view')
    setSsLoading(false)
    setSsError(null)
    setSsDeleteConfirm(false)
    setSsCrisesLoading(true)
    const { data, error } = await supabase
      .from('crisis_contacts')
      .select('crisis:crises(id, name, status, started_at)')
      .eq('contact_id', c.id)
    setSsCrisesLoading(false)
    if (error) { console.error('Error loading crises for contact:', error); return }
    const rows = (data ?? []) as CrisisJoinRow[]
    const flat: CrisisRow[] = []
    for (const r of rows) {
      const cr = Array.isArray(r.crisis) ? r.crisis[0] : r.crisis
      if (cr) flat.push(cr)
    }
    setSsCrises(flat)
  }, [])

  function openAdd() {
    setAddName('')
    setAddPhone('')
    setAddEmail('')
    setAddRelation('')
    setAddRole('acompanamiento')
    setAddProximity('nucleo')
    setAddPhotoFile(null)
    setAddPhotoPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null })
    setAddError(null)
    setAddLoading(false)
    if (addFileInputRef.current) addFileInputRef.current.value = ''
    setSsMode('add')
  }

  const closeSheet = useCallback(() => {
    setSsMode(null)
    setSsContact(null)
    setSsCrises([])
    setSsLoading(false)
    setSsError(null)
    setSsDeleteConfirm(false)
    setSsPhotoLoading(false)
    setAddPhotoFile(null)
    setAddPhotoPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null })
    setAddError(null)
    setAddLoading(false)
    if (addFileInputRef.current) addFileInputRef.current.value = ''
    if (viewPhotoInputRef.current) viewPhotoInputRef.current.value = ''
  }, [])

  // ── Reload helper ─────────────────────────────────────────────────────────────

  const reloadContacts = useCallback(async (uid: string) => {
    const { data: contactsData, error: contactsErr } = await supabase
      .from('contacts')
      .select('id, name, initials, role, proximity, phone, email, relationship, avatar_url, sort_order')
      .eq('user_id', uid)
      .order('sort_order', { ascending: true, nullsFirst: false })

    if (contactsErr) console.error('Error contacts reload:', contactsErr)
    const list = (contactsData ?? []) as Contact[]
    setContacts(list)

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
    return list
  }, [])

  // ── Write handlers ────────────────────────────────────────────────────────────

  const handleRoleChange = useCallback(async (val: string) => {
    if (!ssContact || !userId) return
    setSsLoading(true)
    setSsError(null)
    const { error } = await supabase
      .from('contacts')
      .update({ role: val || null })
      .eq('id', ssContact.id)
      .eq('user_id', userId)
    if (error) {
      setSsLoading(false)
      setSsError('No se pudo actualizar el rol. Intentá de nuevo.')
      return
    }
    const updated: Contact = { ...ssContact, role: val || null }
    setSsContact(updated)
    await reloadContacts(userId)
    setSsLoading(false)
  }, [ssContact, userId, reloadContacts])

  const handleProximityChange = useCallback(async (val: string) => {
    if (!ssContact || !userId) return
    setSsLoading(true)
    setSsError(null)
    const { error } = await supabase
      .from('contacts')
      .update({ proximity: val || null })
      .eq('id', ssContact.id)
      .eq('user_id', userId)
    if (error) {
      setSsLoading(false)
      setSsError('No se pudo actualizar la cercanía. Intentá de nuevo.')
      return
    }
    const updated: Contact = { ...ssContact, proximity: val || null }
    setSsContact(updated)
    await reloadContacts(userId)
    setSsLoading(false)
  }, [ssContact, userId, reloadContacts])

  const handleDeleteContact = useCallback(async () => {
    if (!ssContact || !userId) return
    setSsLoading(true)
    setSsError(null)
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', ssContact.id)
      .eq('user_id', userId)
    setSsLoading(false)
    if (error) {
      console.error('[handleDeleteContact] error.code   :', error.code)
      console.error('[handleDeleteContact] error.message:', error.message)
      console.error('[handleDeleteContact] error.details:', (error as unknown as Record<string, unknown>).details)
      console.error('[handleDeleteContact] error.hint   :', (error as unknown as Record<string, unknown>).hint)
      setSsDeleteConfirm(false)
      if (error.code === '23503') {
        setSsError('No se puede eliminar: este contacto está asignado a una o más crisis.')
      } else {
        setSsError('No se pudo eliminar el contacto. Intentá de nuevo.')
      }
      return
    }
    closeSheet()
    await reloadContacts(userId)
  }, [ssContact, userId, reloadContacts, closeSheet])

  // ── ADD-mode handlers ─────────────────────────────────────────────────────────

  function handleAddFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setAddError('El archivo debe ser una imagen.')
      e.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setAddError('La foto no puede superar los 5 MB.')
      e.target.value = ''
      return
    }
    setAddError(null)
    setAddPhotoFile(file)
    setAddPhotoPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null })
    setAddPhotoPreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  const handleAddSubmit = useCallback(async () => {
    if (!userId) return
    setAddError(null)

    // ── Validation ────────────────────────────────────────────────────────────
    const trimmedName = addName.trim()
    if (trimmedName.length < 2) {
      setAddError('El nombre debe tener al menos 2 caracteres.')
      return
    }
    const trimmedEmail = addEmail.trim()
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setAddError('El email no parece válido.')
      return
    }

    setAddLoading(true)

    // ── Upload photo (if any) ─────────────────────────────────────────────────
    let avatarPath: string | null = null
    if (addPhotoFile) {
      const ts = Date.now()
      const safeName =
        addPhotoFile.name
          .toLowerCase()
          .replace(/[^a-z0-9._-]+/g, '_')
          .replace(/_{2,}/g, '_')
          .replace(/^_+|_+$/g, '') || 'photo'
      const path = `${userId}/${ts}_${safeName}`
      const { error: uploadErr } = await supabase.storage
        .from('contact-avatars')
        .upload(path, addPhotoFile, { contentType: addPhotoFile.type })
      if (uploadErr) {
        console.error('[handleAddSubmit] upload error:', uploadErr)
        setAddLoading(false)
        setAddError('No se pudo subir la foto. Intentá de nuevo.')
        return
      }
      avatarPath = path
    }

    // ── Calculate next sort_order ────────────────────────────────────────────
    const { data: maxRow } = await supabase
      .from('contacts')
      .select('sort_order')
      .eq('user_id', userId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const nextSortOrder = (maxRow?.sort_order ?? -1) + 1

    // ── INSERT contact ────────────────────────────────────────────────────────
    const { error: insertErr } = await supabase
      .from('contacts')
      .insert({
        user_id:        userId,
        name:           trimmedName,
        initials:       initialsFrom(trimmedName),
        phone:          addPhone.trim() || null,
        email:          trimmedEmail || null,
        relationship:   addRelation.trim() || null,
        role:           addRole,
        proximity:      addProximity,
        avatar_url:     avatarPath,
        is_institution: false,
        sort_order:     nextSortOrder,
      })

    if (insertErr) {
      console.error('[handleAddSubmit] insert.code   :', insertErr.code)
      console.error('[handleAddSubmit] insert.message:', insertErr.message)
      console.error('[handleAddSubmit] insert.details:', (insertErr as unknown as Record<string, unknown>).details)
      console.error('[handleAddSubmit] insert.hint   :', (insertErr as unknown as Record<string, unknown>).hint)
      // Roll back uploaded file so we don't leave orphans in storage.
      if (avatarPath) {
        await supabase.storage.from('contact-avatars').remove([avatarPath])
      }
      setAddLoading(false)
      setAddError('No se pudo guardar el contacto. Intentá de nuevo.')
      return
    }

    // ── Success: reload + close ───────────────────────────────────────────────
    await reloadContacts(userId)
    setAddLoading(false)
    closeSheet()
  }, [
    userId, addName, addPhone, addEmail, addRelation, addRole, addProximity,
    addPhotoFile, reloadContacts, closeSheet,
  ])

  // ── VIEW-mode photo upload ────────────────────────────────────────────────────

  function handleViewPhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setSsError('El archivo debe ser una imagen.')
      e.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setSsError('La foto no puede superar los 5 MB.')
      e.target.value = ''
      return
    }
    setSsError(null)
    // Upload immediately
    handleViewPhotoUpload(file)
    e.target.value = ''
  }

  async function handleViewPhotoUpload(file: File) {
    if (!ssContact || !userId) return
    setSsPhotoLoading(true)
    setSsError(null)

    // ── Step 1: upload to storage ──────────────────────────────────────────────
    const ts = Date.now()
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${userId}/contacts/${ssContact.id}/${ts}_avatar.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('contact-avatars')
      .upload(path, file, { upsert: true })

    if (uploadErr) {
      setSsPhotoLoading(false)
      setSsError('No se pudo subir la foto. Intentá de nuevo.')
      return
    }

    // ── Step 2: update contact with new avatar_url ─────────────────────────────
    const { error: updateErr } = await supabase
      .from('contacts')
      .update({ avatar_url: path })
      .eq('id', ssContact.id)
      .eq('user_id', userId)

    if (updateErr) {
      setSsPhotoLoading(false)
      setSsError('No se pudo guardar la foto. Intentá de nuevo.')
      return
    }

    // ── Step 3: get signed URL for preview + reload contacts ───────────────────
    const { data: signedData } = await supabase.storage
      .from('contact-avatars')
      .createSignedUrl(path, 3600)

    if (signedData?.signedUrl) {
      setSsContact((prev) => prev ? { ...prev, avatar_url: path } : null)
      setAvatarUrls((prev) => ({ ...prev, [ssContact.id]: signedData.signedUrl }))
    }

    await reloadContacts(userId)
    setSsPhotoLoading(false)
  }

  // Close sheet on Escape
  useEffect(() => {
    if (ssMode === null) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeSheet()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [ssMode, closeSheet])

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

  const isOpen = ssMode !== null

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

              {/* Right: carousel skeletons */}
              <div style={{
                flex: 1, minWidth: 0,
                display: 'flex', flexDirection: 'column', gap: 24,
                border: '1.5px dashed rgba(10,126,140,0.12)',
                padding: '40px 0 40px 40px',
                borderRadius: 20, width: '100%',
              }}>
                {[0, 1, 2].map((s) => (
                  <div key={s}>
                    <div className="flex items-center gap-2 mb-3">
                      <SkeletonText width={120} />
                      <SkeletonBase width={22} height={18} style={{ borderRadius: 9999 }} />
                    </div>
                    <div className="flex gap-3 overflow-hidden">
                      {[0, 1].map((c) => (
                        <SkeletonCard key={c} style={{
                          width: 270, height: 110, flexShrink: 0, padding: 0,
                          display: 'flex', overflow: 'hidden',
                        }}>
                          {/* Photo col */}
                          <SkeletonBase width="38%" height={110} style={{
                            borderRadius: 0, flexShrink: 0,
                          }} />
                          {/* Body col */}
                          <div className="flex-1 flex flex-col justify-center gap-2 p-3">
                            <SkeletonText width="80%" />
                            <SkeletonText width="55%" />
                            <SkeletonText width="65%" />
                          </div>
                        </SkeletonCard>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Two-column layout */}
          {!loading && <div
            className="flex flex-col md:flex-row items-center md:items-center"
            style={{ gap: 28, minHeight: 'calc(100vh - 240px)', minWidth: 0 }}
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
                  const list = groups[ring]
                  const rotatorClass =
                    ring === 'nucleo'      ? 'orbit-rotator orbit-r1'
                    : ring === 'ayuda'     ? 'orbit-rotator orbit-r2'
                    :                        'orbit-rotator orbit-r3'

                  // Empty ring → single ambient dot
                  if (list.length === 0) {
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

                  // Spread actors evenly around the ring with a per-ring offset
                  // so the three rings don't all start at the same 12-o'clock.
                  const offset = ring === 'nucleo' ? 90 : ring === 'ayuda' ? 30 : 45
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
                            onClick={() => openView(c)}
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
            </div>

            {/* ── Right: Carousels + add button ───────────────────────────── */}
            <div
              style={{
                flex: 1, minWidth: 0, overflow: 'hidden',
                display: 'flex', flexDirection: 'column', gap: 20,
                border: '1.5px dashed rgba(10,126,140,0.12)',
                padding: '40px 0 40px 40px',
                borderRadius: 20,
                width: '100%',
              }}
            >
              {!loading && totalContacts === 0 ? (
                /* Empty state global */
                <div style={{
                  border: '1.5px dashed rgba(10,126,140,0.20)',
                  borderRadius: 20, padding: '40px 24px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  textAlign: 'center', marginRight: 40,
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
                    Agregá las personas que te acompañan en esta etapa para empezar a coordinar tu red.
                  </p>
                  <button
                    onClick={openAdd}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '10px 20px', borderRadius: 9999,
                      background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                      color: 'white', border: 'none', cursor: 'pointer',
                      fontWeight: 700, fontSize: '0.875rem',
                      transition: 'filter 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.08)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)' }}
                  >
                    Agregar al círculo
                  </button>
                </div>
              ) : (
                <>
                  {RINGS.map((ring) => (
                    <RingCarousel
                      key={ring}
                      ring={ring}
                      contacts={groups[ring]}
                      avatarUrls={avatarUrls}
                      onContactClick={openView}
                    />
                  ))}

                  {/* Add button */}
                  <div>
                    <button
                      onClick={openAdd}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '8px 16px', borderRadius: 9999,
                        background: 'white', border: '1.5px solid rgba(10,126,140,0.25)',
                        color: '#0A7E8C', cursor: 'pointer',
                        fontWeight: 700, fontSize: '0.8125rem',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(10,126,140,0.04)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'white' }}
                    >
                      <IconPersonAdd />
                      Agregar al círculo
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>}  {/* end !loading */}
        </main>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          SIDESHEET
      ════════════════════════════════════════════════════════════════════ */}

      {/* Overlay */}
      <div
        onClick={closeSheet}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.22)', zIndex: 200,
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0,
          width: 420, maxWidth: '100vw', height: '100vh',
          background: '#f0f4f8', zIndex: 201,
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
          overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-6px 0 32px rgba(0,0,0,0.10)',
        }}
      >
        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 0', flexShrink: 0,
        }}>
          <span style={{
            fontSize: '0.75rem', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5a7478',
          }}>
            {ssMode === 'view' ? 'Contacto' : ssMode === 'add' ? 'Nuevo contacto' : ''}
          </span>
          <button
            onClick={closeSheet}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#5a7478', fontSize: '1rem', transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.11)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)' }}
          >
            ✕
          </button>
        </div>

        {/* ── VIEW MODE ── */}
        {ssMode === 'view' && ssContact && (() => {
          const c = ssContact
          const initials = (c.initials ?? initialsFrom(c.name)).slice(0, 2)
          const avatarUrl = avatarUrls[c.id] ?? null
          const roleKey = c.role ?? ''
          const roleBadge = ROLE_BADGE[roleKey] ?? { bg: 'rgba(10,126,140,0.07)', color: '#0A7E8C' }
          const roleLabel = ROLE_LABELS[roleKey] ?? '—'
          const firstName = c.name.split(' ')[0] ?? c.name
          return (
            <div style={{ padding: '0 24px 40px', flex: 1 }}>
              {/* Hero */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                textAlign: 'center', padding: '24px 0 20px',
                borderBottom: '1px solid rgba(10,126,140,0.12)', marginBottom: 24,
              }}>
                <div
                  onClick={() => viewPhotoInputRef.current?.click()}
                  style={{
                    position: 'relative',
                    width: 80, height: 80, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '1.5rem', color: 'white',
                    boxShadow: '0 8px 40px rgba(10,126,140,0.16)',
                    marginBottom: 14, overflow: 'hidden',
                    cursor: 'pointer', transition: 'filter 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(0.92)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)' }}
                >
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt={c.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                  ) : initials}

                  {/* Hover overlay with camera icon */}
                  <div
                    style={{
                      position: 'absolute', inset: 0, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.40)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: 0, transition: 'opacity 0.15s', pointerEvents: 'none',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '0' }}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </div>

                  {ssPhotoLoading && (
                    <div
                      style={{
                        position: 'absolute', inset: 0, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.50)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        pointerEvents: 'none',
                      }}
                    >
                      <span style={{ fontSize: '0.7rem', color: 'white', fontWeight: 700 }}>…</span>
                    </div>
                  )}

                  <input
                    ref={viewPhotoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleViewPhotoSelect}
                    disabled={ssPhotoLoading}
                    style={{ display: 'none' }}
                  />
                </div>
                <div style={{
                  fontSize: '1.5rem', fontWeight: 800,
                  letterSpacing: '-0.02em', marginBottom: 8, color: '#1A1A2E',
                }}>{c.name}</div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', borderRadius: 9999,
                  padding: '3px 11px', fontSize: '0.7rem', fontWeight: 700,
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                  background: roleBadge.bg, color: roleBadge.color,
                }}>{roleLabel}</span>
              </div>

              {/* Datos personales */}
              <div style={{ marginBottom: 24 }}>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
                }}>Datos personales</p>
                <div style={{
                  background: '#FFFFFF', borderRadius: '1rem',
                  boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                }}>
                  <SSDataRow label="Teléfono" value={c.phone ?? '—'} />
                  <SSDataRow label="Email" value={c.email ?? '—'} />
                  <SSDataRow label="Relación" value={c.relationship ?? '—'} last />
                </div>
              </div>

              {/* Inline error banner */}
              {ssError && (
                <div style={{
                  marginBottom: 16, padding: '10px 16px',
                  borderRadius: '0.75rem',
                  background: 'rgba(186,26,26,0.07)',
                  border: '1px solid rgba(186,26,26,0.18)',
                  fontSize: '0.8125rem', color: '#ba1a1a', fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                }}>
                  <span>{ssError}</span>
                  <button
                    onClick={() => setSsError(null)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#ba1a1a', fontSize: '1rem', lineHeight: 1, flexShrink: 0,
                    }}
                  >✕</button>
                </div>
              )}

              {/* Rol y cercanía */}
              <div style={{ marginBottom: 24 }}>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
                }}>Rol y cercanía</p>
                <div style={{
                  background: '#FFFFFF', borderRadius: '1rem',
                  boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                  padding: '0 20px',
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '13px 0', borderBottom: '1px solid rgba(10,126,140,0.12)', gap: 12,
                  }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                      textTransform: 'uppercase', color: '#5a7478', minWidth: 80,
                    }}>Rol</span>
                    <select
                      value={roleKey}
                      disabled={ssLoading}
                      onChange={(e) => handleRoleChange(e.target.value)}
                      style={ssLoading ? DISABLED_SELECT_STYLE : ENABLED_SELECT_STYLE}
                    >
                      <option value="acompanamiento">Acompañamiento</option>
                      <option value="logistico">Logístico</option>
                      <option value="prestador_servicios">Prestador de servicios</option>
                      <option value="">—</option>
                    </select>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '13px 0', gap: 12,
                  }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                      textTransform: 'uppercase', color: '#5a7478', minWidth: 80,
                    }}>Cercanía</span>
                    <select
                      value={c.proximity ?? ''}
                      disabled={ssLoading}
                      onChange={(e) => handleProximityChange(e.target.value)}
                      style={ssLoading ? { ...DISABLED_SELECT_STYLE, maxWidth: 260 } : { ...ENABLED_SELECT_STYLE, maxWidth: 260 }}
                    >
                      <option value="nucleo">Es parte de mi núcleo</option>
                      <option value="ayuda">Es alguien que me ayuda o puede ayudar</option>
                      <option value="profesional">Es un proveedor de servicios o un profesional</option>
                      <option value="">—</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Crisis en las que participa */}
              <div style={{ marginBottom: 24 }}>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
                }}>Crisis en las que participa</p>
                <div style={{
                  background: '#FFFFFF', borderRadius: '1rem',
                  boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                  padding: '4px 20px',
                }}>
                  {ssCrisesLoading ? (
                    <div style={{ padding: '8px 0' }}>
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="flex items-center gap-3 py-2"
                          style={{ borderBottom: i < 2 ? '1px solid rgba(10,126,140,0.08)' : 'none' }}>
                          <SkeletonBase width={10} height={10} style={{ borderRadius: '50%', flexShrink: 0 }} />
                          <SkeletonText width="65%" />
                          <SkeletonBase width={52} height={18} style={{ borderRadius: 9999, marginLeft: 'auto' }} />
                        </div>
                      ))}
                    </div>
                  ) : ssCrises.length === 0 ? (
                    <div style={{ padding: '13px 0', fontSize: '0.875rem', color: '#5a7478', fontStyle: 'italic' }}>
                      No participa en ninguna crisis.
                    </div>
                  ) : (
                    ssCrises.map((cr, i) => {
                      const isActive = cr.status === 'activa'
                      return (
                        <Link
                          key={cr.id}
                          href={`/crisis/${cr.id}`}
                          onClick={closeSheet}
                          style={{
                            textDecoration: 'none', color: 'inherit',
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '13px 0',
                            borderBottom: i < ssCrises.length - 1 ? '1px solid rgba(10,126,140,0.12)' : 'none',
                          }}
                        >
                          <div style={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: isActive ? '#2ECDA7' : '#5a7478',
                            flexShrink: 0,
                          }} />
                          <span style={{
                            fontSize: '0.875rem', fontWeight: 600, flex: 1,
                            color: '#1A1A2E',
                          }}>{cr.name}</span>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', borderRadius: 9999,
                            padding: '3px 11px', fontSize: '0.7rem', fontWeight: 700,
                            letterSpacing: '0.05em', textTransform: 'uppercase',
                            background: isActive ? 'rgba(46,205,167,0.14)' : 'rgba(90,116,120,0.10)',
                            color:      isActive ? '#0a6e5a' : '#5a7478',
                          }}>{isActive ? 'Activa' : 'Resuelta'}</span>
                          <span style={{ color: '#5a7478', display: 'flex' }}>
                            <IconArrow />
                          </span>
                        </Link>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Acciones */}
              <div>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
                }}>Acciones</p>
                <div style={{
                  background: '#FFFFFF', borderRadius: '1rem',
                  boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                  padding: '13px 20px',
                }}>
                  {ssDeleteConfirm ? (
                    /* Inline confirmation */
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
                          onClick={() => { setSsDeleteConfirm(false); setSsError(null) }}
                          disabled={ssLoading}
                          style={{
                            flex: 1, padding: '9px 0',
                            background: 'rgba(10,126,140,0.07)',
                            color: '#0A7E8C', border: 'none', borderRadius: '0.6rem',
                            fontWeight: 700, fontSize: '0.875rem',
                            cursor: ssLoading ? 'not-allowed' : 'pointer',
                            opacity: ssLoading ? 0.5 : 1,
                          }}
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleDeleteContact}
                          disabled={ssLoading}
                          style={{
                            flex: 1, padding: '9px 0',
                            background: ssLoading ? 'rgba(186,26,26,0.06)' : 'rgba(186,26,26,0.10)',
                            color: '#ba1a1a', border: 'none', borderRadius: '0.6rem',
                            fontWeight: 700, fontSize: '0.875rem',
                            cursor: ssLoading ? 'not-allowed' : 'pointer',
                            opacity: ssLoading ? 0.6 : 1,
                            transition: 'background 0.15s',
                          }}
                        >
                          {ssLoading ? 'Eliminando…' : 'Eliminar definitivamente'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Default row */
                    <div style={{
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', gap: 12,
                    }}>
                      <span style={{ fontSize: '0.875rem', color: '#5a7478', flex: 1 }}>
                        Eliminar a {firstName} del círculo
                      </span>
                      <button
                        onClick={() => setSsDeleteConfirm(true)}
                        disabled={ssLoading}
                        style={{
                          background: 'rgba(186,26,26,0.06)', color: '#ba1a1a',
                          border: 'none', borderRadius: '0.6rem',
                          padding: '7px 16px', fontSize: '0.875rem', fontWeight: 700,
                          cursor: ssLoading ? 'not-allowed' : 'pointer',
                          opacity: ssLoading ? 0.5 : 1,
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => { if (!ssLoading) e.currentTarget.style.background = 'rgba(186,26,26,0.14)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(186,26,26,0.06)' }}
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })()}

        {/* ── ADD MODE ── */}
        {ssMode === 'add' && (
          <div style={{ padding: '0 24px 40px', flex: 1 }}>
            {/* Hero w/ photo upload */}
            <div style={{
              padding: '24px 0 20px',
              borderBottom: '1px solid rgba(10,126,140,0.12)',
              marginBottom: 24, textAlign: 'center',
            }}>
              <div
                onClick={() => addFileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    addFileInputRef.current?.click()
                  }
                }}
                style={{
                  position: 'relative', width: 96, height: 96, margin: '0 auto 14px',
                  borderRadius: '50%',
                  background: addPhotoPreview ? 'transparent' : 'rgba(61,199,166,0.08)',
                  border: '2px dashed rgba(61,199,166,0.45)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', overflow: 'hidden',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(61,199,166,0.85)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(61,199,166,0.45)' }}
              >
                {addPhotoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={addPhotoPreview}
                    alt="Vista previa"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                  />
                ) : (
                  <span style={{
                    fontWeight: 800, fontSize: '1.6rem', color: 'white',
                    width: '100%', height: '100%', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none',
                  }}>
                    {addName.trim() ? initialsFrom(addName) : '+'}
                  </span>
                )}
                <input
                  ref={addFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAddFileSelect}
                  style={{ display: 'none' }}
                />
              </div>
              <div style={{ fontSize: '0.75rem', color: '#5a7478', marginBottom: 20 }}>
                {addPhotoFile
                  ? <>Foto seleccionada · <button
                      type="button"
                      onClick={() => {
                        setAddPhotoFile(null)
                        setAddPhotoPreview(null)
                        if (addFileInputRef.current) addFileInputRef.current.value = ''
                      }}
                      style={{
                        background: 'none', border: 'none', padding: 0,
                        color: '#0A7E8C', fontWeight: 700, cursor: 'pointer',
                        textDecoration: 'underline', fontSize: 'inherit',
                      }}
                    >Quitar</button></>
                  : 'Tocá para subir una foto (opcional · máx. 5 MB)'}
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#1A1A2E' }}>
                Nueva persona
              </div>
            </div>

            {/* Inline error banner */}
            {addError && (
              <div style={{
                marginBottom: 16, padding: '10px 16px',
                borderRadius: '0.75rem',
                background: 'rgba(186,26,26,0.07)',
                border: '1px solid rgba(186,26,26,0.18)',
                fontSize: '0.8125rem', color: '#ba1a1a', fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              }}>
                <span>{addError}</span>
                <button
                  onClick={() => setAddError(null)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#ba1a1a', fontSize: '1rem', lineHeight: 1, flexShrink: 0,
                  }}
                >✕</button>
              </div>
            )}

            {/* Datos personales */}
            <p style={{
              fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
            }}>Datos personales</p>
            <div style={{
              background: '#FFFFFF', borderRadius: '1rem',
              boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
              padding: '0 20px', marginBottom: 24,
            }}>
              <SSInputRow label="Nombre" value={addName} onChange={setAddName} placeholder="Nombre completo" />
              <SSInputRow label="Teléfono" value={addPhone} onChange={setAddPhone} placeholder="+54 9 11 …" type="tel" />
              <SSInputRow label="Email" value={addEmail} onChange={setAddEmail} placeholder="correo@ejemplo.com" type="email" />
              <SSInputRow label="Relación" value={addRelation} onChange={setAddRelation} placeholder="Ej: Amiga, Cuñado…" last />
            </div>

            {/* Rol */}
            <p style={{
              fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
            }}>Rol en el círculo</p>
            <div style={{
              background: '#FFFFFF', borderRadius: '1rem',
              boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
              padding: '13px 20px', marginBottom: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <span style={{
                fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                textTransform: 'uppercase', color: '#5a7478', minWidth: 80,
              }}>Rol</span>
              <select
                value={addRole}
                onChange={(e) => setAddRole(e.target.value)}
                style={{ ...ENABLED_SELECT_STYLE, maxWidth: 220 }}
              >
                <option value="acompanamiento">Acompañamiento</option>
                <option value="logistico">Logístico</option>
                <option value="prestador_servicios">Prestador de servicios</option>
              </select>
            </div>

            {/* Cercanía */}
            <p style={{
              fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
            }}>Cercanía</p>
            <div style={{
              background: '#FFFFFF', borderRadius: '1rem',
              boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
              padding: '6px 24px', marginBottom: 32,
            }}>
              {(['nucleo', 'ayuda', 'profesional'] as Proximity[]).map((p, i, arr) => {
                const description =
                  p === 'nucleo'      ? 'Primer círculo — las personas más cercanas.'
                  : p === 'ayuda'     ? 'Segundo círculo — red de apoyo cercana.'
                  :                     'Tercer círculo — vínculo profesional o de servicios.'
                return (
                  <label
                    key={p}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '12px 0',
                      borderBottom: i < arr.length - 1 ? '1px solid rgba(10,126,140,0.12)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="add-proximity"
                      value={p}
                      checked={addProximity === p}
                      onChange={() => setAddProximity(p)}
                      style={{ marginTop: 3, accentColor: '#0A7E8C' }}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1A1A2E' }}>
                        {PROXIMITY_LABELS[p]}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#5a7478', marginTop: 2 }}>
                        {description}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>

            {/* Submit */}
            <button
              onClick={handleAddSubmit}
              disabled={addLoading}
              style={{
                width: '100%', padding: '14px', borderRadius: 9999,
                border: 'none', cursor: addLoading ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: '0.875rem',
                background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                color: 'white', opacity: addLoading ? 0.7 : 1,
                transition: 'filter 0.15s',
              }}
              onMouseEnter={(e) => { if (!addLoading) e.currentTarget.style.filter = 'brightness(1.08)' }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)' }}
            >
              {addLoading ? 'Agregando…' : 'Agregar al círculo'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// ── Sidesheet helper sub-components ───────────────────────────────────────────

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

function SSInputRow({
  label, value, onChange, placeholder, type, last,
}: {
  label:        string
  value:        string
  onChange:     (v: string) => void
  placeholder?: string
  type?:        string
  last?:        boolean
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '13px 0',
      borderBottom: last ? 'none' : '1px solid rgba(10,126,140,0.12)',
      gap: 12,
    }}>
      <span style={{
        fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
        textTransform: 'uppercase', color: '#5a7478', minWidth: 80,
      }}>{label}</span>
      <input
        type={type ?? 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1, border: 'none', background: 'none',
          fontSize: '0.875rem', fontWeight: 600,
          outline: 'none', color: '#1A1A2E', fontFamily: 'inherit',
        }}
      />
    </div>
  )
}

// ── Shared select styles ──────────────────────────────────────────────────────

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

const ENABLED_SELECT_STYLE: React.CSSProperties = { ...SELECT_BASE, cursor: 'pointer' }
const DISABLED_SELECT_STYLE: React.CSSProperties = { ...SELECT_BASE, cursor: 'not-allowed', opacity: 0.65 }
