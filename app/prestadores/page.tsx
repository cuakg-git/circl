'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { SkeletonStyles, SkeletonCard } from '@/components/Skeleton'

// ── Types ──────────────────────────────────────────────────────────────────────

type Provider = {
  id:                string
  name:              string
  specialty:         string | null
  category:          string | null
  description:       string | null
  phone:             string | null
  email:             string | null
  website:           string | null
  avatar_url:        string | null
  zones:             string[] | null
  health_insurances: string[] | null
  featured:          boolean
  sort_order:        number
}

// ── Constants ──────────────────────────────────────────────────────────────────

const CATEGORIES      = ['Médicos', 'Psicólogos', 'Enfermería', 'Cuidadores', 'Nutrición', 'Kinesiología']
const HEALTH_INSURANCES = ['OSDE', 'Swiss Medical', 'Galeno', 'IOMA', 'Particular']
const ZONES           = ['CABA', 'GBA Norte', 'GBA Sur', 'Online']

// ── Helpers ────────────────────────────────────────────────────────────────────

function initialsFrom(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function IconPhone() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function IconMail() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  )
}

function IconStar() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="#E8913A" stroke="#E8913A"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

// ── Pill filter ────────────────────────────────────────────────────────────────

function Pill({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background:   active ? '#0A7E8C' : '#FFFFFF',
        border:       active ? '1.5px solid #0A7E8C' : '1.5px solid rgba(10,126,140,0.20)',
        borderRadius: 9999,
        padding:      '5px 14px',
        fontSize:     '0.75rem',
        fontWeight:   600,
        color:        active ? '#FFFFFF' : '#5a7478',
        cursor:       'pointer',
        fontFamily:   'inherit',
        whiteSpace:   'nowrap',
        transition:   'all 0.15s',
        flexShrink:   0,
      }}
    >
      {label}
    </button>
  )
}

// ── ProviderCard ───────────────────────────────────────────────────────────────

