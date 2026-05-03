'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import { SkeletonStyles, SkeletonText, SkeletonCard, SkeletonBase } from '@/components/Skeleton'

// ── Types ──────────────────────────────────────────────────────────────────────

type Crisis = {
  id:         string
  name:       string
  status:     string
  category:   string | null
  started_at: string | null
}

type CrisisWithProgress = Crisis & {
  totalTasks: number
  doneTasks:  number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysSince(iso: string | null) {
  if (!iso) return 0
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

function fmtLongDate(iso: string | null) {
  if (!iso) return '—'
  const s = new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function IconWarning() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0A7E8C"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9"  x2="12"    y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function IconChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

// ── Crisis Card ────────────────────────────────────────────────────────────────

function CrisisCard({ c, isActive }: { c: CrisisWithProgress; isActive: boolean }) {
  const days = daysSince(c.started_at)

  return (
    <Link
      href={`/crisis/${c.id}`}
      className="block no-underline transition-all"
      style={{
        background:    '#FFFFFF',
        borderRadius:  '1.5rem',
        boxShadow:     '0 4px 24px rgba(10,126,140,0.08)',
        padding:       '24px',
        marginBottom:  16,
        opacity:       isActive ? 1 : 0.65,
        color:         'inherit',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 8px 40px rgba(10,126,140,0.16)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 24px rgba(10,126,140,0.08)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-start" style={{ marginBottom: 10 }}>
        <div>
          <h3
            className="font-extrabold text-[#1A1A2E]"
            style={{ fontSize: '1.125rem', marginBottom: 6, letterSpacing: '-0.01em' }}
          >
            {c.name}
          </h3>
          {isActive ? (
            <span
              className="inline-flex items-center font-bold uppercase"
              style={{
                background:    'rgba(46,205,167,0.14)',
                color:         '#0a6e5a',
                borderRadius:  9999,
                padding:       '3px 11px',
                fontSize:      '0.7rem',
                letterSpacing: '0.05em',
              }}
            >
              Activa
            </span>
          ) : (
            <span
              className="inline-flex items-center font-bold uppercase"
              style={{
                background:    'rgba(90,116,120,0.10)',
                color:         '#5a7478',
                borderRadius:  9999,
                padding:       '3px 11px',
                fontSize:      '0.7rem',
                letterSpacing: '0.05em',
              }}
            >
              Resuelta
            </span>
          )}
        </div>
        <span
          className="flex-shrink-0"
          style={{
            color:      isActive ? '#0A7E8C' : '#5a7478',
            marginLeft: 12,
          }}
        >
          <IconChevronRight />
        </span>
      </div>

      {/* Days / category */}
      <div className="text-[0.7rem] text-[#5a7478]" style={{ marginTop: 4 }}>
        Inicio: {fmtLongDate(c.started_at)}
        {' · '}
        {days} {days === 1 ? 'día' : 'días'} {isActive ? 'activa' : ''}
        {c.category ? ` · ${c.category}` : ''}
      </div>
    </Link>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CrisisListPage() {
  const router = useRouter()
  const [crises,  setCrises]  = useState<CrisisWithProgress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) { router.replace('/login'); return }

      const { data: crisesData, error: crisesError } = await supabase
        .from('crises')
        .select('id, name, status, category, started_at')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })

      if (crisesError) console.error('Error crises:', crisesError)

      const list = (crisesData ?? []) as Crisis[]

      // Fetch tasks counts in parallel for each crisis
      const withProgress = await Promise.all(
        list.map(async (c) => {
          const [{ count: total }, { count: done }] = await Promise.all([
            supabase
              .from('tasks')
              .select('id', { count: 'exact', head: true })
              .eq('crisis_id', c.id),
            supabase
              .from('tasks')
              .select('id', { count: 'exact', head: true })
              .eq('crisis_id', c.id)
              .eq('status', 'completada'),
          ])
          return { ...c, totalTasks: total ?? 0, doneTasks: done ?? 0 }
        }),
      )

      setCrises(withProgress)
      setLoading(false)
    }

    load()
  }, [router])

  const active   = crises.filter((c) => c.status === 'activa')
  const resolved = crises.filter((c) => c.status !== 'activa')

  return (
    <>
      <style>{`
        @keyframes heroBgDrift {
          0%, 100% {
            background:
              radial-gradient(ellipse at 15% 15%, rgba(61,199,166,0.03)  0%, transparent 55%),
              radial-gradient(ellipse at 85% 10%, rgba(80,220,175,0.07)  0%, transparent 50%),
              radial-gradient(ellipse at 88% 82%, rgba(224,121,49,0.08)  0%, transparent 52%),
              radial-gradient(ellipse at 12% 88%, rgba(158,160,81,0.08)  0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 65%),
              #f0f4f8;
          }
          25% {
            background:
              radial-gradient(ellipse at 22% 10%, rgba(61,199,166,0.03)  0%, transparent 55%),
              radial-gradient(ellipse at 90% 20%, rgba(80,220,175,0.07)  0%, transparent 50%),
              radial-gradient(ellipse at 80% 88%, rgba(224,121,49,0.08)  0%, transparent 52%),
              radial-gradient(ellipse at  6% 78%, rgba(158,160,81,0.08)  0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 65%),
              #f0f4f8;
          }
          50% {
            background:
              radial-gradient(ellipse at 10% 22%, rgba(61,199,166,0.03)  0%, transparent 55%),
              radial-gradient(ellipse at 78%  8%, rgba(80,220,175,0.07)  0%, transparent 50%),
              radial-gradient(ellipse at 92% 75%, rgba(224,121,49,0.08)  0%, transparent 52%),
              radial-gradient(ellipse at 18% 92%, rgba(158,160,81,0.08)  0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 65%),
              #f0f4f8;
          }
          75% {
            background:
              radial-gradient(ellipse at 20% 22%, rgba(61,199,166,0.03)  0%, transparent 55%),
              radial-gradient(ellipse at 82% 18%, rgba(80,220,175,0.07)  0%, transparent 50%),
              radial-gradient(ellipse at 85% 90%, rgba(224,121,49,0.08)  0%, transparent 52%),
              radial-gradient(ellipse at 14% 82%, rgba(158,160,81,0.08)  0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 65%),
              #f0f4f8;
          }
        }
        .crisis-bg { animation: heroBgDrift 30s ease-in-out infinite; }
      `}</style>

      <div className="crisis-bg flex min-h-screen">
        <Sidebar />

        <main className="flex-1 ml-0 md:ml-[240px] min-h-screen px-5 py-8 pb-28 md:px-10 md:py-10 md:pb-10">

          {/* ── Page header ─────────────────────────────────────────────── */}
          <div style={{ marginBottom: 40 }}>
            <h1
              className="font-extrabold text-[#1A1A2E]"
              style={{ fontSize: '2rem', letterSpacing: '-0.03em', lineHeight: 1.15 }}
            >
              Crisis
            </h1>
            <p className="text-[#5a7478] mt-1.5" style={{ fontSize: '1rem' }}>
              Registros de situaciones activas y resueltas.
            </p>
          </div>

          <SkeletonStyles />

          {/* ── Loading skeleton ────────────────────────────────────────── */}
          {loading && (
            <div>
              {/* Section label */}
              <SkeletonText width={80} className="mb-4" />

              {/* Crisis card skeleton */}
              <SkeletonCard style={{ marginBottom: 16 }}>
                {/* Title */}
                <SkeletonText width="55%" className="mb-3" />
                {/* Badge */}
                <SkeletonBase width={64} height={20} style={{ borderRadius: 9999, marginBottom: 14 }} />
                {/* Meta line */}
                <SkeletonText width="70%" className="mb-4" />
                {/* Progress bar */}
                <SkeletonBase width="100%" height={6} style={{ borderRadius: 9999 }} />
              </SkeletonCard>

              <SkeletonCard>
                <SkeletonText width="50%" className="mb-3" />
                <SkeletonBase width={64} height={20} style={{ borderRadius: 9999, marginBottom: 14 }} />
                <SkeletonText width="65%" className="mb-4" />
                <SkeletonBase width="100%" height={6} style={{ borderRadius: 9999 }} />
              </SkeletonCard>
            </div>
          )}

          {/* ── Empty state ─────────────────────────────────────────────── */}
          {!loading && crises.length === 0 && (
            <div className="flex justify-center">
              <div
                className="w-full text-center"
                style={{
                  maxWidth:   520,
                  border:     '1.5px dashed rgba(61,199,166,0.35)',
                  background: 'transparent',
                  borderRadius: '1.5rem',
                  padding:    '40px 24px',
                }}
              >
                <div
                  className="rounded-full flex items-center justify-center mx-auto"
                  style={{
                    width:       64,
                    height:      64,
                    background:  'rgba(10,126,140,0.07)',
                    border:      '1.5px dashed rgba(61,199,166,0.35)',
                    marginBottom: 16,
                  }}
                >
                  <IconWarning />
                </div>

                <p className="font-bold text-[#1A1A2E]" style={{ fontSize: '1rem', marginBottom: 8 }}>
                  No hay crisis registradas
                </p>
                <p className="text-[0.875rem] text-[#5a7478] leading-relaxed" style={{ marginBottom: 24 }}>
                  Hablá con el agente para registrar tu primera situación.
                </p>

                <Link
                  href="/chat"
                  className="inline-block bg-[#0A7E8C] text-white font-bold rounded-full transition-all hover:brightness-110 active:scale-[0.97]"
                  style={{ padding: '12px 28px', fontSize: '0.875rem' }}
                >
                  Hablar con el agente
                </Link>
              </div>
            </div>
          )}

          {/* ── Active section ──────────────────────────────────────────── */}
          {active.length > 0 && (
            <>
              <p
                className="font-bold uppercase text-[#5a7478]"
                style={{
                  fontSize:      '0.875rem',
                  letterSpacing: '0.1em',
                  marginBottom:  16,
                }}
              >
                Activas
              </p>
              {active.map((c) => (
                <CrisisCard key={c.id} c={c} isActive={true} />
              ))}
            </>
          )}

          {/* ── Resolved section ────────────────────────────────────────── */}
          {resolved.length > 0 && (
            <>
              <p
                className="font-bold uppercase text-[#5a7478]"
                style={{
                  fontSize:      '0.875rem',
                  letterSpacing: '0.1em',
                  marginTop:     40,
                  marginBottom:  16,
                }}
              >
                Resueltas
              </p>
              {resolved.map((c) => (
                <CrisisCard key={c.id} c={c} isActive={false} />
              ))}
            </>
          )}

        </main>
      </div>
    </>
  )
}
