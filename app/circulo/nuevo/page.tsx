'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────────

type Proximity = 'nucleo' | 'ayuda'

// ── Constants ──────────────────────────────────────────────────────────────────

const PROXIMITY_LABELS: Record<Proximity, string> = {
  nucleo: 'Es parte de mi núcleo',
  ayuda:  'Es alguien que me ayuda o puede ayudar',
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

const ENABLED_SELECT_STYLE: React.CSSProperties = { ...SELECT_BASE, cursor: 'pointer' }

// ── Helper ─────────────────────────────────────────────────────────────────────

function initialsFrom(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

// ── Sub-component: SSInputRow ──────────────────────────────────────────────────

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

// ── Page ───────────────────────────────────────────────────────────────────────

export default function NuevoContactoPage() {
  const router = useRouter()

  const [userId,          setUserId]          = useState<string | null>(null)
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

  // ── Auth ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) { router.replace('/login'); return }
      setUserId(user.id)
    }
    init()
  }, [router])

  // ── Handlers ─────────────────────────────────────────────────────────────────

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
    const { data: insertedContact, error: insertErr } = await supabase
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
      .select('id')
      .single()

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

    window.dispatchEvent(new CustomEvent('mhiru:context-stale'))
    router.replace(`/circulo/${insertedContact.id}`)
  }, [
    userId, addName, addPhone, addEmail, addRelation, addRole, addProximity,
    addPhotoFile, router,
  ])

  // ── Render ───────────────────────────────────────────────────────────────────

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
        .nuevo-bg { animation: heroBgDrift 30s ease-in-out infinite; }
      `}</style>

      <div className="nuevo-bg flex min-h-screen">
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
              Nueva persona
            </span>
          </nav>

          {/* Formulario centrado */}
          <div style={{ maxWidth: 480, margin: '0 auto' }}>

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
              <SSInputRow label="Nombre"   value={addName}     onChange={setAddName}     placeholder="Nombre completo" />
              <SSInputRow label="Teléfono" value={addPhone}    onChange={setAddPhone}    placeholder="+54 9 11 …" type="tel" />
              <SSInputRow label="Email"    value={addEmail}    onChange={setAddEmail}    placeholder="correo@ejemplo.com" type="email" />
              <SSInputRow label="Relación" value={addRelation} onChange={setAddRelation} placeholder="Ej: Amiga, Cuñado…" last />
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
              {(['nucleo', 'ayuda'] as Proximity[]).map((p, i, arr) => {
                const description =
                  p === 'nucleo'  ? 'Primer círculo — las personas más cercanas.'
                  :                 'Segundo círculo — red de apoyo cercana.'
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
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => { if (!addLoading) e.currentTarget.style.filter = 'brightness(1.08)' }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)' }}
            >
              {addLoading ? 'Agregando…' : 'Agregar al círculo'}
            </button>

          </div>
        </main>
      </div>
    </>
  )
}
