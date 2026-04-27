'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'

// ─── Page ─────────────────────────────────────────────────────────────────────
//
// Supabase email flows redirect here after the user clicks the link:
//
//   PKCE flow (default in @supabase/supabase-js v2):
//     ?code=AUTHORIZATION_CODE&type=signup|recovery
//     → must call exchangeCodeForSession(code) to mint the session
//
//   Implicit flow (legacy / older configs):
//     #access_token=...&type=signup|recovery
//     → Supabase JS client auto-detects the hash and sets the session
//
//   Error case (Supabase sends back to redirect URL with ?error=...):
//     ?error=access_denied&error_description=...
//
// After the session is established, the user is routed to:
//   type === 'recovery'  →  /reset-password   (set new password form)
//   everything else      →  /onboarding        (new account welcome flow)
//   any error            →  /login?error=...

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    async function handleCallback() {
      // Read both search params and hash fragment (handle both PKCE + implicit)
      const searchParams = new URLSearchParams(window.location.search)
      const hashParams   = new URLSearchParams(window.location.hash.replace(/^#/, ''))

      // ── Error from Supabase ──────────────────────────────────────────────────
      const supabaseError = searchParams.get('error') ?? hashParams.get('error')
      if (supabaseError) {
        const desc = searchParams.get('error_description') ?? hashParams.get('error_description') ?? supabaseError
        router.replace(`/login?error=${encodeURIComponent(desc)}`)
        return
      }

      // ── Determine flow type ──────────────────────────────────────────────────
      // type is 'signup' | 'recovery' | 'magiclink' | 'invite' | null
      const type = searchParams.get('type') ?? hashParams.get('type')
      const code = searchParams.get('code')

      // ── PKCE flow: exchange the one-time code for a session ──────────────────
      if (code) {
        const { error: exchError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchError) {
          router.replace('/login?error=verification_failed')
          return
        }
      }
      // Implicit flow: hash contains access_token — Supabase JS auto-handles it.
      // No explicit action needed; getSession() would now return the session.

      // ── Route to the correct destination ────────────────────────────────────
      if (type === 'recovery') {
        // Password-reset flow → let the user set a new password
        router.replace('/reset-password')
      } else {
        // signup, magiclink, invite → new-account welcome flow
        router.replace('/onboarding')
      }
    }

    handleCallback()
  }, [router])

  // ── Loading screen ──────────────────────────────────────────────────────────
  // Shown while the code exchange and redirect are in flight.
  // Uses the same animated-gradient background as all other auth pages.
  return (
    <>
      <style>{`
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
          50% {
            background:
              radial-gradient(ellipse at 10% 22%, rgba(61,199,166,0.03) 0%, transparent 55%),
              radial-gradient(ellipse at 78%  8%, rgba(80,220,175,0.07) 0%, transparent 50%),
              radial-gradient(ellipse at 92% 75%, rgba(224,121,49,0.08) 0%, transparent 52%),
              radial-gradient(ellipse at 18% 92%, rgba(158,160,81,0.08) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 65%),
              #f0f4f8;
          }
        }
        .cb-bg { animation: heroBgDrift 30s ease-in-out infinite; }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .cb-spinner {
          width: 36px;
          height: 36px;
          border: 3px solid rgba(10, 126, 140, 0.15);
          border-top-color: #0A7E8C;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
      `}</style>

      <div className="cb-bg min-h-screen flex flex-col items-center justify-center gap-6 px-4">
        {/* Logo */}
        <div className="flex items-center gap-[10px]">
          <Image
            src="/LOGO_CIRCL_1.svg"
            alt="Circl"
            width={36}
            height={36}
            style={{ width: 'auto', height: 36 }}
          />
          <span
            style={{
              fontSize:      '1.4rem',
              fontWeight:    800,
              color:         '#1A1A2E',
              letterSpacing: '-0.03em',
              lineHeight:    1,
            }}
          >
            Circl
          </span>
        </div>

        {/* Spinner */}
        <div className="cb-spinner" role="status" aria-label="Verificando…" />

        {/* Label */}
        <p
          style={{
            fontSize:   '0.875rem',
            color:      '#5a7478',
            fontWeight: 500,
          }}
        >
          Verificando…
        </p>
      </div>
    </>
  )
}
