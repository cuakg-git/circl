'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingInvitadoPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const inviterName = searchParams.get('inviter') ?? ''
  const caseName    = searchParams.get('case')    ?? ''
  const token       = searchParams.get('token')   ?? ''

  const [userId,       setUserId]       = useState<string | null>(null)
  const [firstName,    setFirstName]    = useState<string>('')
  const [loading,      setLoading]      = useState(false)
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null)
  const [sharedCaseId, setSharedCaseId] = useState<string | null>(null)

  // ── Init: obtener usuario logueado ──────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) return
      setUserId(data.user.id)
      const full  = data.user.user_metadata?.full_name ?? ''
      const first = full.trim().split(/\s+/)[0] || ''
      setFirstName(first)
    })
  }, [])

  // ── Acción principal ─────────────────────────────────────────────────────────

  async function handleComenzar() {
    if (!userId) return
    setLoading(true)
    setErrorMsg(null)

    // a. Marcar onboarding como completado
    await supabase
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('id', userId)

    // b. Aceptar la invitación si hay token
    if (token) {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token ?? ''

      const res  = await fetch(`/api/invitacion/${token}`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      })
      const data = await res.json()

      if (res.ok && data.shared_case_id) {
        setSharedCaseId(data.shared_case_id)
        setLoading(false)
        // c. Navegar al dashboard
        router.push('/dashboard')
        return
      } else if (!res.ok) {
        setErrorMsg(data.error ?? 'No se pudo aceptar la invitación. Podés intentarlo desde el dashboard.')
        setLoading(false)
        return
      }
    }

    // c. Sin token, ir directo al dashboard
    router.push('/dashboard')
  }

  const greeting = firstName ? `Hola, ${firstName}` : 'Hola'

  return (
    <>
      <style>{`
        @keyframes heroGradientDrift {
          0%, 100% {
            background:
              radial-gradient(ellipse at 15% 15%, rgba(61,199,166,0.06) 0%, transparent 55%),
              radial-gradient(ellipse at 85% 10%, rgba(80,220,175,0.14) 0%, transparent 50%),
              radial-gradient(ellipse at 88% 82%, rgba(224,121,49,0.16) 0%, transparent 52%),
              radial-gradient(ellipse at 12% 88%, rgba(158,160,81,0.16) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.30) 0%, transparent 65%),
              #f0f4f8;
          }
          25% {
            background:
              radial-gradient(ellipse at 22% 10%, rgba(61,199,166,0.06) 0%, transparent 55%),
              radial-gradient(ellipse at 90% 20%, rgba(80,220,175,0.14) 0%, transparent 50%),
              radial-gradient(ellipse at 80% 88%, rgba(224,121,49,0.16) 0%, transparent 52%),
              radial-gradient(ellipse at  6% 78%, rgba(158,160,81,0.16) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.30) 0%, transparent 65%),
              #f0f4f8;
          }
          50% {
            background:
              radial-gradient(ellipse at 10% 22%, rgba(61,199,166,0.06) 0%, transparent 55%),
              radial-gradient(ellipse at 78%  8%, rgba(80,220,175,0.14) 0%, transparent 50%),
              radial-gradient(ellipse at 92% 75%, rgba(224,121,49,0.16) 0%, transparent 52%),
              radial-gradient(ellipse at 18% 92%, rgba(158,160,81,0.16) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.30) 0%, transparent 65%),
              #f0f4f8;
          }
          75% {
            background:
              radial-gradient(ellipse at 20% 22%, rgba(61,199,166,0.06) 0%, transparent 55%),
              radial-gradient(ellipse at 82% 18%, rgba(80,220,175,0.14) 0%, transparent 50%),
              radial-gradient(ellipse at 85% 90%, rgba(224,121,49,0.16) 0%, transparent 52%),
              radial-gradient(ellipse at 14% 82%, rgba(158,160,81,0.16) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.30) 0%, transparent 65%),
              #f0f4f8;
          }
        }
        .inv-page { animation: heroGradientDrift 30s ease-in-out infinite; }
      `}</style>

      <div
        className="inv-page"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'var(--font-plus-jakarta-sans), sans-serif',
        }}
      >
        <div style={{
          width: '100%',
          maxWidth: 440,
          background: '#ffffff',
          borderRadius: '1.5rem',
          boxShadow: '0 4px 32px rgba(10,126,140,0.10)',
          padding: '40px',
        }}>

          {/* Logo */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            justifyContent: 'center',
            marginBottom: 32,
          }}>
            <Image
              src="/LOGO_CIRCL_2.svg"
              alt="Mhiru"
              width={32}
              height={32}
              style={{ width: 'auto', height: 32 }}
            />
            <span style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: '#1A1A2E',
              lineHeight: 1,
            }}>
              Mhiru
            </span>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(10,126,140,0.10)', marginBottom: 28 }} />

          {/* Greeting */}
          <p style={{
            fontSize: '1.5rem',
            fontWeight: 800,
            color: '#1A1A2E',
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            marginBottom: 16,
            textAlign: 'center',
          }}>
            {greeting}
          </p>

          {/* Invitation text */}
          <p style={{
            fontSize: '0.9375rem',
            color: '#5a7478',
            lineHeight: 1.65,
            textAlign: 'center',
            marginBottom: 32,
          }}>
            {inviterName && caseName ? (
              <>
                <strong style={{ color: '#1A1A2E' }}>{inviterName}</strong>
                {' te pidió que te unas a '}
                <strong style={{ color: '#1A1A2E' }}>{caseName}</strong>
                {'. Además de eso, puedo ayudarte con otros temas personales.'}
              </>
            ) : caseName ? (
              <>
                {'Te invitaron a unirte a '}
                <strong style={{ color: '#1A1A2E' }}>{caseName}</strong>
                {'. Además de eso, puedo ayudarte con otros temas personales.'}
              </>
            ) : (
              'Estoy para acompañarte con la coordinación de cuidado y otros temas personales.'
            )}
          </p>

          {/* Error */}
          {errorMsg && (
            <p style={{
              fontSize: '0.875rem',
              color: '#c0392b',
              textAlign: 'center',
              marginBottom: 16,
              lineHeight: 1.5,
            }}>
              {errorMsg}
            </p>
          )}

          {/* CTA primario */}
          <button
            onClick={handleComenzar}
            disabled={loading || !userId}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'center',
              background: loading || !userId
                ? 'rgba(10,126,140,0.35)'
                : 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.9375rem',
              border: 'none',
              cursor: loading || !userId ? 'not-allowed' : 'pointer',
              padding: '14px 24px',
              borderRadius: 9999,
              fontFamily: 'inherit',
              transition: 'opacity 0.15s',
              marginBottom: sharedCaseId ? 14 : 0,
            }}
          >
            {loading ? 'Comenzando…' : 'Comenzar'}
          </button>

          {/* Link secundario — solo visible cuando la invitación fue aceptada */}
          {sharedCaseId && (
            <div style={{ textAlign: 'center' }}>
              <button
                onClick={() => router.push(`/case/shared/${sharedCaseId}`)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#0A7E8C',
                  fontFamily: 'inherit',
                  padding: 0,
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                }}
              >
                Ver el tema compartido →
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
