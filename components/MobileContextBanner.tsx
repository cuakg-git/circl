'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function MobileContextBanner() {
  const pathname = usePathname()
  const [pending,  setPending]  = useState(false)
  const [updating, setUpdating] = useState(false)
  const [mounted,  setMounted]  = useState(false)

  // Leer estado inicial desde localStorage (solo cliente, post-mount)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPending(localStorage.getItem('mhiru:context-pending') === 'true')
    }
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  // Escuchar eventos
  useEffect(() => {
    function onStale()   { setPending(true)  }
    function onCleared() { setPending(false) }
    window.addEventListener('mhiru:context-stale',   onStale)
    window.addEventListener('mhiru:context-cleared', onCleared)
    return () => {
      window.removeEventListener('mhiru:context-stale',   onStale)
      window.removeEventListener('mhiru:context-cleared', onCleared)
    }
  }, [])

  async function handleUpdate() {
    if (updating) return
    setUpdating(true)
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''
      await fetch('/api/user-context/regenerate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      })
      setPending(false)
      if (typeof window !== 'undefined') {
        localStorage.removeItem('mhiru:context-pending')
      }
      window.dispatchEvent(new CustomEvent('mhiru:context-regenerated'))
    } catch {
      // silenciar
    } finally {
      setUpdating(false)
    }
  }

  // No mostrar en páginas públicas o de profile
  const PUBLIC_PATHS = [
    '/login',
    '/register',
    '/onboarding',
    '/forgot-password',
    '/reset-password',
    '/change-password',
    '/profile',
  ]

  const isPublicPath = PUBLIC_PATHS.some(p =>
    pathname === p || pathname.startsWith(p + '/')
  )

  if (isPublicPath) return null

  return (
    <div className="md:hidden">
      <div
        style={{
          position: mounted && pending ? 'relative' : 'absolute',
          top: mounted && pending ? undefined : 10,
          width: '100%',
          background: mounted && pending ? '#E8913A' : 'transparent',
          padding: '8px 16px',
          alignItems: 'center',
          justifyContent: mounted && pending ? 'space-between' : 'flex-end',
          zIndex: 50,
          gap: 10,
          transition: 'background 0.3s ease',
          minHeight: 52,
          flexDirection: 'row',
        }}
        className="flex"
      >
      {/* Texto + botón — solo cuando hay pendiente */}
      {mounted && pending && (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center',
          flexWrap: 'wrap', gap: 8,
        }}>
          <span style={{
            fontSize: '0.7rem', color: 'white',
            fontWeight: 600, lineHeight: 1.4,
          }}>
            Hay cambios sin reflejar en tu contexto.
          </span>
          <button
            type="button"
            onClick={handleUpdate}
            disabled={updating}
            style={{
              padding: '4px 12px',
              background: 'white',
              border: 'none',
              borderRadius: 9999,
              fontSize: '0.7rem',
              fontWeight: 700,
              color: '#b86a10',
              cursor: updating ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              opacity: updating ? 0.6 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {updating ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      )}

      {/* Avatar — siempre visible */}
      <a href="/profile" style={{ textDecoration: 'none', flexShrink: 0 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: mounted && pending
            ? '2px solid rgba(255,255,255,0.6)'
            : '2px solid rgba(10,126,140,0.20)',
          background: mounted && pending
            ? 'rgba(255,255,255,0.25)'
            : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'border-color 0.3s ease, background 0.3s ease',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24"
            fill="none" stroke={mounted && pending ? 'white' : '#0A7E8C'} strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
      </a>
      </div>
    </div>
  )
}
