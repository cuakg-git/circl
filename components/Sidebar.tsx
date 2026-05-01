'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ─── SVG icons — outline/stroke style matching Material Symbols Outlined ─────
// strokeWidth="1.6" matches the weight=400 / opsz=20 optical size of the font

function IconGrid() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3"    y="3"    width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3"    width="7.5" height="7.5" rx="1.5" />
      <rect x="3"    y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </svg>
  )
}

function IconGroup() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function IconWarning() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9"  x2="12"   y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function IconChat() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function IconPerson() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

// Circl orbit mark — floating button above the mobile bottom nav
function IconCirclOrbit() {
  return (
    <svg viewBox="0 0 680 680" xmlns="http://www.w3.org/2000/svg" width="82" height="82">
      <defs>
        <linearGradient id="circl-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#0A7E8C" />
          <stop offset="100%" stopColor="#2ECDA7" />
        </linearGradient>
      </defs>
      <circle cx="340" cy="340" r="300" fill="url(#circl-grad)" />
      <circle cx="340" cy="340" r="130" fill="none" stroke="white" strokeWidth="22" />
      <circle cx="340" cy="340" r="70"  fill="white" />
    </svg>
  )
}

// ─── Nav items ────────────────────────────────────────────────────────────────

const SIDEBAR_NAV = [
  { label: 'Inicio',  href: '/dashboard', Icon: IconGrid    },
  { label: 'Círculo', href: '/circulo',   Icon: IconGroup   },
  { label: 'Crisis',  href: '/crisis',    Icon: IconWarning },
  { label: 'Hablar',  href: '/chat',      Icon: IconChat    },
]

// Mobile order: Inicio · Crisis · Hablar (center, elevated) · Círculo · Perfil
const BOTTOM_NAV = [
  { label: 'Inicio',  href: '/dashboard', Icon: IconGrid,    center: false },
  { label: 'Crisis',  href: '/crisis',    Icon: IconWarning, center: false },
  { label: 'Hablar',  href: '/chat',      Icon: IconChat,    center: true  },
  { label: 'Círculo', href: '/circulo',   Icon: IconGroup,   center: false },
  { label: 'Perfil',  href: '/profile',   Icon: IconPerson,  center: false },
]

// ─── User info ────────────────────────────────────────────────────────────────

interface UserInfo {
  name:      string
  email:     string
  avatarUrl: string | null
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname()
  const [user, setUser] = useState<UserInfo | null>(null)

  useEffect(() => {
    // ── Initial load ─────────────────────────────────────────────────────────
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      const meta = data.user.user_metadata ?? {}
      setUser({
        name:      meta.full_name ?? data.user.email?.split('@')[0] ?? 'Usuario',
        email:     data.user.email ?? '',
        avatarUrl: meta.avatar_url ?? null,
      })
    })

