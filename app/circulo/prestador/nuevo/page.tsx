'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'

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

export default function NuevoPrestadorPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [userId,     setUserId]     = useState<string | null>(null)
  const [name,       setName]       = useState('')
  const [phone,      setPhone]      = useState('')
  const [email,      setEmail]      = useState('')
  const [prestacion, setPrestacion] = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  // ── Auth ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) { router.replace('/login'); return }
      setUserId(user.id)
      const nameParam = searchParams.get('name')
      const prestacionParam = searchParams.get('prestacion')
      if (nameParam) setName(nameParam)
      if (prestacionParam) setPrestacion(prestacionParam)
    }
    init()
  }, [router, searchParams])

  // ── Handler ───────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!userId) return
    setError(null)

    const trimmedName = name.trim()
    if (trimmedName.length < 2) {
      setError('El nombre debe tener al menos 2 caracteres.')
      return
    }
    const trimmedEmail = email.trim()
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('El email no parece válido.')
      return
    }

    setLoading(true)

    const { data: inserted, error: insertErr } = await supabase
      .from('providers')
      .insert({
        user_id:    userId,
        name:       trimmedName,
        phone:      phone.trim() || null,
        email:      trimmedEmail || null,
        prestacion: prestacion.trim() || null,
      })
      .select('id')
      .single()

    if (insertErr) {
      console.error('[nuevo-prestador]', insertErr)
      setLoading(false)
      setError('No se pudo guardar el prestador. Intentá de nuevo.')
      return
    }

    router.replace(`/circulo/prestador/${inserted.id}`)
  }

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
        .nuevo-prestador-bg { animation: heroBgDrift 30s ease-in-out infinite; }
      `}</style>

      <div className="nuevo-prestador-bg flex min-h-screen">
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
              Nuevo prestador
            </span>
          </nav>

          {/* Formulario centrado */}
          <div style={{ maxWidth: 480, margin: '0 auto' }}>

            {/* Hero — iniciales sin foto */}
            <div style={{
              padding: '24px 0 20px',
              borderBottom: '1px solid rgba(10,126,140,0.12)',
              marginBottom: 24, textAlign: 'center',
            }}>
              <div style={{
                width: 96, height: 96, borderRadius: '50%', margin: '0 auto 14px',
                background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: '1.6rem', color: 'white',
              }}>
                {name.trim() ? initialsFrom(name) : '+'}
              </div>
              <div style={{
                fontSize: '1.5rem', fontWeight: 800,
                letterSpacing: '-0.02em', color: '#1A1A2E',
              }}>
                Nuevo prestador
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div style={{
                marginBottom: 16, padding: '10px 16px',
                borderRadius: '0.75rem',
                background: 'rgba(186,26,26,0.07)',
                border: '1px solid rgba(186,26,26,0.18)',
                fontSize: '0.8125rem', color: '#ba1a1a', fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              }}>
                <span>{error}</span>
                <button
                  onClick={() => setError(null)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#ba1a1a', fontSize: '1rem', lineHeight: 1, flexShrink: 0,
                  }}
                >✕</button>
              </div>
            )}

            {/* Datos */}
            <p style={{
              fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
            }}>Datos</p>
            <div style={{
              background: '#FFFFFF', borderRadius: '1rem',
              boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
              padding: '0 20px', marginBottom: 32,
            }}>
              <SSInputRow label="Nombre"     value={name}       onChange={setName}       placeholder="Nombre o institución" />
              <SSInputRow label="Prestación" value={prestacion} onChange={setPrestacion} placeholder="Ej: Cardiólogo, OSDE, Kinesiología…" />
              <SSInputRow label="Teléfono"   value={phone}      onChange={setPhone}      placeholder="+54 9 11 …" type="tel" />
              <SSInputRow label="Email"      value={email}      onChange={setEmail}      placeholder="correo@ejemplo.com" type="email" last />
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                width: '100%', padding: '14px', borderRadius: 9999,
                border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: '0.875rem',
                background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                color: 'white', opacity: loading ? 0.7 : 1,
                transition: 'filter 0.15s',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.filter = 'brightness(1.08)' }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)' }}
            >
              {loading ? 'Agregando…' : 'Agregar prestador'}
            </button>

          </div>
        </main>
      </div>
    </>
  )
}
