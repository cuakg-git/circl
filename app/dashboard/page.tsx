'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import {
  SkeletonStyles, SkeletonText, SkeletonAvatar,
  SkeletonCard, SkeletonBase,
} from '@/components/Skeleton'

// ── Types ──────────────────────────────────────────────────────────────────────

type Crisis = {
  id:           string
  name:         string
  status:       string
  description:  string | null
  category:     string | null
  started_at:   string | null
  ai_summary:   string | null
  ai_next_step: string | null
}

type Task = {
  id:          string
  title:       string
  status:      string
  due_date:    string | null
  assigned_contact_id: string | null
}

type Doc = {
  id:         string
  name:       string
  created_at: string
}

// ── Date / formatting helpers ──────────────────────────────────────────────────

function todayLabel() {
  const d = new Date()
  const s = d.toLocaleDateString('es-AR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  return s.replace(/^\w/, (c) => c.toUpperCase())
}

function daysSince(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric' })
}

function fmtMonth(iso: string) {
  return new Date(iso)
    .toLocaleDateString('es-AR', { month: 'short' })
    .replace('.', '')
}

function fmtShortDate(iso: string) {
  return new Date(iso)
    .toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
    .replace('.', '')
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function IconAlert() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0A7E8C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9"  x2="12"    y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function IconCheck() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0A7E8C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0A7E8C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2"  x2="16" y2="6"  />
      <line x1="8"  y1="2"  x2="8"  y2="6"  />
      <line x1="3"  y1="10" x2="21" y2="10" />
    </svg>
  )
}

// ── Empty state for a single module column ─────────────────────────────────────

function ModuleEmpty({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-3">
      <div
        className="w-[52px] h-[52px] rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          background: 'rgba(61,199,166,0.08)',
          border:     '1.5px dashed rgba(61,199,166,0.35)',
        }}
      >
        {icon}
      </div>
      <p className="text-sm text-[#5a7478] font-medium text-center leading-snug">
        {label}
      </p>
    </div>
  )
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.875rem] font-bold tracking-[0.10em] uppercase text-[#5a7478] mb-[14px]">
      {children}
    </p>
  )
}

function Card({
  children,
  className = '',
  style,
}: {
  children:   React.ReactNode
  className?: string
  style?:     React.CSSProperties
}) {
  return (
    <div
      className={`bg-white rounded-[1.5rem] p-5 ${className}`}
      style={{ boxShadow: '0 4px 24px rgba(10,126,140,0.08)', ...style }}
    >
      {children}
    </div>
  )
}

