'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { supabase } from '@/lib/supabase'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
})

// ─── Icons ──────────────────────────────────────────────────────────────────

function IconInbox() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M2 9h20" />
      <path d="M15 14l3-3-3-3" />
      <path d="M18 11H9" />
    </svg>
  )
}

function IconCheckCircle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12l3 3 5-5" />
    </svg>
  )
}

// ─── Main content (needs Suspense because of useSearchParams) ────────────────

type ResendState = 'idle' | 'sending' | 'resent' | 'error'

function VerifyContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''

  const [state, setState] = useState<ResendState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleResend = async () => {
    if (state === 'sending' || state === 'resent') return
    setState('sending')
    setErrorMsg('')

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    })

    if (error) {
      setErrorMsg('No pudimos reenviar el email. Intentá de nuevo.')
      setState('error')
    } else {
      setState('resent')
    }
  }

  const isResent = state === 'resent'

  return (
    <div
      className={`${jakarta.className} min-h-screen bg-[#FAF8F5] flex items-center justify-center relative overflow-hidden`}
    >
      {/* Background deco blobs */}
      <div
        className="absolute rounded-full pointer-events-none w-[500px] h-[500px] -top-[120px] -right-[120px]"
        style={{ background: 'radial-gradient(circle, rgba(10,126,140,0.07) 0%, transparent 70%)' }}
      />
      <div
        className="absolute rounded-full pointer-events-none w-[320px] h-[320px] -bottom-[80px] -left-[80px]"
        style={{ background: 'radial-gradient(circle, rgba(46,205,167,0.07) 0%, transparent 70%)' }}
      />
      {/* Decorative rings */}
      <div
        className="absolute rounded-full pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: 380, height: 380, border: '1.5px solid rgba(10,126,140,0.08)' }}
      />
      <div
        className="absolute rounded-full pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: 560, height: 560, border: '1px solid rgba(10,126,140,0.05)' }}
      />

      {/* Card */}
      <div
        className="relative z-10 bg-white rounded-3xl w-full mx-4 px-10 py-10 text-center"
        style={{ maxWidth: 440, boxShadow: '0 4px 24px rgba(10,126,140,0.08)' }}
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-9">
          <Image src="/LOGO_CIRCL_1.svg" alt="Circl" width={38} height={38} />
          <span className="text-[1.6rem] font-extrabold text-[#1A1A2E] tracking-tight leading-none">
            Circl
          </span>
        </div>

        {/* Envelope icon */}
        <div
          className="w-[72px] h-[72px] rounded-full flex items-center justify-center mx-auto mb-5"
          style={{
            background: 'rgba(61,199,166,0.12)',
            border: '2px solid rgba(61,199,166,0.3)',
            color: '#0A7E8C',
          }}
        >
          <IconInbox />
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-extrabold text-[#1A1A2E] text-center tracking-tight mb-2">
          Revisá tu email
        </h1>

        {/* Subtitle — changes after resend */}
        <p className="text-center text-[#5a7478] text-sm mb-5">
          {isResent
            ? 'Te envié un nuevo link de verificación a:'
            : 'Te envié un link de verificación a:'}
        </p>

        {/* Email chip */}
        {email && (
          <div
            className="inline-block rounded-full text-sm font-semibold mb-5 px-[14px] py-1"
            style={{
              background: 'rgba(10,126,140,0.07)',
              border: '1px solid rgba(10,126,140,0.15)',
              color: '#0A7E8C',
            }}
          >
            {email}
          </div>
        )}

        {/* Resent success banner */}
        {isResent && (
          <div
            className="flex items-center gap-2.5 rounded-2xl px-4 py-3 mb-5 text-left"
            style={{
              background: 'rgba(61,199,166,0.08)',
              border: '1px solid rgba(61,199,166,0.25)',
              color: '#0A7E8C',
            }}
          >
            <span className="flex-shrink-0" style={{ color: '#0A7E8C' }}>
              <IconCheckCircle />
            </span>
            <span className="text-sm font-semibold">Email reenviado con éxito</span>
          </div>
        )}

        {/* Resend error banner */}
        {state === 'error' && (
          <div
            className="flex items-center gap-2.5 rounded-2xl px-4 py-3 mb-5 text-left text-sm font-semibold"
            style={{
              background: 'rgba(186,26,26,0.05)',
              border: '1px solid rgba(186,26,26,0.2)',
              color: '#ba1a1a',
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Steps */}
        <div
          className="text-left rounded-2xl px-[18px] py-0 mb-6"
          style={{
            background: '#f0f4f8',
            border: '1px solid rgba(10,126,140,0.12)',
          }}
        >
          {[
            <>Abrí el email que te envié desde <strong>no-reply@circl.app</strong></>,
            <>Hacé clic en <strong>&ldquo;Verificar mi email&rdquo;</strong></>,
            <>Vas a poder completar tu perfil y activar tu círculo</>,
          ].map((text, i) => (
            <div
              key={i}
              className="flex items-start gap-3 py-[7px] text-sm text-[#5a7478]"
              style={i > 0 ? { borderTop: '1px solid rgba(10,126,140,0.12)' } : {}}
            >
              <div
                className="flex-shrink-0 w-[22px] h-[22px] rounded-full flex items-center justify-center mt-[1px] text-[11px] font-bold"
                style={{ background: 'rgba(10,126,140,0.1)', color: '#0A7E8C' }}
              >
                {i + 1}
              </div>
              <span>{text}</span>
            </div>
          ))}
        </div>

        {/* Helper text — changes after resend */}
        <p className="text-[0.7rem] text-[#5a7478] mb-5">
          {isResent
            ? <>Si tampoco llega, revisá la carpeta de spam o escribime a <strong>soporte@circl.app</strong>.</>
            : '¿No llegó? Revisá spam. Puede demorar hasta 5 minutos.'}
        </p>

        {/* Resend button */}
        <button
          type="button"
          onClick={handleResend}
          disabled={isResent || state === 'sending'}
          className="w-full font-bold rounded-full py-3 px-6 mb-3 transition-all cursor-pointer"
          style={
            isResent
              ? {
                  background: 'transparent',
                  border: '1.5px solid rgba(10,126,140,0.25)',
                  color: '#0A7E8C',
                  opacity: 0.5,
                  cursor: 'not-allowed',
                }
              : {
                  background: '#0A7E8C',
                  color: '#fff',
                }
          }
        >
          {state === 'sending' ? 'Enviando...' : 'Reenviar email'}
        </button>

        {/* Back to login */}
        <div className="mt-2">
          <Link
            href="/login"
            className="text-sm text-[#0A7E8C] font-semibold underline underline-offset-2 hover:opacity-75"
          >
            ← Volver al login
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Page export — wraps content in Suspense (required for useSearchParams) ──

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyContent />
    </Suspense>
  )
}
