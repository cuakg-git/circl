'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface InviteData {
  email:            string
  shared_case_name: string
  invited_by_name:  string
  shared_case_id:   string
  member_id:        string
}

type PageState = 'loading' | 'invalid' | 'pending_auth' | 'ready' | 'success'

// ─── SVG helpers ──────────────────────────────────────────────────────────────

function IconWarning() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
      stroke="#E8913A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function MhiruLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 28 }}>
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
  )
}

function Divider() {
  return (
    <div style={{
      height: 1,
      background: 'rgba(10,126,140,0.10)',
      margin: '24px 0',
    }} />
  )
}

// ─── Card shell ───────────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#FAF8F5',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'var(--font-plus-jakarta-sans), sans-serif',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background blobs */}
      <div style={{
        position: 'absolute', borderRadius: '50%',
        pointerEvents: 'none',
        width: 500, height: 500,
        top: -120, right: -120,
        background: 'radial-gradient(circle, rgba(10,126,140,0.07) 0%, transparent 70%)',
      }} />
      <div style={{
        position: 'absolute', borderRadius: '50%',
        pointerEvents: 'none',
        width: 320, height: 320,
        bottom: -80, left: -80,
        background: 'radial-gradient(circle, rgba(46,205,167,0.07) 0%, transparent 70%)',
      }} />
      {/* Decorative rings */}
      <div style={{
        position: 'absolute', borderRadius: '50%',
        pointerEvents: 'none',
        width: 380, height: 380,
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        border: '1.5px solid rgba(10,126,140,0.08)',
      }} />
      <div style={{
        position: 'absolute', borderRadius: '50%',
        pointerEvents: 'none',
        width: 560, height: 560,
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        border: '1px solid rgba(10,126,140,0.05)',
      }} />
      {/* Card */}
      <div style={{
        position: 'relative', zIndex: 10,
        width: '100%',
        maxWidth: 440,
        background: '#ffffff',
        borderRadius: '1.5rem',
        boxShadow: '0 4px 32px rgba(10,126,140,0.10)',
        padding: '40px',
      }}>
        {children}
      </div>
    </div>
  )
}