function ProviderCard({
  provider, saved, onSave, onContact,
}: {
  provider: Provider
  saved:    boolean
  onSave:   (id: string) => void
  onContact: (name: string) => void
}) {
  const initials = initialsFrom(provider.name)
  const insurances = provider.health_insurances ?? []
  const shown      = insurances.slice(0, 3)
  const extra      = insurances.length - shown.length

  return (
    <div style={{
      background:   '#FFFFFF',
      borderRadius: '1.5rem',
      boxShadow:    '0 4px 24px rgba(10,126,140,0.08)',
      padding:      20,
      display:      'flex',
      flexDirection: 'column',
      gap:          12,
      transition:   'box-shadow 0.2s',
    }}
    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(10,126,140,0.14)' }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 24px rgba(10,126,140,0.08)' }}
    >
      {/* Avatar + nombre */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', fontWeight: 800, color: 'white', fontSize: '1rem',
        }}>
          {provider.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={provider.avatar_url} alt={provider.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : initials}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: '0.9375rem', fontWeight: 700, color: '#1A1A2E',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{provider.name}</div>
          {provider.specialty && (
            <div style={{
              fontSize: '0.75rem', color: '#5a7478',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{provider.specialty}</div>
          )}
        </div>
      </div>

      {/* Descripción */}
      {provider.description && (
        <div style={{
          fontSize: '0.8rem', color: '#5a7478', lineHeight: 1.5,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}>{provider.description}</div>
      )}

      {/* Obras sociales */}
      {shown.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {shown.map((hi) => (
            <span key={hi} style={{
              background:   'rgba(10,126,140,0.08)',
              color:        '#0A7E8C',
              borderRadius: 9999,
              padding:      '2px 8px',
              fontSize:     '0.65rem',
              fontWeight:   700,
            }}>{hi}</span>
          ))}
          {extra > 0 && (
            <span style={{
              background:   'rgba(10,126,140,0.08)',
              color:        '#0A7E8C',
              borderRadius: 9999,
              padding:      '2px 8px',
              fontSize:     '0.65rem',
              fontWeight:   700,
            }}>+{extra}</span>
          )}
        </div>
      )}

      {/* Acciones */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto' }}>
        <button
          type="button"
          onClick={() => onContact(provider.name)}
          style={{
            flex:         1,
            padding:      '7px 0',
            background:   'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
            color:        'white',
            border:       'none',
            borderRadius: 9999,
            fontSize:     '0.75rem',
            fontWeight:   700,
            cursor:       'pointer',
            fontFamily:   'inherit',
          }}
        >
          Contactar
        </button>
        <button
          type="button"
          onClick={() => onSave(provider.id)}
          style={{
            flex:         1,
            padding:      '7px 12px',
            borderRadius: 9999,
            border:       saved ? 'none' : '1.5px solid rgba(10,126,140,0.30)',
            background:   saved ? '#0A7E8C' : '#FFFFFF',
            color:        saved ? '#FFFFFF' : '#0A7E8C',
            fontSize:     '0.75rem',
            fontWeight:   700,
            cursor:       'pointer',
            fontFamily:   'inherit',
            transition:   'all 0.15s',
          }}
        >
          {saved ? 'Guardado ✓' : 'Agregar a mi círculo'}
        </button>
      </div>
    </div>
  )
}

// ── SkeletonProviderCard ───────────────────────────────────────────────────────

function SkeletonProviderCard() {
  return (
    <SkeletonCard style={{ minHeight: 180 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
          background: 'rgba(10,126,140,0.08)',
        }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ height: 14, borderRadius: 6, background: 'rgba(10,126,140,0.08)', width: '70%' }} />
          <div style={{ height: 11, borderRadius: 6, background: 'rgba(10,126,140,0.05)', width: '50%' }} />
        </div>
      </div>
      <div style={{ height: 10, borderRadius: 6, background: 'rgba(10,126,140,0.06)', marginBottom: 6 }} />
      <div style={{ height: 10, borderRadius: 6, background: 'rgba(10,126,140,0.06)', width: '80%' }} />
    </SkeletonCard>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PrestadoresPage() {
  const router = useRouter()

  const [providers,   setProviders]   = useState<Provider[]>([])
  const [savedIds,    setSavedIds]    = useState<Set<string>>(new Set())
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore,     setHasMore]     = useState(true)
  const [nextCursor,  setNextCursor]  = useState<number | null>(null)
  const [filterCat,   setFilterCat]   = useState('')
  const [filterZone,  setFilterZone]  = useState('')
  const [filterHI,    setFilterHI]    = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [userProfile, setUserProfile] = useState<{
    name:  string
    phone: string | null
    email: string | null
  } | null>(null)
  const [contactModal, setContactModal] = useState<{
    open:         boolean
    providerName: string
    bodyInput:    string
    sent:         boolean
  }>({
    open:         false,
    providerName: '',
    bodyInput:    '',
    sent:         false,
  })

  const sentinelRef = useRef<HTMLDivElement>(null)

  function buildDefaultMessage() {
    if (!userProfile) return ''
    const contactParts = [
      userProfile.phone,
      userProfile.email,
    ].filter(Boolean).join(', ')
    const contactLine = contactParts
      ? `Mis datos de contacto son: ${contactParts}.`
      : ''
    return `Hola, mi nombre es ${userProfile.name}. Te contacto a través de Mhiru. Me gustaría obtener más información sobre tus servicios y disponibilidad. ${contactLine} Quedo a la espera de tu respuesta.`.trim()
  }

  // ── loadProviders ────────────────────────────────────────────────────────────

  const loadProviders = useCallback(async ({ reset = false } = {}) => {
    if (loadingMore && !reset) return
    if (!reset && !hasMore) return

    reset ? setLoading(true) : setLoadingMore(true)

    const params = new URLSearchParams({ limit: '12' })
    if (filterCat)  params.set('category', filterCat)
    if (filterZone) params.set('zone', filterZone)
    if (filterHI)   params.set('health_insurance', filterHI)
    if (!reset && nextCursor !== null) params.set('cursor', String(nextCursor))

    try {
      const res  = await fetch(`/api/prestadores?${params}`)
      const json = await res.json()

      setProviders(prev => reset ? (json.items ?? []) : [...prev, ...(json.items ?? [])])
      setHasMore(json.hasMore ?? false)
      setNextCursor(json.nextCursor ?? null)
    } catch (e) {
      console.error('[prestadores] loadProviders error:', e)
    }

    reset ? setLoading(false) : setLoadingMore(false)
  }, [filterCat, filterZone, filterHI, hasMore, loadingMore, nextCursor])

  // ── Init ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const { data: { session } } = await supabase.auth.getSession()
      setAccessToken(session?.access_token ?? '')

      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', user.id)
        .maybeSingle()

      setUserProfile({
        name:  profileData?.full_name ?? '',
        phone: profileData?.phone     ?? null,
        email: user.email             ?? null,
      })

      const { data: savedData, error: savedErr } = await supabase
        .from('user_provider_catalog')
        .select('provider_catalog_id')
        .eq('user_id', user.id)

      if (savedErr) console.error('[prestadores] savedIds error:', savedErr)
      setSavedIds(new Set((savedData ?? []).map((r: any) => r.provider_catalog_id)))

      await loadProviders({ reset: true })
      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Reload on filter change ──────────────────────────────────────────────────

  useEffect(() => {
    if (!loading) loadProviders({ reset: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCat, filterZone, filterHI])

  // ── Infinite scroll ──────────────────────────────────────────────────────────

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadProviders()
        }
      },
      { threshold: 0.1 }
    )
    if (sentinelRef.current) observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loading, loadProviders])

  // ── Save toggle ──────────────────────────────────────────────────────────────

  async function handleSave(providerId: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''

      const res = await fetch('/api/prestadores/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ provider_catalog_id: providerId }),
      })

      const json = await res.json()

      if (!res.ok) {
        console.error('[prestadores] save error:', json)
        return
      }

      setSavedIds(prev => {
        const next = new Set(prev)
        json.saved ? next.add(providerId) : next.delete(providerId)
        return next
      })
    } catch (err) {
      console.error('[prestadores] save fetch error:', err)
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────────

  const noFilters    = !filterCat && !filterZone && !filterHI
  const featured     = noFilters ? providers.filter((p) => p.featured) : []
  const catalog      = noFilters ? providers.filter((p) => !p.featured) : providers

  const filterLabel = (s: string) => ({
    fontSize: '0.7rem', fontWeight: 700 as const,
    letterSpacing: '0.08em', textTransform: 'uppercase' as const,
    color: '#5a7478', marginRight: 6, flexShrink: 0,
  })

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <SkeletonStyles />
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
        .prestadores-bg { animation: heroBgDrift 30s ease-in-out infinite; }
      `}</style>

      <div className="prestadores-bg flex min-h-screen">
        <Sidebar />

        <main className="flex-1 ml-0 md:ml-[240px] min-h-screen px-5 py-8 pb-28 md:px-10 md:py-10 md:pb-10 min-w-0">

          {/* Page header */}
          <div className="mb-6">
            <h1 className="text-[2rem] font-extrabold text-[#1A1A2E] tracking-[-0.03em] leading-tight">
              Prestadores
            </h1>
            <p className="mt-1.5 text-[15px] text-[#5a7478]">
              Encontrá profesionales de salud para sumar a tu círculo.
            </p>
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>

            {/* Categoría */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <span style={filterLabel('')}>Categoría</span>
              <Pill label="Todos" active={filterCat === ''} onClick={() => setFilterCat('')} />
              {CATEGORIES.map((c) => (
                <Pill key={c} label={c} active={filterCat === c}
                  onClick={() => setFilterCat(prev => prev === c ? '' : c)} />
              ))}
            </div>

            {/* Obra social */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <span style={filterLabel('')}>Obra social</span>
              <Pill label="Todas" active={filterHI === ''} onClick={() => setFilterHI('')} />
              {HEALTH_INSURANCES.map((hi) => (
                <Pill key={hi} label={hi} active={filterHI === hi}
                  onClick={() => setFilterHI(prev => prev === hi ? '' : hi)} />
              ))}
            </div>

            {/* Zona */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
              <span style={filterLabel('')}>Zona</span>
              <Pill label="Todas" active={filterZone === ''} onClick={() => setFilterZone('')} />
              {ZONES.map((z) => (
                <Pill key={z} label={z} active={filterZone === z}
                  onClick={() => setFilterZone(prev => prev === z ? '' : z)} />
              ))}
            </div>

          </div>

          {/* ── Skeleton de carga inicial ──────────────────────────────────── */}
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <SkeletonProviderCard key={i} />
              ))}
            </div>
          )}

          {!loading && (
            <>
              {/* ── Destacados ──────────────────────────────────────────────── */}
              {featured.length > 0 && (
                <div style={{ marginBottom: 36 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                    <IconStar />
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700,
                      letterSpacing: '0.12em', textTransform: 'uppercase', color: '#5a7478',
                    }}>Sugeridos</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {featured.map((p) => (
                      <ProviderCard
                        key={p.id}
                        provider={p}
                        saved={savedIds.has(p.id)}
                        onSave={handleSave}
                        onContact={(name) => setContactModal({
                          open:         true,
                          providerName: name,
                          bodyInput:    buildDefaultMessage(),
                          sent:         false,
                        })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Separador */}
              {featured.length > 0 && catalog.length > 0 && (
                <hr style={{
                  border: 'none',
                  borderTop: '1px solid rgba(10,126,140,0.10)',
                  marginBottom: 28,
                }} />
              )}

              {/* ── Catálogo ─────────────────────────────────────────────────── */}
              {catalog.length > 0 && (
                <div>
                  <p style={{
                    fontSize: '0.7rem', fontWeight: 700,
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: '#5a7478', marginBottom: 14,
                  }}>
                    {noFilters ? 'Todos los prestadores' : `${providers.length} resultado${providers.length !== 1 ? 's' : ''}`}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {catalog.map((p) => (
                      <ProviderCard
                        key={p.id}
                        provider={p}
                        saved={savedIds.has(p.id)}
                        onSave={handleSave}
                        onContact={(name) => setContactModal({
                          open:         true,
                          providerName: name,
                          bodyInput:    buildDefaultMessage(),
                          sent:         false,
                        })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {providers.length === 0 && (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  textAlign: 'center', padding: '48px 24px',
                  border: '1.5px dashed rgba(10,126,140,0.20)',
                  borderRadius: 20,
                }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: '50%',
                    background: 'rgba(10,126,140,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 16,
                  }}>
                    <IconSearch />
                  </div>
                  <h2 style={{
                    fontSize: '1.125rem', fontWeight: 700, color: '#1A1A2E',
                    marginBottom: 8,
                  }}>Sin resultados</h2>
                  <p style={{ fontSize: '0.875rem', color: '#5a7478', maxWidth: 320, lineHeight: 1.5 }}>
                    Probá con otros filtros o términos de búsqueda.
                  </p>
                </div>
              )}

              {/* ── Skeleton de carga de más ─────────────────────────────────── */}
              {loadingMore && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                  {[0, 1, 2].map((i) => <SkeletonProviderCard key={i} />)}
                </div>
              )}

              {/* Sentinel para scroll infinito */}
              <div ref={sentinelRef} style={{ height: 1 }} />
            </>
          )}

        </main>

        {/* Contact Modal */}
        {contactModal.open && (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setContactModal(prev => ({ ...prev, open: false }))}
              style={{
                position: 'fixed', inset: 0,
                background: 'rgba(0,0,0,0.40)',
                zIndex: 600,
              }}
            />
            {/* Modal */}
            <div style={{
              position:     'fixed',
              top:          '50%',
              left:         '50%',
              transform:    'translate(-50%, -50%)',
              zIndex:       601,
              width:        'min(92vw, 420px)',
              background:   '#FFFFFF',
              borderRadius: '1.5rem',
              boxShadow:    '0 24px 80px rgba(0,0,0,0.20)',
              padding:      '28px 28px 24px',
            }}>
              {contactModal.sent ? (
                /* Estado enviado — simulado */
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: 'rgba(46,205,167,0.15)',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center', margin: '0 auto 16px',
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24"
                      fill="none" stroke="#2ECDA7" strokeWidth="2.5"
                      strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <p style={{
                    fontSize: '1rem', fontWeight: 800,
                    color: '#1A1A2E', marginBottom: 8,
                  }}>
                    Mensaje listo
                  </p>
                  <p style={{
                    fontSize: '0.875rem', color: '#5a7478',
                    lineHeight: 1.6, marginBottom: 24,
                  }}>
                    Tu mensaje para {contactModal.providerName} está preparado.
                  </p>
                  <button
                    type="button"
                    onClick={() => setContactModal(prev => ({ ...prev, open: false, sent: false }))}
                    style={{
                      width: '100%', padding: '12px',
                      background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                      color: 'white', border: 'none', borderRadius: 9999,
                      fontWeight: 700, fontSize: '0.875rem',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Listo
                  </button>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div style={{
                    display: 'flex', alignItems: 'flex-start',
                    justifyContent: 'space-between', marginBottom: 16,
                  }}>
                    <div>
                      <p style={{
                        fontSize: '1rem', fontWeight: 800,
                        color: '#1A1A2E', margin: '0 0 4px',
                      }}>
                        Contactar a {contactModal.providerName}
                      </p>
                      <p style={{
                        fontSize: '0.8125rem', color: '#5a7478',
                        margin: 0, lineHeight: 1.5,
                      }}>
                        Editá el mensaje antes de enviarlo.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setContactModal(prev => ({ ...prev, open: false }))}
                      style={{
                        background: 'none', border: 'none',
                        cursor: 'pointer', color: '#5a7478',
                        fontSize: '1.2rem', lineHeight: 1,
                        padding: '0 0 0 12px', flexShrink: 0,
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Label mensaje */}
                  <p style={{
                    fontSize: '0.7rem', fontWeight: 700,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    color: '#5a7478', marginBottom: 8,
                  }}>
                    Mensaje
                  </p>

                  {/* Textarea editable */}
                  <textarea
                    value={contactModal.bodyInput}
                    onChange={(e) => setContactModal(prev => ({
                      ...prev, bodyInput: e.target.value,
                    }))}
                    rows={5}
                    style={{
                      width:        '100%',
                      padding:      '14px 16px',
                      border:       '1.5px solid rgba(10,126,140,0.20)',
                      borderRadius: '0.75rem',
                      fontSize:     '0.875rem',
                      outline:      'none',
                      color:        '#1A1A2E',
                      fontFamily:   'inherit',
                      lineHeight:   1.65,
                      resize:       'vertical',
                      background:   '#FAF8F5',
                      boxSizing:    'border-box',
                      marginBottom: 16,
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#0A7E8C' }}
                    onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(10,126,140,0.20)' }}
                  />

                  {/* Botones */}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setContactModal(prev => ({ ...prev, open: false }))}
                      style={{
                        flex:         1,
                        padding:      '11px 0',
                        background:   'rgba(10,126,140,0.07)',
                        color:        '#0A7E8C',
                        border:       'none',
                        borderRadius: 9999,
                        fontWeight:   700,
                        fontSize:     '0.875rem',
                        cursor:       'pointer',
                        fontFamily:   'inherit',
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => setContactModal(prev => ({ ...prev, sent: true }))}
                      style={{
                        flex:         1,
                        padding:      '11px 0',
                        background:   'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                        color:        'white',
                        border:       'none',
                        borderRadius: 9999,
                        fontWeight:   700,
                        fontSize:     '0.875rem',
                        cursor:       'pointer',
                        fontFamily:   'inherit',
                      }}
                    >
                      Enviar mensaje
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
