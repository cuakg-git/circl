'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────────

type Provider = {
  id:         string
  user_id:    string
  name:       string
  phone:      string | null
  email:      string | null
  prestacion: string | null
  notes:      string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function initialsFrom(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

// ── Sub-component: EditableRow ─────────────────────────────────────────────────

function EditableRow({
  label, value, editing, onEdit, onSave, onCancel, onChange,
  placeholder, type, loading, last,
}: {
  label:       string
  value:       string
  editing:     boolean
  onEdit:      () => void
  onSave:      () => void
  onCancel:    () => void
  onChange:    (v: string) => void
  placeholder?: string
  type?:       string
  loading?:    boolean
  last?:       boolean
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
        textTransform: 'uppercase', color: '#5a7478', minWidth: 80, flexShrink: 0,
      }}>{label}</span>

      {editing ? (
        <>
          <input
            type={type ?? 'text'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            autoFocus
            style={{
              flex: 1, border: 'none',
              borderBottom: '1.5px solid #0A7E8C',
              background: 'none', fontSize: '0.875rem', fontWeight: 600,
              outline: 'none', color: '#1A1A2E', fontFamily: 'inherit',
              paddingBottom: 2,
            }}
          />
          <button
            onClick={onSave}
            disabled={loading}
            style={{
              background: 'none', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              color: '#0A7E8C', fontWeight: 700, fontSize: '0.75rem',
              padding: '2px 8px', borderRadius: 6,
              opacity: loading ? 0.6 : 1, fontFamily: 'inherit',
            }}
          >{loading ? '…' : 'Guardar'}</button>
          <button
            onClick={onCancel}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#5a7478', fontWeight: 600, fontSize: '0.75rem',
              padding: '2px 6px', fontFamily: 'inherit',
            }}
          >Cancelar</button>
        </>
      ) : (
        <>
          <span style={{
            flex: 1, fontSize: '0.875rem', fontWeight: 600, color: value ? '#1A1A2E' : '#b0bec5',
          }}>
            {value || placeholder || '—'}
          </span>
          <button
            onClick={onEdit}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#0A7E8C', fontWeight: 700, fontSize: '0.75rem',
              padding: '2px 8px', borderRadius: 6, fontFamily: 'inherit',
            }}
          >Editar</button>
        </>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PrestadorDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const [userId,         setUserId]         = useState<string | null>(null)
  const [provider,       setProvider]       = useState<Provider | null>(null)
  const [loading,        setLoading]        = useState(true)

  // delete
  const [deleteConfirm,  setDeleteConfirm]  = useState(false)
  const [deleteLoading,  setDeleteLoading]  = useState(false)
  const [deleteError,    setDeleteError]    = useState<string | null>(null)

  // inline edit — prestacion
  const [editingPrest,   setEditingPrest]   = useState(false)
  const [prestVal,       setPrestVal]       = useState('')
  const [prestLoading,   setPrestLoading]   = useState(false)
  const [prestError,     setPrestError]     = useState<string | null>(null)

  // inline edit — phone
  const [editingPhone,   setEditingPhone]   = useState(false)
  const [phoneVal,       setPhoneVal]       = useState('')
  const [phoneLoading,   setPhoneLoading]   = useState(false)
  const [phoneError,     setPhoneError]     = useState<string | null>(null)

  // inline edit — email
  const [editingEmail,   setEditingEmail]   = useState(false)
  const [emailVal,       setEmailVal]       = useState('')
  const [emailLoading,   setEmailLoading]   = useState(false)
  const [emailError,     setEmailError]     = useState<string | null>(null)

  // ── Auth + load ───────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) { router.replace('/login'); return }
      setUserId(user.id)

      const { data, error } = await supabase
        .from('providers')
        .select('id, user_id, name, phone, email, prestacion, notes')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (error || !data) { router.replace('/circulo'); return }

      setProvider(data)
      setPrestVal(data.prestacion || '')
      setPhoneVal(data.phone      || '')
      setEmailVal(data.email      || '')
      setLoading(false)
    }
    if (id) init()
  }, [id, router])

  // ── Save handler ──────────────────────────────────────────────────────────────

  async function handleDataSave(field: 'phone' | 'email' | 'prestacion', value: string) {
    if (!userId || !provider) return

    const setFieldLoading = field === 'phone' ? setPhoneLoading
      : field === 'email' ? setEmailLoading : setPrestLoading
    const setFieldError   = field === 'phone' ? setPhoneError
      : field === 'email' ? setEmailError   : setPrestError
    const setEditing      = field === 'phone' ? setEditingPhone
      : field === 'email' ? setEditingEmail : setEditingPrest

    setFieldLoading(true)
    setFieldError(null)

    const { error } = await supabase
      .from('providers')
      .update({ [field]: value.trim() || null })
      .eq('id', provider.id)
      .eq('user_id', userId)

    setFieldLoading(false)

    if (error) {
      setFieldError('No se pudo guardar. Intentá de nuevo.')
      return
    }

    setProvider((prev) => prev ? { ...prev, [field]: value.trim() || null } : prev)
    setEditing(false)
  }

  // ── Delete handler ────────────────────────────────────────────────────────────

  const handleDelete = useCallback(async () => {
    if (!userId || !provider) return
    setDeleteLoading(true)
    setDeleteError(null)

    const { error } = await supabase
      .from('providers')
      .delete()
      .eq('id', provider.id)
      .eq('user_id', userId)

    if (error) {
      setDeleteError('No se pudo eliminar. Intentá de nuevo.')
      setDeleteLoading(false)
      return
    }

    router.replace('/circulo')
  }, [userId, provider, router])

  // ── Render ────────────────────────────────────────────────────────────────────

  const dataError = prestError || phoneError || emailError

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
        .prestador-detail-bg { animation: heroBgDrift 30s ease-in-out infinite; }
      `}</style>

      <div className="prestador-detail-bg flex min-h-screen">
        <Sidebar />

        <main className="flex-1 ml-0 md:ml-[240px] min-h-screen px-5 py-8 pb-28 md:px-10 md:py-10 md:pb-10">

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
              {loading ? 'Prestador' : (provider?.name ?? 'Prestador')}
            </span>
          </nav>

          {/* Content */}
          <div style={{ maxWidth: 560, margin: '0 auto' }}>

            {/* ── Skeleton ── */}
            {loading && (
              <>
                {/* Hero skeleton */}
                <div style={{ padding: '16px 0 24px', textAlign: 'center', marginBottom: 24 }}>
                  <div style={{
                    width: 96, height: 96, borderRadius: '50%', margin: '0 auto 14px',
                    background: 'rgba(10,126,140,0.10)',
                  }} />
                  <div style={{
                    width: 160, height: 24, borderRadius: 8, margin: '0 auto 8px',
                    background: 'rgba(10,126,140,0.08)',
                  }} />
                  <div style={{
                    width: 100, height: 16, borderRadius: 6, margin: '0 auto',
                    background: 'rgba(10,126,140,0.06)',
                  }} />
                </div>

                {/* Card skeleton */}
                <div style={{
                  background: '#FFFFFF', borderRadius: '1rem',
                  boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                  padding: '0 20px', marginBottom: 24,
                }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{
                      padding: '13px 0',
                      borderBottom: i < 2 ? '1px solid rgba(10,126,140,0.12)' : 'none',
                      display: 'flex', gap: 12,
                    }}>
                      <div style={{
                        width: 70, height: 14, borderRadius: 4,
                        background: 'rgba(10,126,140,0.08)',
                      }} />
                      <div style={{
                        flex: 1, height: 14, borderRadius: 4,
                        background: 'rgba(10,126,140,0.06)',
                      }} />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── Loaded ── */}
            {!loading && provider && (
              <>

                {/* Hero — no card */}
                <div style={{
                  padding: '16px 0 24px',
                  borderBottom: '1px solid rgba(10,126,140,0.12)',
                  marginBottom: 24, textAlign: 'center',
                }}>
                  <div style={{
                    width: 96, height: 96, borderRadius: '50%', margin: '0 auto 14px',
                    background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '1.6rem', color: 'white',
                  }}>
                    {initialsFrom(provider.name)}
                  </div>
                  <div style={{
                    fontSize: '1.5rem', fontWeight: 800,
                    letterSpacing: '-0.02em', color: '#1A1A2E',
                    marginBottom: provider.prestacion ? 6 : 0,
                  }}>
                    {provider.name}
                  </div>
                  {provider.prestacion && (
                    <div style={{
                      fontSize: '0.9rem', fontStyle: 'italic',
                      color: '#5a7478', fontWeight: 500,
                    }}>
                      {provider.prestacion}
                    </div>
                  )}
                </div>

                {/* Data error banner */}
                {dataError && (
                  <div style={{
                    marginBottom: 16, padding: '10px 16px',
                    borderRadius: '0.75rem',
                    background: 'rgba(186,26,26,0.07)',
                    border: '1px solid rgba(186,26,26,0.18)',
                    fontSize: '0.8125rem', color: '#ba1a1a', fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  }}>
                    <span>{dataError}</span>
                    <button
                      onClick={() => { setPrestError(null); setPhoneError(null); setEmailError(null) }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#ba1a1a', fontSize: '1rem', lineHeight: 1, flexShrink: 0,
                      }}
                    >✕</button>
                  </div>
                )}

                {/* ── Datos ── */}
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
                }}>Datos</p>
                <div style={{
                  background: '#FFFFFF', borderRadius: '1rem',
                  boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                  padding: '0 20px', marginBottom: 32,
                }}>
                  <EditableRow
                    label="Prestación"
                    value={prestVal}
                    editing={editingPrest}
                    onEdit={() => { setPrestVal(provider.prestacion || ''); setEditingPrest(true) }}
                    onSave={() => handleDataSave('prestacion', prestVal)}
                    onCancel={() => { setEditingPrest(false); setPrestVal(provider.prestacion || '') }}
                    onChange={setPrestVal}
                    placeholder="Ej: Cardiólogo, OSDE, Kinesiología…"
                    loading={prestLoading}
                  />
                  <EditableRow
                    label="Teléfono"
                    value={phoneVal}
                    editing={editingPhone}
                    onEdit={() => { setPhoneVal(provider.phone || ''); setEditingPhone(true) }}
                    onSave={() => handleDataSave('phone', phoneVal)}
                    onCancel={() => { setEditingPhone(false); setPhoneVal(provider.phone || '') }}
                    onChange={setPhoneVal}
                    placeholder="+54 9 11 …"
                    type="tel"
                    loading={phoneLoading}
                  />
                  <EditableRow
                    label="Email"
                    value={emailVal}
                    editing={editingEmail}
                    onEdit={() => { setEmailVal(provider.email || ''); setEditingEmail(true) }}
                    onSave={() => handleDataSave('email', emailVal)}
                    onCancel={() => { setEditingEmail(false); setEmailVal(provider.email || '') }}
                    onChange={setEmailVal}
                    placeholder="correo@ejemplo.com"
                    type="email"
                    loading={emailLoading}
                    last
                  />
                </div>

                {/* ── Acciones ── */}
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
                }}>Acciones</p>
                <div style={{
                  background: '#FFFFFF', borderRadius: '1rem',
                  boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                  padding: '0 20px', marginBottom: 32,
                }}>
                  {!deleteConfirm ? (
                    <div style={{
                      padding: '13px 0',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1A1A2E' }}>
                        Eliminar prestador
                      </span>
                      <button
                        onClick={() => setDeleteConfirm(true)}
                        style={{
                          background: 'none', border: '1.5px solid rgba(186,26,26,0.35)',
                          borderRadius: 8, cursor: 'pointer',
                          color: '#ba1a1a', fontWeight: 700, fontSize: '0.75rem',
                          padding: '4px 12px', fontFamily: 'inherit',
                        }}
                      >Eliminar</button>
                    </div>
                  ) : (
                    <div style={{ padding: '16px 0' }}>
                      <p style={{
                        fontSize: '0.875rem', color: '#1A1A2E', fontWeight: 600,
                        marginBottom: 12,
                      }}>
                        ¿Eliminar a <strong>{provider.name}</strong>? Esta acción no se puede deshacer.
                      </p>
                      {deleteError && (
                        <p style={{
                          fontSize: '0.8125rem', color: '#ba1a1a',
                          fontWeight: 600, marginBottom: 10,
                        }}>{deleteError}</p>
                      )}
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button
                          onClick={handleDelete}
                          disabled={deleteLoading}
                          style={{
                            flex: 1, padding: '10px', borderRadius: 9999,
                            border: 'none', cursor: deleteLoading ? 'not-allowed' : 'pointer',
                            fontWeight: 700, fontSize: '0.8125rem',
                            background: '#ba1a1a', color: 'white',
                            opacity: deleteLoading ? 0.7 : 1,
                            fontFamily: 'inherit',
                          }}
                        >{deleteLoading ? 'Eliminando…' : 'Sí, eliminar'}</button>
                        <button
                          onClick={() => { setDeleteConfirm(false); setDeleteError(null) }}
                          style={{
                            flex: 1, padding: '10px', borderRadius: 9999,
                            border: '1.5px solid rgba(10,126,140,0.25)',
                            cursor: 'pointer', background: 'white',
                            fontWeight: 700, fontSize: '0.8125rem',
                            color: '#0A7E8C', fontFamily: 'inherit',
                          }}
                        >Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>

              </>
            )}
          </div>
        </main>
      </div>
    </>
  )
}