// ─── State: LOADING ───────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f0f4f8',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: 280,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}>
        <div style={{ height: 28, borderRadius: 8, background: 'rgba(10,126,140,0.08)', animation: 'pulse 1.5s infinite' }} />
        <div style={{ height: 16, borderRadius: 8, background: 'rgba(10,126,140,0.06)', animation: 'pulse 1.5s infinite', width: '70%' }} />
        <div style={{ height: 16, borderRadius: 8, background: 'rgba(10,126,140,0.06)', animation: 'pulse 1.5s infinite', width: '50%' }} />
        <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }`}</style>
      </div>
    </div>
  )
}

// ─── State: INVALID ───────────────────────────────────────────────────────────

const INVALID_COPY: Record<string, { title: string; description: string }> = {
  'Invitación no encontrada': {
    title:       'Este link no es válido',
    description: 'El link de invitación no existe o fue eliminado. Pedile al invitador que te envíe uno nuevo.',
  },
  'Invitación ya utilizada': {
    title:       'Este link ya fue usado',
    description: 'Esta invitación ya fue aceptada. Si necesitás acceso, contactá a quien te invitó.',
  },
  'Invitación vencida': {
    title:       'Este link venció',
    description: 'La invitación expiró. Pedile al invitador que te envíe un link nuevo.',
  },
}

function InvalidState({ message }: { message: string }) {
  const copy = INVALID_COPY[message] ?? {
    title:       'Este link no es válido',
    description: 'No pudimos verificar tu invitación. Revisá el link o pedí uno nuevo.',
  }

  return (
    <Card>
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: 20 }}>
          <IconWarning />
        </div>
        <h1 style={{
          fontSize: '1.25rem',
          fontWeight: 800,
          color: '#1A1A2E',
          letterSpacing: '-0.02em',
          marginBottom: 10,
        }}>
          {copy.title}
        </h1>
        <p style={{
          fontSize: '0.9375rem',
          color: '#5a7478',
          lineHeight: 1.6,
          marginBottom: 28,
        }}>
          {copy.description}
        </p>
        <Link href="/login" style={{
          display: 'inline-block',
          fontSize: '0.875rem',
          fontWeight: 700,
          color: '#0A7E8C',
          textDecoration: 'none',
        }}>
          Ir al inicio →
        </Link>
      </div>
    </Card>
  )
}

// ─── State: PENDING_AUTH ──────────────────────────────────────────────────────

function PendingAuthState({ invite, token }: { invite: InviteData; token: string }) {
  return (
    <Card>
      <MhiruLogo />

      <p style={{
        fontSize: '0.9375rem',
        color: '#5a7478',
        textAlign: 'center',
        marginBottom: 8,
      }}>
        <strong style={{ color: '#1A1A2E' }}>{invite.invited_by_name}</strong> te invitó a sumarte a
      </p>
      <p style={{
        fontSize: '1.375rem',
        fontWeight: 800,
        color: '#1A1A2E',
        letterSpacing: '-0.02em',
        lineHeight: 1.2,
        textAlign: 'center',
        marginBottom: 0,
      }}>
        {invite.shared_case_name}
      </p>

      <Divider />

      <p style={{
        fontSize: '0.9375rem',
        color: '#5a7478',
        lineHeight: 1.6,
        textAlign: 'center',
        marginBottom: 24,
      }}>
        Para aceptar la invitación necesitás una cuenta en Mhiru.
      </p>

      <Link
        href={`/register?invite=${token}`}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'center',
          background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
          color: '#ffffff',
          fontWeight: 700,
          fontSize: '0.9375rem',
          textDecoration: 'none',
          padding: '13px 24px',
          borderRadius: 9999,
          marginBottom: 14,
        }}
      >
        Crear cuenta
      </Link>

      <div style={{ textAlign: 'center' }}>
        <Link
          href={`/login?invite=${token}`}
          style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: '#0A7E8C',
            textDecoration: 'none',
          }}
        >
          Ya tengo cuenta
        </Link>
      </div>
    </Card>
  )
}

// ─── State: READY ─────────────────────────────────────────────────────────────

function ReadyState({
  invite,
  token,
  userEmail,
}: {
  invite:    InviteData
  token:     string
  userEmail: string
}) {
  const router = useRouter()
  const [loading, setLoading]   = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleAccept() {
    setLoading(true)
    setErrorMsg(null)

    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = session?.access_token ?? ''

    const res = await fetch(`/api/invitacion/${token}`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    const data = await res.json()

    if (res.ok) {
      router.push(`/case/shared/${data.shared_case_id}`)
      return
    }

    if (res.status === 403) {
      setErrorMsg('Este link no corresponde a tu cuenta.')
    } else {
      setErrorMsg(data.error ?? 'Ocurrió un error. Intentá de nuevo.')
    }

    setLoading(false)
  }

  return (
    <Card>
      <MhiruLogo />

      <p style={{
        fontSize: '0.9375rem',
        color: '#5a7478',
        textAlign: 'center',
        marginBottom: 8,
      }}>
        <strong style={{ color: '#1A1A2E' }}>{invite.invited_by_name}</strong> te invitó a sumarte a
      </p>
      <p style={{
        fontSize: '1.375rem',
        fontWeight: 800,
        color: '#1A1A2E',
        letterSpacing: '-0.02em',
        lineHeight: 1.2,
        textAlign: 'center',
        marginBottom: 8,
      }}>
        {invite.shared_case_name}
      </p>
      <p style={{
        fontSize: '0.8125rem',
        color: '#5a7478',
        textAlign: 'center',
        marginBottom: 0,
      }}>
        {userEmail}
      </p>

      <Divider />

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

      <button
        onClick={handleAccept}
        disabled={loading}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'center',
          background: loading
            ? 'rgba(10,126,140,0.35)'
            : 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
          color: '#ffffff',
          fontWeight: 700,
          fontSize: '0.9375rem',
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          padding: '13px 24px',
          borderRadius: 9999,
          fontFamily: 'inherit',
          transition: 'opacity 0.15s',
        }}
      >
        {loading ? 'Aceptando…' : 'Aceptar invitación'}
      </button>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InvitacionPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const [state,     setState]     = useState<PageState>('loading')
  const [invite,    setInvite]    = useState<InviteData | null>(null)
  const [invalidMsg, setInvalidMsg] = useState<string>('')
  const [userEmail, setUserEmail] = useState<string>('')

  useEffect(() => {
    async function init() {
      // 1. Fetch invitación
      const res  = await fetch(`/api/invitacion/${token}`)
      const data = await res.json()

      if (!res.ok) {
        setInvalidMsg(data.error ?? 'Invitación no encontrada')
        setState('invalid')
        return
      }

      setInvite(data as InviteData)

      // 2. Verificar sesión
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setState('pending_auth')
        return
      }

      setUserEmail(session.user.email ?? '')
      setState('ready')
    }

    init()
  }, [token])

  if (state === 'loading')      return <LoadingState />
  if (state === 'invalid')      return <InvalidState message={invalidMsg} />
  if (state === 'pending_auth') return <PendingAuthState invite={invite!} token={token} />
  if (state === 'ready')        return <ReadyState invite={invite!} token={token} userEmail={userEmail} />

  // success — redirigiendo, no renderizar nada
  return null
}
