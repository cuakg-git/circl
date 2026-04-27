'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type FieldErrors = {
  email?: string
  password?: string
  passwordHasForgot?: boolean
}

function validateEmail(email: string): string | undefined {
  if (!email.trim()) return 'Ingresá tu email'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return 'Ingresá un email válido (ej: nombre@dominio.com)'
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const clearFieldError = (field: keyof FieldErrors) =>
    setErrors((prev) => ({ ...prev, [field]: undefined, passwordHasForgot: undefined }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Client-side validation
    const emailErr = validateEmail(email)
    const passwordErr = !password ? 'Ingresá tu contraseña' : undefined
    if (emailErr || passwordErr) {
      setErrors({ email: emailErr, password: passwordErr })
      return
    }

    setLoading(true)
    setErrors({})

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const code = (error as any).code as string | undefined
      const msg  = error.message.toLowerCase()

      const isUserNotFound =
        code === 'user_not_found' ||
        msg.includes('user not found')

      if (isUserNotFound) {
        // Email no registrado → error sólo en el campo email, sin tocar contraseña
        setErrors({ email: 'No encontré una cuenta con ese email.' })
      } else {
        // Contraseña incorrecta (invalid_credentials u otro error de auth)
        setErrors({ password: 'Contraseña incorrecta.', passwordHasForgot: true })
      }
      return
    }

    router.push('/dashboard')
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    // Note: page will redirect, no need to setLoading(false)
  }


  return (
    <div
      className="min-h-screen bg-[#FAF8F5] flex items-center justify-center relative overflow-hidden"
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
        className="relative z-10 bg-white rounded-3xl w-full mx-4 px-10 py-10"
        style={{ maxWidth: 440, boxShadow: '0 4px 24px rgba(10,126,140,0.08)' }}
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-9">
          <Image src="/LOGO_CIRCL_1.svg" alt="Circl" width={38} height={38} />
          <span className="text-[1.6rem] font-extrabold text-[#1A1A2E] tracking-tight leading-none">
            Circl
          </span>
        </div>

        <h1 className="text-2xl font-extrabold text-[#1A1A2E] text-center tracking-tight mb-2">
          Bienvenida de nuevo
        </h1>
        <p className="text-center text-[#5a7478] text-sm mb-8">
          Ingresá para ver tu círculo.
        </p>

        {/* Google OAuth button */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-2.5 bg-white text-[#1A1A2E] font-semibold rounded-full py-3 px-4 hover:bg-gray-50 transition-colors disabled:opacity-60 cursor-pointer"
          style={{ border: '1.5px solid rgba(10,126,140,0.12)' }}
        >
          <GoogleIcon />
          {googleLoading ? 'Redirigiendo...' : 'Continuar con Google'}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-[rgba(10,126,140,0.12)]" />
          <span className="text-[0.7rem] text-[#5a7478] font-semibold tracking-[0.05em]">
            O ingresá con email
          </span>
          <div className="flex-1 h-px bg-[rgba(10,126,140,0.12)]" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-[18px]">
          {/* Email field */}
          <div className="flex flex-col gap-[7px]">
            <label htmlFor="email" className="text-sm font-semibold text-[#1A1A2E]">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                clearFieldError('email')
              }}
              placeholder="valeria@mail.com"
              autoComplete="email"
              className="w-full rounded-2xl px-4 py-3 text-[#1A1A2E] text-sm outline-none transition-all"
              style={{
                background: errors.email ? 'rgba(186,26,26,0.03)' : '#FAF8F5',
                border: `1.5px solid ${errors.email ? '#ba1a1a' : 'rgba(10,126,140,0.12)'}`,
                boxShadow: errors.email ? 'none' : undefined,
              }}
              onFocus={(e) => {
                if (!errors.email)
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(10,126,140,0.09)'
                e.currentTarget.style.borderColor = errors.email ? '#ba1a1a' : '#0A7E8C'
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.borderColor = errors.email
                  ? '#ba1a1a'
                  : 'rgba(10,126,140,0.12)'
              }}
            />
            {errors.email && (
              <p className="text-[#ba1a1a] text-xs font-semibold">{errors.email}</p>
            )}
          </div>

          {/* Password field */}
          <div className="flex flex-col gap-[7px]">
            <label htmlFor="password" className="text-sm font-semibold text-[#1A1A2E]">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                clearFieldError('password')
              }}
              placeholder="Tu contraseña"
              autoComplete="current-password"
              className="w-full rounded-2xl px-4 py-3 text-[#1A1A2E] text-sm outline-none transition-all"
              style={{
                background: errors.password ? 'rgba(186,26,26,0.03)' : '#FAF8F5',
                border: `1.5px solid ${errors.password ? '#ba1a1a' : 'rgba(10,126,140,0.12)'}`,
              }}
              onFocus={(e) => {
                if (!errors.password)
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(10,126,140,0.09)'
                e.currentTarget.style.borderColor = errors.password ? '#ba1a1a' : '#0A7E8C'
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.borderColor = errors.password
                  ? '#ba1a1a'
                  : 'rgba(10,126,140,0.12)'
              }}
            />

            {/* Password feedback: error OR forgot-password link */}
            {errors.password ? (
              <p className="text-[#ba1a1a] text-xs font-semibold flex items-center gap-1">
                {errors.password}
                {errors.passwordHasForgot && (
                  <>
                    {' '}
                    <Link
                      href="/forgot-password"
                      className="text-[#0A7E8C] underline underline-offset-2 hover:opacity-75"
                    >
                      ¿Olvidaste tu contraseña?
                    </Link>
                  </>
                )}
              </p>
            ) : (
              <div className="text-right">
                <Link
                  href="/forgot-password"
                  className="text-[0.7rem] text-[#0A7E8C] font-semibold underline underline-offset-2 hover:opacity-75"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0A7E8C] text-white font-bold rounded-full py-3 px-6 mt-2 transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center mt-6 text-sm text-[#5a7478]">
          ¿No tenés cuenta?{' '}
          <Link
            href="/register"
            className="text-[#0A7E8C] font-semibold underline underline-offset-2 hover:opacity-75"
          >
            Registrate gratis
          </Link>
        </p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 6.294C4.672 4.167 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  )
}
