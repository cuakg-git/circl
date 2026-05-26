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
      console.log('[CALLBACK] start', window.location.href)
      const searchParams = new URLSearchParams(window.location.search)
      const hashParams   = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      console.log('[CALLBACK] code:', searchParams.get('code'))
      console.log('[CALLBACK] type:', searchParams.get('type'))
      console.log('[CALLBACK] error:', searchParams.get('error'))

      // Error from Supabase
      const supabaseError = searchParams.get('error') ?? hashParams.get('error')
      if (supabaseError) {
        const desc = searchParams.get('error_description')
          ?? hashParams.get('error_description')
          ?? supabaseError
        window.location.href = `/login?error=${encodeURIComponent(desc)}`
        return
      }

      const type = searchParams.get('type') ?? hashParams.get('type')
      const code = searchParams.get('code')

      // PKCE flow — exchange code ONCE
      if (code) {
        console.log('[CALLBACK] exchanging code...')
        const { data, error: exchError } = await supabase.auth.exchangeCodeForSession(code)
        console.log('[CALLBACK] exchange result:', { data, error: exchError })
        if (exchError) {
          console.log('[CALLBACK] exchange failed:', exchError.message)
          window.location.href = '/login?error=verification_failed'
          return
        }
      } else if (window.location.hash.includes('access_token')) {
        console.log('[CALLBACK] implicit flow detected, getting session...')
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
        console.log('[CALLBACK] getSession result:', { session: sessionData?.session, error: sessionErr })
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      // Recovery flow
      if (type === 'recovery') {
        window.location.href = '/reset-password'
        return
      }

      // Get user after session is established
      console.log('[CALLBACK] getting user...')
      const { data: { user }, error: userErr } = await supabase.auth.getUser()
      console.log('[CALLBACK] user result:', { user, error: userErr })
      if (!user) {
        console.log('[CALLBACK] NO USER, redirecting to /login?error=no_user')
        window.location.href = '/login?error=no_user'
        return
      }

      console.log('[CALLBACK] fetching profile...')
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('id, avatar_url, onboarding_completed')
        .eq('id', user.id)
        .single()
      console.log('[CALLBACK] profile result:', { profile, error: profileErr })

      // Sync Google avatar
      if (!profile?.avatar_url) {
        const googleAvatar = user?.user_metadata?.avatar_url
        const googleName   = user?.user_metadata?.full_name
          ?? user?.user_metadata?.name
        if (googleAvatar) {
          await supabase
            .from('profiles')
            .update({
              avatar_url: googleAvatar,
              ...(googleName ? { display_name: googleName } : {}),
            })
            .eq('id', user.id)
        }
      }

      // Check for invite token
      const inviteToken = searchParams.get('invite')

      if (inviteToken) {
        console.log('[CALLBACK] invite token found:', inviteToken)
        if (!profile?.onboarding_completed) {
          console.log('[CALLBACK] redirecting to /onboarding/invitado')
          window.location.href = `/onboarding/invitado?token=${inviteToken}`
        } else {
          console.log('[CALLBACK] user already onboarded, accepting invitation...')
          try {
            const { data: { session } } = await supabase.auth.getSession()
            const accessToken = session?.access_token ?? ''
            const res = await fetch(`/api/invitacion/${inviteToken}`, {
              method:  'POST',
              headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${accessToken}`,
              },
            })
            const data = await res.json()
            console.log('[CALLBACK] invitation response:', { ok: res.ok, data })
            if (res.ok && data.shared_case_id) {
              console.log('[CALLBACK] redirecting to /case/shared/' + data.shared_case_id)
              window.location.href = `/case/shared/${data.shared_case_id}`
            } else {
              console.log('[CALLBACK] invitation failed or no shared_case_id, redirecting to /dashboard')
              window.location.href = '/dashboard'
            }
          } catch (err) {
            console.log('[CALLBACK] exception accepting invitation:', err)
            window.location.href = '/dashboard'
          }
        }
        return
      }

      // No invite token
      if (!profile?.onboarding_completed) {
        console.log('[CALLBACK] redirecting to /onboarding (no profile or onboarding incomplete)')
        window.location.href = '/onboarding'
      } else {
        console.log('[CALLBACK] redirecting to /dashboard')
        window.location.href = '/dashboard'
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
            alt="Mhiru"
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
            Mhiru
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
