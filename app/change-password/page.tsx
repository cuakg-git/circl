'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

// ─── Icons ───────────────────────────────────────────────────────────────────
// Matches maqueta: width="18" height="18" stroke-width="1.8"

function IconEyeOpen() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconEyeClosed() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

// ─── Background animation ─────────────────────────────────────────────────────

const bgStyles = `
  @keyframes heroBgDrift {
    0%, 100% {
      background:
        radial-gradient(ellipse at 15% 15%, rgba(61,199,166,0.03) 0%, transparent 55%),
        radial-gradient(ellipse at 85% 10%, rgba(80,220,175,0.07) 0%, transparent 50%),
        radial-gradient(ellipse at 88% 82%, rgba(224,121,49,0.08) 0%, transparent 52%),
        radial-gradient(ellipse at 12% 88%, rgba(158,160,81,0.08) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 65%),
        #f0f4f8;
    }
    25% {
      background:
        radial-gradient(ellipse at 22% 10%, rgba(61,199,166,0.03) 0%, transparent 55%),
        radial-gradient(ellipse at 90% 20%, rgba(80,220,175,0.07) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 88%, rgba(224,121,49,0.08) 0%, transparent 52%),
        radial-gradient(ellipse at  6% 78%, rgba(158,160,81,0.08) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 65%),
        #f0f4f8;
    }
    50% {
      background:
        radial-gradient(ellipse at 10% 22%, rgba(61,199,166,0.03) 0%, transparent 55%),
        radial-gradient(ellipse at 78%  8%, rgba(80,220,175,0.07) 0%, transparent 50%),
        radial-gradient(ellipse at 92% 75%, rgba(224,121,49,0.08) 0%, transparent 52%),
        radial-gradient(ellipse at 18% 92%, rgba(158,160,81,0.08) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 65%),
        #f0f4f8;
    }
    75% {
      background:
        radial-gradient(ellipse at 20% 22%, rgba(61,199,166,0.03) 0%, transparent 55%),
        radial-gradient(ellipse at 82% 18%, rgba(80,220,175,0.07) 0%, transparent 50%),
        radial-gradient(ellipse at 85% 90%, rgba(224,121,49,0.08) 0%, transparent 52%),
        radial-gradient(ellipse at 14% 82%, rgba(158,160,81,0.08) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 65%),
        #f0f4f8;
    }
  }
  .change-pw-bg { animation: heroBgDrift 30s ease-in-out infinite; }
`

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChangePasswordPage() {
  const router = useRouter()

  const [password, setPassword]       = useState('')
  const [confirm,  setConfirm]        = useState('')
  const [showPassword, setShowPw]     = useState(false)
  const [showConfirm,  setShowCf]     = useState(false)
  const [loading,  setLoading]        = useState(false)

  // Per-field errors — matches maqueta validation pattern
  const [pwErr, setPwErr]             = useState('')
  const [cfErr, setCfErr]             = useState('')

  // ── Validation ──────────────────────────────────────────────────────────────
  function validate(): boolean {
    let valid = true

    if (!password) {
      setPwErr('Ingresá tu nueva contraseña')
      valid = false
    } else {
      setPwErr('')
    }

    if (!confirm) {
      setCfErr('Repetí tu contraseña')
      valid = false
    } else if (confirm !== password) {
      setCfErr('Las contraseñas no coinciden')
      valid = false
    } else {
      setCfErr('')
    }

    return valid
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setCfErr(error.message || 'Error al cambiar la contraseña')
      return
    }

    router.push('/change-password/success')
  }

  // ── Input style helpers ─────────────────────────────────────────────────────
  // Maqueta: border-color #ba1a1a + background rgba(186,26,26,0.03) on error
  function inputStyle(hasError: boolean, withToggle = false): React.CSSProperties {
    return {
      width:         '100%',
      background:    hasError ? 'rgba(186,26,26,0.03)' : '#FAF8F5',
      border:        `1.5px solid ${hasError ? '#ba1a1a' : 'rgba(10,126,140,0.12)'}`,
      borderRadius:  9999,
      // .form-input: padding 13px 22px
      // .input-wrap .form-input: padding-right 46px (space for toggle)
      padding:       withToggle ? '13px 46px 13px 22px' : '13px 22px',
      fontSize:      '1rem',
      color:         '#1A1A2E',
      outline:       'none',
      fontFamily:    'inherit',
      transition:    'border-color 0.2s, box-shadow 0.2s',
      boxSizing:     'border-box',
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{bgStyles}</style>

      <div className="change-pw-bg flex min-h-screen">
        {/*
          Main area — no sidebar on this page.
          Card is centered within the full width.
        */}
        <main className="flex-1 flex items-center justify-center px-4 py-10">

          {/*
            .auth-card — padding: 48px 40px; max-width: 440px;
            border-radius: var(--radius-card) = 1.5rem;
            box-shadow: var(--shadow-float) = 0 8px 40px rgba(10,126,140,0.16)
          */}
          <div
            className="bg-white w-full"
            style={{
              maxWidth:     440,
              borderRadius: '1.5rem',
              boxShadow:    '0 8px 40px rgba(10,126,140,0.16)',
              padding:      '48px 40px',
            }}
          >

            {/*
              .auth-logo-wrap — gap: 10px; margin-bottom: 36px; centered
              img: height 38px; width auto
              .auth-logo-word: font-size 1.6rem; font-weight 800; letter-spacing -0.03em
            */}
            <div className="flex items-center justify-center gap-[10px] mb-9">
              <Image
                src="/LOGO_CIRCL_1.svg"
                alt="Circl"
                width={38}
                height={38}
                style={{ width: 'auto', height: 38 }}
              />
              <span className="text-[1.6rem] font-extrabold text-[#1A1A2E] tracking-[-0.03em] leading-none">
                Circl
              </span>
            </div>

            {/*
              .auth-heading — font-size 1.5rem; font-weight 800;
              letter-spacing -0.02em; text-align center; margin-bottom 6px
            */}
            <h1
              className="font-extrabold text-center text-[#1A1A2E]"
              style={{ fontSize: '1.5rem', letterSpacing: '-0.02em', marginBottom: 6 }}
            >
              Cambiar contraseña
            </h1>

            {/*
              .auth-sub — font-size var(--text-sm)=0.875rem; color muted;
              text-align center; margin-bottom 32px
            */}
            <p
              className="text-center text-[#5a7478]"
              style={{ fontSize: '0.875rem', marginBottom: 32 }}
            >
              Ingresá tu nueva contraseña.<br />
              Asegurate que sea segura.
            </p>

            {/*
              .auth-form — display flex; flex-direction column; gap 18px
            */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Nueva contraseña — .form-group { flex-col; gap: 7px } */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {/* .form-label — font-size 0.875rem; font-weight 600 */}
                <label
                  htmlFor="password"
                  style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1A1A2E' }}
                >
                  Nueva contraseña
                </label>

                {/* .input-wrap — position relative */}
                <div style={{ position: 'relative' }}>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Tu nueva contraseña"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setPwErr('') }}
                    style={inputStyle(!!pwErr, true)}
                  />
                  {/*
                    .pw-toggle — position absolute; right: 14px; top 50%;
                    translateY(-50%); color muted; hover teal
                  */}
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPassword)}
                    tabIndex={-1}
                    style={{
                      position:  'absolute',
                      right:     14,
                      top:       '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border:    'none',
                      cursor:    'pointer',
                      padding:   4,
                      color:     '#5a7478',
                      display:   'flex',
                      alignItems:'center',
                    }}
                  >
                    {showPassword ? <IconEyeClosed /> : <IconEyeOpen />}
                  </button>
                </div>

                {/* Per-field error — font-size 0.72rem; font-weight 600; color #ba1a1a; margin-top 6px */}
                {pwErr && (
                  <p style={{ color: '#ba1a1a', fontSize: '0.72rem', fontWeight: 600, marginTop: 6 }}>
                    {pwErr}
                  </p>
                )}
              </div>

              {/* Repetí la contraseña */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <label
                  htmlFor="confirm"
                  style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1A1A2E' }}
                >
                  Repetí la contraseña
                </label>

                <div style={{ position: 'relative' }}>
                  <input
                    id="confirm"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Repetí tu contraseña"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); setCfErr('') }}
                    style={inputStyle(!!cfErr, true)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCf(!showConfirm)}
                    tabIndex={-1}
                    style={{
                      position:  'absolute',
                      right:     14,
                      top:       '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border:    'none',
                      cursor:    'pointer',
                      padding:   4,
                      color:     '#5a7478',
                      display:   'flex',
                      alignItems:'center',
                    }}
                  >
                    {showConfirm ? <IconEyeClosed /> : <IconEyeOpen />}
                  </button>
                </div>

                {cfErr && (
                  <p style={{ color: '#ba1a1a', fontSize: '0.72rem', fontWeight: 600, marginTop: 6 }}>
                    {cfErr}
                  </p>
                )}
              </div>

              {/*
                .btn.btn-primary.btn-block — padding 13px 30px;
                border-radius var(--radius-pill) = 9999px;
                font-size 1rem; font-weight 700; margin-top 8px
              */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding:       '13px 30px',
                  borderRadius:  9999,
                  background:    '#0A7E8C',
                  color:         'white',
                  fontSize:      '1rem',
                  fontWeight:    700,
                  border:        'none',
                  cursor:        loading ? 'not-allowed' : 'pointer',
                  opacity:       loading ? 0.6 : 1,
                  width:         '100%',
                  marginTop:     8,
                  transition:    'filter 0.18s',
                  fontFamily:    'inherit',
                }}
                onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.07)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = '' }}
              >
                {loading ? 'Cambiando…' : 'Cambiar contraseña'}
              </button>
            </form>

            {/*
              .auth-footer — margin-top 24px; text-align center;
              font-size var(--text-sm)=0.875rem; color muted
              .link-teal — color teal; font-weight 600; underline; underline-offset 3px
            */}
            <div style={{ marginTop: 24, textAlign: 'center', fontSize: '0.875rem', color: '#5a7478' }}>
              <p style={{ marginBottom: 12 }}>
                ¿Necesitás ayuda? Escribinos a{' '}
                <a
                  href="mailto:soporte@circl.app"
                  style={{ color: '#0A7E8C', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3 }}
                >
                  soporte@circl.app
                </a>
              </p>
              <Link
                href="/profile"
                style={{ color: '#0A7E8C', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3 }}
              >
                ← Volver a mi perfil
              </Link>
            </div>

          </div>
        </main>
      </div>
    </>
  )
}