function IconDoc() {
  return (
    <svg
      width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke="#0A7E8C" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [firstName, setFirstName] = useState('')
  const [crisis,    setCrisis]    = useState<Crisis | null>(null)
  const [tasks,     setTasks]     = useState<Task[]>([])
  const [upcoming,  setUpcoming]  = useState<Task[]>([])
  const [docs,      setDocs]      = useState<Doc[]>([])
  const [loading,   setLoading]   = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      // 1 ─ Usuario autenticado (valida contra el servidor, no depende de cookies)
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) { router.replace('/login'); return }

      const full = (user.user_metadata?.full_name ?? '') as string
      setFirstName(full.trim().split(/\s+/)[0] || 'vos')

      // 2 ─ Crisis activa
      const { data: crisisData, error: crisisError } = await supabase
        .from('crises')
        .select('id, name, description, category, started_at, ai_summary, ai_next_step, status')
        .eq('user_id', user.id)
        .eq('status', 'activa')
        .maybeSingle()

      console.log('User ID:', user.id)
      console.log('Crisis data:', crisisData)
      console.log('Crisis error:', JSON.stringify(crisisError))

      if (!crisisData) { setLoading(false); return }
      setCrisis(crisisData)

      const cid: string = crisisData.id

      // 3 ─ Tareas pendientes
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('id, title, status, due_date, assigned_contact_id')
        .eq('crisis_id', cid)
        .eq('status', 'pendiente')

      if (tasksError) console.error('Error tasks:', tasksError)
      setTasks(tasksData ?? [])

      // 4 ─ Próximos compromisos: tareas con due_date, orden ASC, top 3
      const { data: upcomingData, error: upcomingError } = await supabase
        .from('tasks')
        .select('id, title, status, due_date, assigned_contact_id')
        .eq('crisis_id', cid)
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true })
        .limit(3)

      if (upcomingError) console.error('Error upcoming:', upcomingError)
      setUpcoming(upcomingData ?? [])

      // 5 ─ Documentos recientes: orden DESC, top 3
      const { data: docsData, error: docsError } = await supabase
        .from('documents')
        .select('id, name, created_at')
        .eq('crisis_id', cid)
        .order('created_at', { ascending: false })
        .limit(3)

      if (docsError) console.error('Error documents:', docsError)
      setDocs(docsData ?? [])
      setLoading(false)
    }

    load()
  }, [router])

  // ── Render ─────────────────────────────────────────────────────────────────

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
        .dashboard-bg { animation: heroBgDrift 30s ease-in-out infinite; }
      `}</style>

      <div className="dashboard-bg flex min-h-screen">
        <Sidebar />

        {/* pb-28 on mobile gives room above the fixed bottom nav */}
        <main className="flex-1 ml-0 md:ml-[240px] min-h-screen px-5 py-8 pb-28 md:px-10 md:py-10 md:pb-10">

          <SkeletonStyles />

          {/* ════════════════════════════ SKELETON (loading) ════════════════════ */}
          {loading && (
            <div className="animate-none">
              {/* Header skeleton */}
              <div className="flex items-center gap-4 mb-8">
                <SkeletonAvatar size={48} />
                <div className="flex-1 flex flex-col gap-2">
                  <SkeletonText width="40%" />
                  <SkeletonText width="60%" />
                </div>
              </div>

              {/* Context card skeleton */}
              <div className="mb-8">
                <SkeletonCard>
                  <div className="flex flex-col gap-3">
                    <SkeletonText width="90%" />
                    <SkeletonText width="75%" />
                    <SkeletonText width="55%" />
                  </div>
                </SkeletonCard>
              </div>

              {/* 3-col grid skeleton */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
                {/* Tasks */}
                <SkeletonCard>
                  {[80, 65, 90, 70].map((w, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 py-3"
                      style={{ borderBottom: i < 3 ? '1px solid rgba(10,126,140,0.08)' : 'none' }}>
                      <SkeletonText width={`${w}%`} />
                      <SkeletonAvatar size={24} />
                    </div>
                  ))}
                </SkeletonCard>

                {/* Upcoming */}
                <SkeletonCard>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-start gap-3 py-3"
                      style={{ borderBottom: i < 2 ? '1px solid rgba(10,126,140,0.08)' : 'none' }}>
                      <SkeletonBase width={48} height={52} style={{ borderRadius: '0.5rem', flexShrink: 0 }} />
                      <div className="flex-1 flex flex-col gap-2 pt-1">
                        <SkeletonText width="80%" />
                        <SkeletonText width="50%" />
                      </div>
                    </div>
                  ))}
                </SkeletonCard>

                {/* Documents */}
                <SkeletonCard>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3 py-2.5"
                      style={{ borderBottom: i < 2 ? '1px solid rgba(10,126,140,0.08)' : 'none' }}>
                      <SkeletonBase width={36} height={36} style={{ borderRadius: '0.5rem', flexShrink: 0 }} />
                      <div className="flex-1 flex flex-col gap-1.5">
                        <SkeletonText width="70%" />
                        <SkeletonText width="40%" />
                      </div>
                    </div>
                  ))}
                </SkeletonCard>
              </div>
            </div>
          )}

          {/* ════════════════════════════ CONTENT (loaded) ══════════════════════ */}
          {!loading && (
          <>

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="mb-8">
            <h1 className="text-[2rem] font-extrabold text-[#1A1A2E] tracking-[-0.03em] leading-tight">
              {`Hola, ${firstName}`}
            </h1>

            {/* Sin crisis: subtítulo explicativo */}
            {!crisis ? (
              <p className="mt-1.5 text-[15px] text-[#5a7478]">
                Todavía no me contaste de ninguna crisis. Te ayudo a empezar.
              </p>
            ) : (
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {/* Date — hidden on small screens to match the maqueta */}
                <span className="hidden sm:block text-[13px] text-[#5a7478]">
                  {todayLabel()}
                </span>
                <div className="hidden sm:block w-px h-3 bg-[rgba(10,126,140,0.20)]" />

                {/* Crisis chip */}
                {crisis && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-[7px] h-[7px] rounded-full bg-[#0A7E8C]" />
                    <span className="text-[13px] font-medium text-[#E07931]">
                      {crisis.name}
                    </span>
                    <span className="text-[12px] text-[#5a7478]">
                      · Crisis activa · {crisis.started_at ? daysSince(crisis.started_at) : 0} días
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ══ Casuística 1: sin crisis activa ════════════════════════════ */}
          {!crisis && (
            <div className="flex justify-center">
              <Card
                className="w-full text-center"
                style={{
                  maxWidth:    520,
                  border:      '1.5px dashed rgba(61,199,166,0.35)',
                  background:  'transparent',
                  boxShadow:   'none',
                  padding:     '40px 24px',
                }}
              >
                {/* Alert icon */}
                <div
                  className="w-[52px] h-[52px] rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{
                    background: 'rgba(61,199,166,0.08)',
                    border:     '1.5px dashed rgba(61,199,166,0.35)',
                  }}
                >
                  <IconAlert />
                </div>

                <p className="text-base font-bold text-[#1A1A2E] mb-2">
                  No hay ninguna crisis registrada
                </p>
                <p className="text-sm text-[#5a7478] leading-relaxed mb-6">
                  Contame qué está pasando para que el agente pueda acompañarte y ayudarte a organizarte.
                </p>

                <Link
                  href="/onboarding"
                  className="inline-block bg-[#0A7E8C] text-white font-bold rounded-full px-7 py-3 text-sm transition-all hover:brightness-110 active:scale-[0.97]"
                >
                  Registrar primera crisis
                </Link>
              </Card>
            </div>
          )}

          {/* ══ Casuística 2: con crisis — contexto + grid ════════════════ */}
          {crisis && (
            <>
              {/* ── Context panel ── full width ───────────────────────── */}
              {(crisis.ai_summary || crisis.ai_next_step) && (
                <div className="mb-8">
                  <SectionTitle>Contexto actual</SectionTitle>
                  <Card>
                    {/* Label */}
                    <span className="block text-[0.7rem] font-bold tracking-[0.12em] uppercase text-[#0A7E8C] mb-2.5">
                      Lo que sé hasta ahora
                    </span>

                    {/* Summary */}
                    {crisis.ai_summary && (
                      <p className="text-[0.875rem] leading-[1.75] text-[#1A1A2E]">
                        {crisis.ai_summary}
                      </p>
                    )}

                    {/* Next step */}
                    {crisis.ai_next_step && (
                      <div
                        className="mt-4 pt-3.5 flex items-start gap-2.5"
                        style={{ borderTop: '1px solid rgba(10,126,140,0.12)' }}
                      >
                        <span className="text-[0.7rem] font-bold tracking-[0.08em] uppercase text-[#E8913A] whitespace-nowrap pt-px">
                          Próximo paso
                        </span>
                        <span className="text-[0.875rem] font-semibold text-[#1A1A2E] leading-snug">
                          {crisis.ai_next_step}
                        </span>
                      </div>
                    )}
                  </Card>
                </div>
              )}

              {/* ── 3-col grid ──────────────────────────────────────────── */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">

                {/* ── Tareas ──────────────────────────────────────────── */}
                <div>
                  <SectionTitle>Tareas</SectionTitle>
                  <Card>
                    {tasks.length > 0 ? (
                      <div className="flex flex-col">
                        {tasks.map((t, i) => (
                          <div
                            key={t.id}
                            className="py-3"
                            style={{
                              borderBottom:
                                i < tasks.length - 1
                                  ? '1px solid rgba(10,126,140,0.08)'
                                  : 'none',
                            }}
                          >
                            <p className="text-sm font-semibold text-[#1A1A2E] leading-snug">
                              {t.title}
                            </p>
                            <div className="flex items-center justify-between mt-1 gap-2">
                              {t.assigned_contact_id ? (
                                <span className="text-xs text-[#5a7478]">
                                  {t.assigned_contact_id}
                                </span>
                              ) : (
                                <span />
                              )}
                              {t.due_date && (
                                <span className="text-xs text-[#5a7478] whitespace-nowrap">
                                  Vence {fmtShortDate(t.due_date)}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <ModuleEmpty icon={<IconCheck />} label="Sin tareas pendientes" />
                    )}
                  </Card>
                </div>

                {/* ── Próximos compromisos ─────────────────────────────── */}
                <div>
                  <SectionTitle>Próximos compromisos</SectionTitle>
                  <Card>
                    {upcoming.length > 0 ? (
                      <div className="flex flex-col">
                        {upcoming.map((t, i) => (
                          <div
                            key={t.id}
                            className="flex items-start gap-3.5 py-3"
                            style={{
                              borderBottom:
                                i < upcoming.length - 1
                                  ? '1px solid rgba(10,126,140,0.10)'
                                  : 'none',
                            }}
                          >
                            {/* Date chip */}
                            <div
                              className="flex-shrink-0 min-w-[48px] text-center rounded-lg px-1 py-1.5"
                              style={{ background: 'rgba(10,126,140,0.07)' }}
                            >
                              <div className="text-[1.2rem] font-extrabold text-[#0A7E8C] leading-none">
                                {fmtDay(t.due_date!)}
                              </div>
                              <div className="text-[0.6rem] font-bold uppercase tracking-[0.05em] text-[#5a7478] mt-0.5">
                                {fmtMonth(t.due_date!)}
                              </div>
                            </div>

                            {/* Body */}
                            <div className="min-w-0 pt-0.5">
                              <p className="text-sm font-bold text-[#1A1A2E] leading-snug">
                                {t.title}
                              </p>
                              {t.assigned_contact_id && (
                                <p className="text-xs text-[#5a7478] mt-1">
                                  {t.assigned_contact_id}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <ModuleEmpty icon={<IconCalendar />} label="Sin compromisos próximos" />
                    )}
                  </Card>
                </div>

                {/* ── Documentos recientes ─────────────────────────────── */}
                <div>
                  <SectionTitle>Documentos recientes</SectionTitle>
                  <Card>
                    {docs.length > 0 ? (
                      <div className="flex flex-col">
                        {docs.map((d, i) => (
                          <div
                            key={d.id}
                            className="flex items-center gap-3 py-2.5"
                            style={{
                              borderBottom:
                                i < docs.length - 1
                                  ? '1px solid rgba(10,126,140,0.10)'
                                  : 'none',
                            }}
                          >
                            {/* Icon */}
                            <div
                              className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center"
                              style={{ background: 'rgba(10,126,140,0.07)' }}
                            >
                              <IconDoc />
                            </div>

                            {/* Name */}
                            <span className="flex-1 min-w-0 text-[0.875rem] font-semibold text-[#1A1A2E] truncate">
                              {d.name}
                            </span>

                            {/* Date */}
                            <span className="text-[0.7rem] text-[#5a7478] whitespace-nowrap">
                              {fmtShortDate(d.created_at)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <ModuleEmpty icon={<IconDoc />} label="Sin documentos aún" />
                    )}
                  </Card>
                </div>

              </div>
            </>
          )}

          </> /* end !loading */
          )}

        </main>
      </div>
    </>
  )
}
