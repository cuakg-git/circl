'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type FieldErrors = {
  name?: string
  email?: string
  password?: string
}

function inputStyle(hasError: boolean) {
  return {
    background: hasError ? 'rgba(186,26,26,0.03)' : '#FAF8F5',
    border: `1.5px solid ${hasError ? '#ba1a1a' : 'rgba(10,126,140,0.12)'}`,
  }
}

function onFocusStyle(
  e: React.FocusEvent<HTMLInputElement>,
  hasError: boolean,
) {
  e.currentTarget.style.borderColor = hasError ? '#ba1a1a' : '#0A7E8C'
  if (!hasError) e.currentTarget.style.boxShadow = '0 0 0 3px rgba(10,126,140,0.09)'
}

function onBlurStyle(
  e: React.FocusEvent<HTMLInputElement>,
  hasError: boolean,
) {
  e.currentTarget.style.borderColor = hasError ? '#ba1a1a' : 'rgba(10,126,140,0.12)'
  e.currentTarget.style.boxShadow = 'none'
}

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors]     = useState<FieldErrors>({})
  const [loading, setLoading]   = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const clearError = (field: keyof FieldErrors) =>
    setErrors((prev) => ({ ...prev, [field]: undefined }))

  function validate(): FieldErrors {
    const errs: FieldErrors = {}
    if (!name.trim())
      errs.name = 'Ingresá tu nombre'
    if (!email.trim())
      errs.email = 'Ingresá tu email'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = 'Ingresá un email válido (ej: nombre@dominio.com)'
    if (!password)
      errs.password = 'Ingresá una contraseña'
    else if (password.length < 8)
      errs.password = 'La contraseña debe tener al menos 8 caracteres'
    return errs
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setLoading(true)
    setErrors({})

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name.trim() } },
    })
    setLoading(false)

    if (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const code = (error as any).code as string | undefined
      const msg  = error.message.toLowerCase()

      const isEmailTaken =
        code === 'user_already_exists' ||
        msg.includes('already registered') ||
        msg.includes('already exists')

      if (isEmailTaken) {
        setErrors({ email: 'Ya existe una cuenta con ese email.' })
      } else {
        // Fallback genérico — mostrar en email para no perder el mensaje
        setErrors({ email: error.message })
      }
      return
    }

    router.push(`/register/verify?email=${encodeURIComponent(email)}`)
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
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
        {/* Logo — centered */}
        <div className="flex items-center justify-center gap-2.5 mb-9">
          <Image src="/LOGO_CIRCL_1.svg" alt="Circl" width={38} height={38} />
          <span className="text-[1.6rem] font-extrabold text-[#1A1A2E] tracking-tight leading-none">
            Circl
          </span>
        </div>

        <h1 className="text-2xl font-extrabold text-[#1A1A2E] text-center tracking-tight mb-2">
          Creá tu cuenta
        </h1>
        <p className="text-center text-[#5a7478] text-sm mb-8">
          Activá tu círculo de apoyo en minutos.
        </p>

        {/* Google OAuth */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-2.5 bg-white text-[#1A1A2E] font-semibold rounded-full py-3 px-5 mt-1 transition-all disabled:opacity-60 cursor-pointer"
          style={{
            border: '1.5px solid rgba(10,126,140,0.12)',
            transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(10,126,140,0.3)'
            e.currentTarget.style.boxShadow   = '0 2px 12px rgba(10,126,140,0.1)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(10,126,140,0.12)'
            e.currentTarget.style.boxShadow   = 'none'
          }}
        >
          <GoogleIcon />
          {googleLoading ? 'Redirigiendo...' : 'Continuar con Google'}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mt-5 mb-1">
          <div className="flex-1 h-px bg-[rgba(10,126,140,0.12)]" />
          <span className="text-[0.7rem] text-[#5a7478] font-semibold tracking-[0.04em] uppercase">
            o registrate con email
          </span>
          <div className="flex-1 h-px bg-[rgba(10,126,140,0.12)]" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-[18px] mt-5">

          {/* Nombre completo */}
          <div className="flex flex-col gap-[7px]">
            <label htmlFor="nombre" className="text-sm font-semibold text-[#1A1A2E]">
              Nombre completo
            </label>
            <input
              id="nombre"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); clearError('name') }}
              placeholder="Valeria López"
              autoComplete="name"
              className="w-full rounded-2xl px-4 py-3 text-[#1A1A2E] text-sm outline-none transition-all"
              style={inputStyle(!!errors.name)}
              onFocus={(e) => onFocusStyle(e, !!errors.name)}
              onBlur={(e)  => onBlurStyle(e,  !!errors.name)}
            />
            {errors.name && (
              <p className="text-[#ba1a1a] text-xs font-semibold">{errors.name}</p>
            )}
          </div>

          {/* Email */}
          <div className="flex flex-col gap-[7px]">
            <label htmlFor="email" className="text-sm font-semibold text-[#1A1A2E]">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); clearError('email') }}
              placeholder="valeria@mail.com"
              autoComplete="email"
              className="w-full rounded-2xl px-4 py-3 text-[#1A1A2E] text-sm outline-none transition-all"
              style={inputStyle(!!errors.email)}
              onFocus={(e) => onFocusStyle(e, !!errors.email)}
              onBlur={(e)  => onBlurStyle(e,  !!errors.email)}
            />
            {errors.email && (
              <p className="text-[#ba1a1a] text-xs font-semibold">{errors.email}</p>
            )}
          </div>

          {/* Contraseña */}
          <div className="flex flex-col gap-[7px]">
            <label htmlFor="password" className="text-sm font-semibold text-[#1A1A2E]">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearError('password') }}
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              className="w-full rounded-2xl px-4 py-3 text-[#1A1A2E] text-sm outline-none transition-all"
              style={inputStyle(!!errors.password)}
              onFocus={(e) => onFocusStyle(e, !!errors.password)}
              onBlur={(e)  => onBlurStyle(e,  !!errors.password)}
            />
            {errors.password && (
              <p className="text-[#ba1a1a] text-xs font-semibold">{errors.password}</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0A7E8C] text-white font-bold rounded-full py-3 px-6 mt-2 transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? 'Creando cuenta...' : 'Crear mi cuenta'}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center mt-6 text-sm text-[#5a7478]">
          ¿Ya tenés cuenta?{' '}
          <Link
            href="/login"
            className="text-[#0A7E8C] font-semibold underline underline-offset-2 hover:opacity-75"
          >
            Ingresá
          </Link>
        </p>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#EA4335"
        d="M24 9.5c3.14 0 5.95 1.08 8.17 2.84l6.08-6.08C34.42 3.09 29.5 1 24 1 14.82 1 7.03 6.48 3.52 14.22l7.1 5.52C12.3 13.77 17.69 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.52 24.5c0-1.64-.15-3.22-.42-4.75H24v9h12.69c-.55 2.96-2.22 5.47-4.72 7.16l7.18 5.57C43.27 37.56 46.52 31.5 46.52 24.5z"
      />
      <path
        fill="#FBBC05"
        d="M10.62 28.26A14.52 14.52 0 0 1 9.5 24c0-1.48.25-2.91.62-4.26l-7.1-5.52A23.93 23.93 0 0 0 0 24c0 3.88.93 7.54 2.52 10.78l8.1-6.52z"
      />
      <path
        fill="#34A853"
        d="M24 47c6.48 0 11.93-2.14 15.9-5.82l-7.18-5.57C30.6 37.28 27.46 38.5 24 38.5c-6.31 0-11.7-4.27-13.38-10.24l-8.1 6.52C6.03 42.52 14.46 47 24 47z"
      />
    </svg>
  )
}
