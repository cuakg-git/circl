'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { supabase } from '@/lib/supabase'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
})

// ─── Types ────────────────────────────────────────────────────────────────────

type PageState = 'form' | 'success' | 'expired'
type FieldErrors = { password?: string; confirm?: string }

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconEye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconEyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function IconLinkOff() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

// ─── Input style helpers (same pattern as register/login) ─────────────────────

function inputBorderStyle(hasError: boolean) {
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

// ─── Shared layout pieces ─────────────────────────────────────────────────────

function Backdrop() {
  return (
    <>
      <div className="absolute rounded-full pointer-events-none w-[500px] h-[500px] -top-[120px] -right-[120px]"
        style={{ background: 'radial-gradient(circle, rgba(10,126,140,0.07) 0%, transparent 70%)' }} />
      <div className="absolute rounded-full pointer-events-none w-[320px] h-[320px] -bottom-[80px] -left-[80px]"
        style={{ background: 'radial-gradient(circle, rgba(46,205,167,0.07) 0%, transparent 70%)' }} />
      <div className="absolute rounded-full pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: 380, height: 380, border: '1.5px solid rgba(10,126,140,0.08)' }} />
      <div className="absolute rounded-full pointer-events-none top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: 560, height: 560, border: '1px solid rgba(10,126,140,0.05)' }} />
    </>
  )
}

function Logo() {
  return (
    <div className="flex items-center justify-center gap-2.5 mb-9">
      <Image src="/LOGO_CIRCL_1.svg" alt="Circl" width={38} height={38} />
      <span className="text-[1.6rem] font-extrabold text-[#1A1A2E] tracking-tight leading-none">Circl</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResetPasswordPage() {
  const router = useRouter()

  const [pageState, setPageState] = useState<PageState>('form')
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [errors,    setErrors]    = useState<FieldErrors>({})
  const [globalError, setGlobalError] = useState('')
  const [loading,   setLoading]   = useState(false)
  const [showPw,    setShowPw]    = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // ── Validation ──────────────────────────────────────────────────────────────

  function validate(): FieldErrors {
    const errs: FieldErrors = {}
    if (!password)
      errs.password = 'Ingresá tu nueva contraseña'
    if (!confirm)
      errs.confirm = 'Repetí tu contraseña'
    else if (password && confirm !== password)
      errs.confirm = 'Las contraseñas no coinciden'
    return errs
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setLoading(true)
    setErrors({})
    setGlobalError('')

    const { error } = await supabase.auth.updateUser({ password })

    setLoading(false)

    if (error) {
      // Detect expired / invalid token errors
      const msg = error.message.toLowerCase()
      const isExpired =
        msg.includes('expired') ||
        msg.includes('invalid') ||
        msg.includes('session') ||
        msg.includes('token') ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (error as any).code === 'otp_expired' ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (error as any).status === 401

      if (isExpired) {
        setPageState('expired')
      } else {
        setGlobalError('No pudimos actualizar tu contraseña. Intentá de nuevo.')
      }
      return
    }

    setPageState('success')
  }

  // ── Shared card shell ───────────────────────────────────────────────────────

  const pageClass = `${jakarta.className} min-h-screen bg-[#FAF8F5] flex items-center justify-center relative overflow-hidden`
  const cardStyle = { maxWidth: 440, boxShadow: '0 4px 24px rgba(10,126,140,0.08)' }

  // ════════════════════════════════════════════════════════════════════════════
  // SUCCESS
  // ════════════════════════════════════════════════════════════════════════════

  if (pageState === 'success') {
    return (
      <div className={pageClass}>
        <style>{`
          @keyframes ringPulse {
            0%, 100% { transform: scale(1);    opacity: 1;    }
            50%       { transform: scale(1.12); opacity: 0.45; }
          }
          @keyframes drawCheck {
            to { stroke-dashoffset: 0; }
          }
          @keyframes cardIn {
            from { opacity: 0; transform: translateY(14px); }
            to   { opacity: 1; transform: translateY(0);    }
          }
          .success-card  { animation: cardIn 0.45s ease-out both; }
          .success-ring  { animation: ringPulse 2.4s ease-in-out infinite; }
          .check-path    {
            stroke-dasharray: 40;
            stroke-dashoffset: 40;
            animation: drawCheck 0.55s ease-out 0.2s forwards;
          }
        `}</style>

        <Backdrop />

        <div className="success-card relative z-10 bg-white rounded-3xl w-full mx-4 px-10 py-10 text-center" style={cardStyle}>
          <Logo />

          {/* Animated success icon */}
          <div className="relative w-[88px] h-[88px] mx-auto mb-6">
            <div className="success-ring absolute inset-0 rounded-full"
              style={{ border: '2px solid rgba(46,205,167,0.30)' }} />
            <div className="absolute rounded-full flex items-center justify-center"
              style={{ inset: 8, background: 'rgba(46,205,167,0.12)', border: '2px solid rgba(46,199,166,0.30)' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#0A7E8C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path className="check-path" d="M5 12l5 5L20 7" />
              </svg>
            </div>
          </div>

          <h1 className="text-2xl font-extrabold text-[#1A1A2E] tracking-tight mb-2">
            ¡Contraseña actualizada!
          </h1>
          <p className="text-[#5a7478] text-sm mb-6">
            Tu contraseña fue cambiada con éxito.<br />Ya podés ingresar con tus nuevos datos.
          </p>

          {/* CTA */}
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="w-full bg-[#0A7E8C] text-white font-bold rounded-full py-3 px-6 mb-3 transition-all hover:brightness-110 active:scale-[0.97] cursor-pointer"
          >
            Continuar
          </button>

          <p className="text-[0.7rem] text-[#5a7478]">
            ¿Necesitás ayuda? Escribinos a{' '}
            <a href="mailto:soporte@circl.app" className="text-[#0A7E8C] font-semibold underline underline-offset-2 hover:opacity-75">
              soporte@circl.app
            </a>
          </p>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // EXPIRED / INVALID TOKEN
  // ════════════════════════════════════════════════════════════════════════════

  if (pageState === 'expired') {
    return (
      <div className={pageClass}>
        <Backdrop />

        <div className="relative z-10 bg-white rounded-3xl w-full mx-4 px-10 py-10 text-center" style={cardStyle}>
          <Logo />

          {/* Error icon */}
          <div
            className="w-[72px] h-[72px] rounded-full flex items-center justify-center mx-auto mb-5"
            style={{
              background: 'rgba(186,26,26,0.08)',
              border: '2px solid rgba(186,26,26,0.2)',
              color: '#ba1a1a',
            }}
          >
            <IconLinkOff />
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight mb-2" style={{ color: '#ba1a1a' }}>
            Este link expiró
          </h1>
          <p className="text-[#5a7478] text-sm mb-6">
            Los links de recuperación son válidos por 24 horas. Este ya no está activo. Podés solicitar uno nuevo sin problema.
          </p>

          {/* CTA */}
          <Link
            href="/forgot-password"
            className="w-full bg-[#0A7E8C] text-white font-bold rounded-full py-3 px-6 mb-3 transition-all hover:brightness-110 active:scale-[0.97] flex items-center justify-center"
          >
            Solicitar nuevo link
          </Link>

          <div className="mt-4">
            <Link href="/login" className="text-sm text-[#0A7E8C] font-semibold underline underline-offset-2 hover:opacity-75">
              ← Volver al login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // FORM (default)
  // ════════════════════════════════════════════════════════════════════════════

  return (
    <div className={pageClass}>
      <Backdrop />

      <div className="relative z-10 bg-white rounded-3xl w-full mx-4 px-10 py-10" style={cardStyle}>
        <Logo />

        <h1 className="text-2xl font-extrabold text-[#1A1A2E] text-center tracking-tight mb-2">
          Nueva contraseña
        </h1>
        <p className="text-center text-[#5a7478] text-sm mb-8">
          Elegí una contraseña para proteger tu cuenta.
        </p>

        {/* Global error banner */}
        {globalError && (
          <div
            className="rounded-2xl px-4 py-3 mb-5 text-sm font-semibold"
            style={{
              background: 'rgba(186,26,26,0.05)',
              border: '1px solid rgba(186,26,26,0.2)',
              color: '#ba1a1a',
            }}
          >
            {globalError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-[18px]">

          {/* Nueva contraseña */}
          <div className="flex flex-col gap-[7px]">
            <label htmlFor="password" className="text-sm font-semibold text-[#1A1A2E]">
              Nueva contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined })) }}
                placeholder="Tu nueva contraseña"
                autoComplete="new-password"
                className="w-full rounded-2xl px-4 py-3 pr-[46px] text-[#1A1A2E] text-sm outline-none transition-all"
                style={inputBorderStyle(!!errors.password)}
                onFocus={(e) => onFocusStyle(e, !!errors.password)}
                onBlur={(e)  => onBlurStyle(e,  !!errors.password)}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-[14px] top-1/2 -translate-y-1/2 p-1 text-[#5a7478] hover:text-[#0A7E8C] transition-colors cursor-pointer"
                aria-label="Mostrar contraseña"
              >
                {showPw ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
            {errors.password && (
              <p className="text-[#ba1a1a] text-xs font-semibold">{errors.password}</p>
            )}
          </div>

          {/* Repetir contraseña */}
          <div className="flex flex-col gap-[7px]">
            <label htmlFor="confirm" className="text-sm font-semibold text-[#1A1A2E]">
              Repetí la contraseña
            </label>
            <div className="relative">
              <input
                id="confirm"
                type={showConfirm ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setErrors(p => ({ ...p, confirm: undefined })) }}
                placeholder="Repetí tu contraseña"
                autoComplete="new-password"
                className="w-full rounded-2xl px-4 py-3 pr-[46px] text-[#1A1A2E] text-sm outline-none transition-all"
                style={inputBorderStyle(!!errors.confirm)}
                onFocus={(e) => onFocusStyle(e, !!errors.confirm)}
                onBlur={(e)  => onBlurStyle(e,  !!errors.confirm)}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-[14px] top-1/2 -translate-y-1/2 p-1 text-[#5a7478] hover:text-[#0A7E8C] transition-colors cursor-pointer"
                aria-label="Mostrar contraseña"
              >
                {showConfirm ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
            {errors.confirm && (
              <p className="text-[#ba1a1a] text-xs font-semibold">{errors.confirm}</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0A7E8C] text-white font-bold rounded-full py-3 px-6 mt-2 transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? 'Guardando...' : 'Guardar contraseña'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-sm text-[#0A7E8C] font-semibold underline underline-offset-2 hover:opacity-75">
            ← Volver al login
          </Link>
        </div>
      </div>
    </div>
  )
}