    // ── Live sync ────────────────────────────────────────────────────────────
    // USER_UPDATED fires whenever supabase.auth.updateUser() is called from
    // any page (e.g. profile/page.tsx after a successful avatar upload).
    // This keeps the sidebar avatar in sync without a page reload.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'USER_UPDATED' && session?.user) {
          const meta = session.user.user_metadata ?? {}
          setUser({
            name:      meta.full_name ?? session.user.email?.split('@')[0] ?? 'Usuario',
            email:     session.user.email ?? '',
            avatarUrl: meta.avatar_url ?? null,
          })
        }
        if (event === 'SIGNED_OUT') setUser(null)
      },
    )

    return () => subscription.unsubscribe()
  }, [])

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  // Maqueta: active/hover → bg: rgba(10,126,140,0.07), color: #0A7E8C
  function sidebarLinkClass(href: string) {
    const active = isActive(href)
    return [
      'flex items-center gap-[11px] px-[14px] py-[11px] rounded-[1rem]',
      'font-semibold text-sm no-underline transition-all duration-[180ms]',
      active
        ? 'bg-[rgba(10,126,140,0.07)] text-[#0A7E8C]'
        : 'text-[#5a7478] hover:bg-[rgba(10,126,140,0.07)] hover:text-[#0A7E8C]',
    ].join(' ')
  }

  // Maqueta: inactive icon opacity 0.65, active 1.0
  function iconOpacity(href: string) {
    return { opacity: isActive(href) ? 1 : 0.65 }
  }

  function bottomItemClass(href: string) {
    return isActive(href) ? 'text-[#0A7E8C]' : 'text-[#5a7478]'
  }

  // Avatar: photo if available, else gradient initials, else skeleton.
  // The image is wrapped in a fixed 48×48 container with overflow:hidden so
  // rectangular photos are always cropped to a centered circle —
  // same pattern as AvatarDisplay in profile/page.tsx.
  const avatar = user ? (
    user.avatarUrl ? (
      <div className="w-12 h-12 rounded-full flex-shrink-0 overflow-hidden">
        <Image
          src={user.avatarUrl}
          alt={user.name}
          width={48}
          height={48}
          className="block rounded-full"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
        />
      </div>
    ) : (
      <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm select-none"
        style={{ background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)' }}>
        {getInitials(user.name)}
      </div>
    )
  ) : (
    <div className="w-12 h-12 rounded-full flex-shrink-0 bg-[rgba(10,126,140,0.10)] animate-pulse" />
  )

  return (
    <>
      {/* ══════════════════════════════════════════════════════════════════
          SIDEBAR — desktop only
      ══════════════════════════════════════════════════════════════════ */}
      <aside
        className="hidden md:flex flex-col fixed left-0 top-0 h-screen w-[240px] z-[100] overflow-y-auto"
        style={{ background: 'rgba(223,120,48,0.04)', borderRight: '1px solid rgba(10,126,140,0.12)' }}
      >
        {/* Brand — matches maqueta: padding 48px top, gap 10px, logo height 32px */}
        <div className="flex items-center justify-center gap-[10px] px-5 pb-6 pt-12 mb-3">
          {/*
            The maqueta sets `height: 32px; width: auto` on the img.
            We pass height={32} and override width to auto via style so the
            SVG's natural aspect ratio is preserved, avoiding any squishing.
          */}
          <Image
            src="/LOGO_CIRCL_2.svg"
            alt="Mhiru"
            width={32}
            height={32}
            style={{ width: 'auto', height: 32 }}
          />
          <span className="text-[1.25rem] font-extrabold text-[#1A1A2E] tracking-[-0.03em] leading-none">
            Mhiru
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 flex flex-col gap-[3px] px-3">
          {SIDEBAR_NAV.map(({ label, href, Icon }) => (
            <Link key={href} href={href} className={sidebarLinkClass(href)}>
              <span className="w-6 h-6 flex-shrink-0" style={iconOpacity(href)}>
                <Icon />
              </span>
              {label}
            </Link>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-5 pt-4 pb-12 mt-3" style={{ borderTop: '1px solid rgba(10,126,140,0.08)' }}>
          <Link href="/profile" className="flex items-center gap-3 no-underline">
            {avatar}
            {user ? (
              <div className="min-w-0">
                <div className="text-sm font-bold text-[#1A1A2E] truncate leading-tight">
                  {user.name}
                </div>
                <div className="text-xs text-[#5a7478] truncate mt-[2px] leading-tight">
                  {user.email}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 flex-1">
                <div className="h-3 w-24 bg-[rgba(10,126,140,0.10)] rounded animate-pulse" />
                <div className="h-2.5 w-32 bg-[rgba(10,126,140,0.07)] rounded animate-pulse" />
              </div>
            )}
          </Link>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════════════
          BOTTOM NAV — mobile only
      ══════════════════════════════════════════════════════════════════ */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white z-[100] overflow-visible"
        style={{
          borderTop:     '1px solid rgba(10,126,140,0.12)',
          paddingTop:    8,
          paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
        }}
      >
        <div className="flex justify-around items-center w-full">
          {BOTTOM_NAV.map(({ label, href, Icon, center }) =>
            center ? (
              // Hablar: floating orbit circle above the bar
              <Link
                key={href}
                href={href}
                className={`relative flex flex-col items-center font-semibold text-[0.65rem] transition-colors duration-[180ms] ${bottomItemClass(href)}`}
                style={{ paddingTop: 32, paddingBottom: 4, paddingLeft: 14, paddingRight: 14 }}
              >
                <span className="absolute left-1/2 -translate-x-1/2" style={{ top: -52 }} aria-hidden>
                  <IconCirclOrbit />
                </span>
                {label}
              </Link>
            ) : (
              // Regular item
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-[3px] px-[14px] py-1 font-semibold text-[0.65rem] transition-colors duration-[180ms] ${bottomItemClass(href)}`}
              >
                <span className="w-[22px] h-[22px] flex items-center justify-center">
                  <Icon />
                </span>
                {label}
              </Link>
            )
          )}
        </div>
      </nav>
    </>
  )
}
