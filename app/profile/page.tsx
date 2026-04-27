'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import Sidebar from '@/components/Sidebar'

// ─── Icons ────────────────────────────────────────────────────────────────────
// Same system as Sidebar: fill="none" stroke="currentColor" strokeWidth="1.6"
// Size: 20×20 to match Material Symbols Outlined opsz=20 used in the maqueta

function IconPerson() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A7E8C" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function IconMail() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A7E8C" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 7 10-7" />
    </svg>
  )
}

function IconLocation() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A7E8C" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

// Heart icon — Lucide outline heart (obra social / salud)
function IconHeart() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A7E8C" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function IconChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserData {
  name:        string
  email:       string
  location:    string
  obra_social: string
  avatarUrl:   string | null
}

type EditField = 'name' | 'email' | 'location' | 'obra_social'

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Teal-wash circle icon container — 34×34px, matching .data-icon in the maqueta:
 *   width: 34px; height: 34px; border-radius: 50%; background: var(--color-teal-wash)
 */
function DataIcon({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="w-[34px] h-[34px] rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: 'rgba(10,126,140,0.07)' }}
    >
      {children}
    </div>
  )
}

/** Border used between card rows — matches var(--color-border) */
const rowBorder = { borderBottom: '1px solid rgba(10,126,140,0.12)' }

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter()

  const [userId,    setUserId]    = useState<string>('')
  const [userData,  setUserData]  = useState<UserData | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [editing,   setEditing]   = useState<EditField | null>(null)
  const [fieldVal,  setFieldVal]  = useState('')
  const [saving,    setSaving]    = useState(false)
  const [saveError, setSaveError] = useState('')
  const [toast,     setToast]     = useState<{ msg: string; ok: boolean } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Fetch user ───────────────────────────────────────────────────────────────
  // name + email + avatarUrl  → supabase.auth.getUser()
  // location + health_insurance → profiles table (by UID)
  useEffect(() => {
    async function load() {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) { router.push('/login'); return }

      const uid = authData.user.id
      const m   = authData.user.user_metadata ?? {}

      // Fetch location and health_insurance from the profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('location, health_insurance')
        .eq('id', uid)
        .single()

      setUserId(uid)
      setUserData({
        name:        m.full_name               ?? '',
        email:       authData.user.email        ?? '',
        location:    profile?.location          ?? '',
        obra_social: profile?.health_insurance  ?? '',
        avatarUrl:   m.avatar_url               ?? null,
      })
      setLoading(false)
    }
    load()
  }, [router])

  // ── Toast ────────────────────────────────────────────────────────────────────
  function showToast(msg: string, ok: boolean) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, ok })
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }

  // ── Edit helpers ─────────────────────────────────────────────────────────────
  function startEdit(field: EditField) {
    if (!userData) return
    const val = { name: userData.name, email: userData.email, location: userData.location, obra_social: userData.obra_social }[field]
    setEditing(field)
    setFieldVal(val)
    setSaveError('')
  }

  function cancelEdit() {
    setEditing(null)
    setSaveError('')
  }

  async function saveField() {
    if (!userData || !editing) return
    setSaving(true)
    setSaveError('')

    const trimmed = fieldVal.trim()

    // name + email → supabase.auth.updateUser()
    // location + obra_social (health_insurance) → profiles table UPDATE by UID
    const { error } =
      editing === 'email'
        ? await supabase.auth.updateUser({ email: trimmed })
        : editing === 'name'
          ? await supabase.auth.updateUser({ data: { full_name: trimmed } })
          : editing === 'location'
            ? await supabase.from('profiles').update({ location: trimmed }).eq('id', userId)
            : await supabase.from('profiles').update({ health_insurance: trimmed }).eq('id', userId)

    setSaving(false)

    if (error) {
      setSaveError(error.message)
      showToast('No se pudo guardar. Intentá de nuevo.', false)
      return
    }

    setUserData((prev) => {
      if (!prev) return prev
      if (editing === 'email')       return { ...prev, email: trimmed }
      if (editing === 'name')        return { ...prev, name: trimmed }
      if (editing === 'location')    return { ...prev, location: trimmed }
      if (editing === 'obra_social') return { ...prev, obra_social: trimmed }
      return prev
    })

    setEditing(null)
    showToast(
      editing === 'email'
        ? 'Revisá tu casilla para confirmar el nuevo email.'
        : 'Cambios guardados.',
      true,
    )
  }

  // ── Sign out ─────────────────────────────────────────────────────────────────
  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ── Avatar ───────────────────────────────────────────────────────────────────
  // Maqueta: width/height 96px, gradient bg, font-size 1.75rem, font-weight 800
  //          box-shadow: var(--shadow-float), outline: 4px solid rgba(46,205,167,0.2)
  function Avatar() {
    const sharedStyle: React.CSSProperties = {
      boxShadow:     '0 8px 40px rgba(10,126,140,0.16)',
      outline:       '4px solid rgba(46,205,167,0.2)',
      outlineOffset: '4px',
    }
    if (loading) {
      return <div className="w-[96px] h-[96px] rounded-full bg-[rgba(10,126,140,0.10)] animate-pulse mb-4" />
    }
    if (userData?.avatarUrl) {
      return (
        <Image
          src={userData.avatarUrl}
          alt={userData.name}
          width={96}
          height={96}
          className="rounded-full object-cover mb-4"
          style={sharedStyle}
        />
      )
    }
    return (
      <div
        className="w-[96px] h-[96px] rounded-full flex items-center justify-center text-white mb-4"
        style={{
          background:  'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
          fontWeight:  800,
          fontSize:    '1.75rem',
          ...sharedStyle,
        }}
      >
        {getInitials(userData?.name ?? '?')}
      </div>
    )
  }

  // ── Data row ─────────────────────────────────────────────────────────────────
  // Maqueta: display flex; align-items center; gap 16px; padding 14px 0;
  //          border-bottom: 1px solid var(--color-border)  (except last-child)
  function DataRow({
    field, label, icon, placeholder, isLast = false,
  }: {
    field:       EditField
    label:       string
    icon:        React.ReactNode
    placeholder: string
    isLast?:     boolean
  }) {
    const value    = userData?.[field] ?? ''
    const isActive = editing === field

    return (
      <div
        className={[
          'flex gap-4 py-[14px]',
          isActive ? 'items-start' : 'items-center',
        ].join(' ')}
        style={isLast ? {} : rowBorder}
      >
        <DataIcon>{icon}</DataIcon>

        <div className="flex-1 min-w-0">
          {/* data-label: font-size var(--text-xs); color var(--color-muted); margin-bottom 1px */}
          <div className="text-[0.7rem] text-[#5a7478] mb-[1px]">{label}</div>

          {isActive ? (
            <>
              <input
                type={field === 'email' ? 'email' : 'text'}
                value={fieldVal}
                onChange={(e) => { setFieldVal(e.target.value); setSaveError('') }}
                placeholder={placeholder}
                autoFocus
                className="w-full rounded-xl px-3 py-2 text-sm text-[#1A1A2E] outline-none transition-all"
                style={{
                  background: '#FAF8F5',
                  border:     '1.5px solid #0A7E8C',
                  boxShadow:  '0 0 0 3px rgba(10,126,140,0.09)',
                }}
              />
              {saveError && (
                <p className="text-[#ba1a1a] text-xs font-semibold mt-1">{saveError}</p>
              )}
              <div className="flex items-center gap-3 mt-2">
                <button
                  type="button"
                  onClick={saveField}
                  disabled={saving}
                  className="bg-[#0A7E8C] text-white text-xs font-bold px-4 py-1.5 rounded-full transition-all hover:brightness-110 disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="text-xs font-semibold text-[#5a7478] hover:text-[#1A1A2E] transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            /* data-value: font-size var(--text-sm); font-weight 600; color var(--color-dark) */
            <div className="text-sm font-semibold text-[#1A1A2E]">
              {value || <span className="text-[#b0bfc2] font-normal italic">Sin completar</span>}
            </div>
          )}
        </div>

        {/* edit-btn: color teal; font-size var(--text-xs); font-weight 700;
            padding 5px 10px; border-radius var(--radius-sm) = 0.6rem */}
        {!isActive && (
          <button
            type="button"
            onClick={() => startEdit(field)}
            className="text-[#0A7E8C] text-[0.7rem] font-bold px-[10px] py-[5px] rounded-[0.6rem] hover:bg-[rgba(10,126,140,0.07)] transition-colors flex-shrink-0 cursor-pointer"
          >
            Editar
          </button>
        )}
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes heroBgDrift {
          0%,100% {
            background:
              radial-gradient(ellipse at 15% 15%, rgba(61,199,166,0.03)  0%,transparent 55%),
              radial-gradient(ellipse at 85% 10%, rgba(80,220,175,0.07)  0%,transparent 50%),
              radial-gradient(ellipse at 88% 82%, rgba(224,121,49,0.08)  0%,transparent 52%),
              radial-gradient(ellipse at 12% 88%, rgba(158,160,81,0.08)  0%,transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%,transparent 65%),
              #f0f4f8;
          }
          25% {
            background:
              radial-gradient(ellipse at 22% 10%, rgba(61,199,166,0.03)  0%,transparent 55%),
              radial-gradient(ellipse at 90% 20%, rgba(80,220,175,0.07)  0%,transparent 50%),
              radial-gradient(ellipse at 80% 88%, rgba(224,121,49,0.08)  0%,transparent 52%),
              radial-gradient(ellipse at  6% 78%, rgba(158,160,81,0.08)  0%,transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%,transparent 65%),
              #f0f4f8;
          }
          50% {
            background:
              radial-gradient(ellipse at 10% 22%, rgba(61,199,166,0.03)  0%,transparent 55%),
              radial-gradient(ellipse at 78%  8%, rgba(80,220,175,0.07)  0%,transparent 50%),
              radial-gradient(ellipse at 92% 75%, rgba(224,121,49,0.08)  0%,transparent 52%),
              radial-gradient(ellipse at 18% 92%, rgba(158,160,81,0.08)  0%,transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%,transparent 65%),
              #f0f4f8;
          }
          75% {
            background:
              radial-gradient(ellipse at 20% 22%, rgba(61,199,166,0.03)  0%,transparent 55%),
              radial-gradient(ellipse at 82% 18%, rgba(80,220,175,0.07)  0%,transparent 50%),
              radial-gradient(ellipse at 85% 90%, rgba(224,121,49,0.08)  0%,transparent 52%),
              radial-gradient(ellipse at 14% 82%, rgba(158,160,81,0.08)  0%,transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%,transparent 65%),
              #f0f4f8;
          }
        }
        .profile-bg { animation: heroBgDrift 30s ease-in-out infinite; }
      `}</style>

      <div className="profile-bg flex min-h-screen">
        <Sidebar />

        {/* ── Main content ───────────────────────────────────────────────────
            Maqueta: margin-left 240px; padding 40px 44px (desktop)
                     mobile: margin-left 0; padding 24px 18px 88px
        ─────────────────────────────────────────────────────────────────── */}
        <main className="flex-1 ml-0 md:ml-[240px] px-[18px] py-6 pb-24 md:px-[44px] md:py-[40px] md:pb-[40px]">
          <div className="max-w-[680px]">

            {/* ── Toast notification ───────────────────────────────────── */}
            {toast && (
              <div
                className="flex items-center gap-2.5 rounded-2xl px-4 py-3 mb-6 text-sm font-semibold"
                style={
                  toast.ok
                    ? { background: 'rgba(46,205,167,0.08)', border: '1px solid rgba(46,205,167,0.25)', color: '#0A7E8C' }
                    : { background: 'rgba(186,26,26,0.05)',  border: '1px solid rgba(186,26,26,0.2)',   color: '#ba1a1a' }
                }
              >
                {toast.ok && <span className="flex-shrink-0"><IconCheck /></span>}
                {toast.msg}
              </div>
            )}

            {/* ── Profile hero ─────────────────────────────────────────────
                Maqueta .profile-hero: flex-col; align-items center;
                text-align center; padding: 40px 0 40px
            ─────────────────────────────────────────────────────────────── */}
            <div className="flex flex-col items-center text-center py-10">
              <Avatar />
              {loading ? (
                <>
                  <div className="h-6 w-40 bg-[rgba(10,126,140,0.10)] rounded-lg animate-pulse mb-[4px]" />
                  <div className="h-4 w-52 bg-[rgba(10,126,140,0.07)] rounded   animate-pulse" />
                </>
              ) : (
                <>
                  {/* .profile-name: font-size 1.5rem; font-weight 800;
                      letter-spacing -0.025em; margin-bottom 4px */}
                  <div className="text-[1.5rem] font-extrabold text-[#1A1A2E] tracking-[-0.025em] leading-tight mb-[4px]">
                    {userData?.name || 'Sin nombre'}
                  </div>
                  {/* .profile-email: font-size var(--text-sm); color var(--color-muted) */}
                  <div className="text-sm text-[#5a7478]">{userData?.email}</div>
                </>
              )}
            </div>

            {/* ── Datos personales ─────────────────────────────────────────
                Maqueta: margin-bottom var(--space-xl) = 40px
                .card: padding 24px; border-radius 1.5rem;
                       box-shadow 0 4px 24px rgba(10,126,140,0.08)
            ─────────────────────────────────────────────────────────────── */}
            <div className="mb-10">
              {/* .section-title: text-xs; font-weight 700; tracking 0.12em;
                  uppercase; color muted; margin-bottom 16px */}
              <p className="text-[0.7rem] font-bold tracking-[0.12em] uppercase text-[#5a7478] mb-4">
                Datos personales
              </p>
              <div
                className="bg-white p-6"
                style={{ borderRadius: '1.5rem', boxShadow: '0 4px 24px rgba(10,126,140,0.08)' }}
              >
                {loading ? (
                  <div className="flex flex-col gap-5">
                    {[140, 180, 120, 160].map((w, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <div className="w-[34px] h-[34px] rounded-full bg-[rgba(10,126,140,0.10)] animate-pulse flex-shrink-0" />
                        <div className="flex flex-col gap-1.5 flex-1">
                          <div className="h-2.5 w-16 bg-[rgba(10,126,140,0.07)] rounded animate-pulse" />
                          <div className="h-3.5 bg-[rgba(10,126,140,0.10)] rounded animate-pulse" style={{ width: w }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <DataRow field="name"       label="Nombre completo" icon={<IconPerson />}   placeholder="Tu nombre completo" />
                    <DataRow field="email"       label="Email"           icon={<IconMail />}     placeholder="tu@email.com" />
                    <DataRow field="location"    label="Ubicación"       icon={<IconLocation />} placeholder="Ej: CABA, Argentina" />
                    <DataRow field="obra_social" label="Obra social"     icon={<IconHeart />}    placeholder="Ej: OSDE 210" isLast />
                  </>
                )}
              </div>
            </div>

            {/* ── Cuenta ───────────────────────────────────────────────────
                Maqueta .account-row: padding 15px 0; border-bottom 1px solid border
            ─────────────────────────────────────────────────────────────── */}
            <div className="mb-10">
              <p className="text-[0.7rem] font-bold tracking-[0.12em] uppercase text-[#5a7478] mb-4">
                Cuenta
              </p>
              <div
                className="bg-white p-6"
                style={{ borderRadius: '1.5rem', boxShadow: '0 4px 24px rgba(10,126,140,0.08)' }}
              >
                {/* Cambiar contraseña */}
                <Link
                  href="/change-password"
                  className="flex items-center justify-between py-[15px] no-underline group"
                  style={rowBorder}
                >
                  <span className="text-sm font-semibold text-[#1A1A2E] group-hover:text-[#0A7E8C] transition-colors">
                    Cambiar contraseña
                  </span>
                  <span className="text-[#5a7478] group-hover:text-[#0A7E8C] transition-colors">
                    <IconChevronRight />
                  </span>
                </Link>

                {/* Cerrar sesión */}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-between py-[15px] cursor-pointer group"
                >
                  <span className="text-sm font-semibold" style={{ color: '#ba1a1a' }}>
                    Cerrar sesión
                  </span>
                  <span className="text-[#5a7478]">
                    <IconChevronRight />
                  </span>
                </button>
              </div>
            </div>

            {/* ── Version note ─────────────────────────────────────────── */}
            <p className="text-center text-[0.7rem] text-[#5a7478] pb-10">
              Circl · versión 0.1 prototype
            </p>

          </div>
        </main>
      </div>
    </>
  )
}
