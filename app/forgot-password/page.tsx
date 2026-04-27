'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconMail() {
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inputStyle(hasError: boolean) {
  return {
    background: hasError ? 'rgba(186,26,26,0.03)' : '#FAF8F5',
    border: `1.5px solid ${hasError ? '#ba1a1a' : 'rgba(10,126,140,0.12)'}`,
  }
}

function onFocusStyle(e: React.FocusEvent<HTMLInputElement>, hasError: boolean) {
  e.currentTarget.style.borderColor = hasError ? '#ba1a1a' : '#0A7E8C'
  if (!hasError) e.currentTarget.style.boxShadow = '0 0 0 3px rgba(10,126,140,0.09)'
}

function onBlurStyle(e: React.FocusEvent<HTMLInputElement>, hasError: boolean) {
  e.currentTarget.style.borderColor = hasError ? '#ba1a1a' : 'rgba(10,126,140,0.12)'
  e.currentTarget.style.boxShadow = 'none'
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ForgotPasswordPage() {
  const [email, setEmail]       = useState('')
  const [emailError, setEmailError] = useState('')
  const [globalError, setGlobalError] = useState('')
  const [loading, setLoading]   = useState(false)
  const [sent, setSent]         = useState(false)

  function validate(): string {
    if (!email.trim()) return 'Ingresá tu email'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return 'Ingresá un email válido (ej: nombre@dominio.com)'
    return ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const err = validate()
    if (err) { setEmailError(err); return }

    setLoading(true)
    setEmailError('')
    setGlobalError('')

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)

    if (error) {
      setGlobalError('No pudimos enviar el email. Intentá de nuevo.')
      return
    }

    setSent(true)
  }

  // ── Background decorations (shared) ──────────────────────────────────────
  const backdrop = (
    <>
      {/* Blobs */}
      <div
        className="absolute rounded-full pointer-events-none w-[500px] h-[500px] -top-[120px] -right-[120px]"
        style={{ background: 'radial-gradient(circle, rgba(10,126,140,0.07) 0%, transparent 70%)' }}
      />
      <div
        className="absolute rounded-full pointer-events-none w-[320px] h-[320px] -bottom-[80px] -left-[80px]"
        style={{ background: 'radial-gradient(circle, rgba(46,205,167,0.07) 0%, transparent 70%)' }}
      />
      {/* Rings */}
      <div
        className="absolute rounded-full pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: 380, height: 380, border: '1.5px solid rgba(10,126,140,0.08)' }}
      />
      <div
        className="absolute rounded-full pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: 560, height: 560, border: '1px solid rgba(10,126,140,0.05)' }}
      />
    </>
  )

  // ── Logo ─────────────────────────────────────────────────────────────────
  const logo = (
    <div className="flex items-center justify-center gap-2.5 mb-9">
      <Image src="/LOGO_CIRCL_1.svg" alt="Circl" width={38} height={38} />
      <span className="text-[1.6rem] font-extrabold text-[#1A1A2E] tracking-tight leading-none">
        Circl
      </span>
    </div>
  )

  // ── "Back to login" link (shared) ─────────────────────────────────────────
  const backLink = (
    <div className="mt-6 text-center">
      <Link
        href="/login"
        className="text-sm text-[#0A7E8C] font-semibold underline underline-offset-2 hover:opacity-75"
      >
        ← Volver al login
      </Link>
    </div>
  )

  // ── Card shell ────────────────────────────────────────────────────────────
  const cardClass =
    'relative z-10 bg-white rounded-3xl w-full mx-4 px-10 py-10'
  const cardStyle = { maxWidth: 440, boxShadow: '0 4px 24px rgba(10,126,140,0.08)' }

  // ══════════════════════════════════════════════════════════════════════════
  // SUCCESS STATE
  // ══════════════════════════════════════════════════════════════════════════
  if (sent) {
    return (
      <div className={"min-h-screen bg-[#FAF8F5] flex items-center justify-center relative overflow-hidden"}>
        {backdrop}

        <div className={cardClass} style={cardStyle}>
          {logo}

          {/* Envelope icon */}
          <div
            className="w-[72px] h-[72px] rounded-full flex items-center justify-center mx-auto mb-5"
            style={{
              background: 'rgba(61,199,166,0.12)',
              border: '2px solid rgba(61,199,166,0.3)',
              color: '#0A7E8C',
            }}
          >
            <IconMail />
          </div>

          <h1 className="text-2xl font-extrabold text-[#1A1A2E] text-center tracking-tight mb-2">
            Revisá tu email
          </h1>
          <p className="text-center text-[#5a7478] text-sm mb-5">
            Te envié las instrucciones para restablecer tu contraseña a:
          </p>

          {/* Email chip */}
          <div className="flex justify-center mb-5">
            <div
              className="inline-block rounded-full text-sm font-semibold px-[14px] py-1"
              style={{
                background: 'rgba(10,126,140,0.07)',
                border: '1px solid rgba(10,126,140,0.15)',
                color: '#0A7E8C',
              }}
            >
              {email}
            </div>
          </div>

          {/* Success banner */}
          <div
            className="flex items-center gap-2.5 rounded-2xl px-4 py-3 mb-5 text-left"
            style={{
              background: 'rgba(61,199,166,0.08)',
              border: '1px solid rgba(61,199,166,0.25)',
              color: '#0A7E8C',
            }}
          >
            <span className="flex-shrink-0">
              <IconCheckCircle />
            </span>
            <span className="text-sm font-semibold">Email enviado con éxito</span>
          </div>

          {/* Steps */}
          <div
            className="text-left rounded-2xl px-[18px] py-0 mb-6"
            style={{
              background: '#f0f4f8',
              border: '1px solid rgba(10,126,140,0.12)',
            }}
          >
            {[
              <>Abrí el email desde <strong>no-reply@circl.app</strong></>,
              <>Hacé clic en <strong>&ldquo;Restablecer contraseña&rdquo;</strong></>,
              <>Creá tu nueva contraseña y volvé a ingresar</>,
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

          <p className="text-[0.7rem] text-[#5a7478] text-center mb-1">
            ¿No llegó? Revisá spam o{' '}
            <button
              type="button"
              onClick={() => setSent(false)}
              className="text-[#0A7E8C] font-semibold underline underline-offset-2 hover:opacity-75 cursor-pointer"
            >
              intentá con otro email
            </button>
            .
          </p>

          {backLink}
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FORM STATE
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className={"min-h-screen bg-[#FAF8F5] flex items-center justify-center relative overflow-hidden"}>
      {backdrop}

      <div className={cardClass} style={cardStyle}>
        {logo}

        <h1 className="text-2xl font-extrabold text-[#1A1A2E] text-center tracking-tight mb-2">
          Recuperá tu acceso
        </h1>
        <p className="text-center text-[#5a7478] text-sm mb-8">
          Ingresá tu email y te envío las instrucciones para restablecer tu contraseña.
        </p>

        {/* Global error banner */}
        {globalError && (
          <div
            className="flex items-center gap-2.5 rounded-2xl px-4 py-3 mb-5 text-left text-sm font-semibold"
            style={{
              background: 'rgba(186,26,26,0.05)',
              border: '1px solid rgba(186,26,26,0.2)',
              color: '#ba1a1a',
            }}
          >
            {globalError}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-[18px]">

          {/* Email */}
          <div className="flex flex-col gap-[7px]">
            <label htmlFor="email" className="text-sm font-semibold text-[#1A1A2E]">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError('') }}
              placeholder="valeria@mail.com"
              autoComplete="email"
              className="w-full rounded-2xl px-4 py-3 text-[#1A1A2E] text-sm outline-none transition-all"
              style={inputStyle(!!emailError)}
              onFocus={(e) => onFocusStyle(e, !!emailError)}
              onBlur={(e)  => onBlurStyle(e,  !!emailError)}
            />
            {emailError && (
              <p className="text-[#ba1a1a] text-xs font-semibold">{emailError}</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0A7E8C] text-white font-bold rounded-full py-3 px-6 mt-2 transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? 'Enviando...' : 'Enviar instrucciones'}
          </button>
        </form>

        {backLink}
      </div>
    </div>
  )
}
