'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────────

type Contact = {
  id:       string
  name:     string
  initials: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function initialsFrom(name: string) {
  return name.trim().split(/\s+/).filter(Boolean)
    .slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

// ── Time options ───────────────────────────────────────────────────────────────

const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4).toString().padStart(2, '0')
  const m = ((i % 4) * 15).toString().padStart(2, '0')
  return `${h}:${m}`
})

// ── Componente AssigneeDropdownPortal ──────────────────────────────────────────

function AssigneeDropdownPortal({
  contacts,
  selectedValue,
  anchorRect,
  onSelect,
  onClose,
}: {
  contacts:      Contact[]
  selectedValue: string
  anchorRect:    DOMRect | null
  onSelect:      (val: string) => void
  onClose:       () => void
}) {
  if (!anchorRect) return null

  const top  = Math.min(anchorRect.bottom + 8, window.innerHeight - 320)
  const left = Math.max(8, Math.min(anchorRect.left, window.innerWidth - 280))

  const options = [
    { value: '',   label: 'Sin asignar', initials: '—',  bg: 'rgba(10,126,140,0.08)', color: '#5a7478' },
    { value: 'yo', label: 'Yo',          initials: 'Yo', bg: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)', color: 'white' },
    ...contacts.map((c) => ({
      value:    `c:${c.id}`,
      label:    c.name,
      initials: (c.initials ?? initialsFrom(c.name)).slice(0, 2),
      bg:       'linear-gradient(135deg, #f4ab66, #E8913A)',
      color:    'white',
    })),
  ]

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 500 }} />
      <div style={{
        position: 'fixed', top, left, width: 240,
        background: '#FFFFFF', borderRadius: '0.875rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        zIndex: 501, overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px 10px',
          borderBottom: '1px solid rgba(10,126,140,0.10)',
        }}>
          <span style={{
            fontSize: '0.75rem', fontWeight: 700,
            color: '#1A1A2E', letterSpacing: '0.04em',
          }}>Asignar a</span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#5a7478', fontSize: '1rem', lineHeight: 1, padding: 2,
          }}>✕</button>
        </div>
        <div style={{ padding: '8px 10px', maxHeight: 280, overflowY: 'auto' }}>
          {options.map((opt) => {
            const isSelected = selectedValue === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onSelect(opt.value); onClose() }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  gap: 10, padding: '8px 10px', marginBottom: 4,
                  background: isSelected ? 'rgba(10,126,140,0.08)' : 'transparent',
                  border: 'none', borderRadius: '0.5rem',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'background 0.15s', fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'rgba(10,126,140,0.05)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isSelected
                    ? 'rgba(10,126,140,0.08)' : 'transparent'
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: opt.bg, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.65rem', fontWeight: 700, color: opt.color,
                }}>{opt.initials}</div>
                <span style={{
                  fontSize: '0.875rem', fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? '#0A7E8C' : '#1A1A2E',
                  flex: 1, whiteSpace: 'nowrap',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{opt.label}</span>
                {isSelected && (
                  <svg width="14" height="14" viewBox="0 0 24 24"
                    fill="none" stroke="#0A7E8C" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function NuevaTareaSharedPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: sharedCaseId } = use(params)
  const router = useRouter()

  const [userId,   setUserId]   = useState<string | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  type Doc = {
    id:         string
    name:       string
    type:       string | null
    created_at: string
  }

  const DOC_TYPE_LABELS: Record<string, string> = {
    estudio_medico: 'Estudio médico',
    receta:         'Receta',
    informe:        'Informe',
    otros:          'Otros',
  }

  // Form fields
  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [date,        setDate]        = useState('')
  const [time,        setTime]        = useState('')
  const [timeOpen,    setTimeOpen]    = useState(false)
  const [assignee,    setAssignee]    = useState('')

  // Dropdown
  const [assigneeDropdown, setAssigneeDropdown] = useState<{
    open: boolean; anchorRect: DOMRect | null
  }>({ open: false, anchorRect: null })

  // Documentos a asociar
  const [allDocs,        setAllDocs]        = useState<Doc[]>([])
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([])
  const [docPickerOpen,  setDocPickerOpen]  = useState(false)

  // ── Auth + load ──────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) { router.replace('/login'); return }
      setUserId(user.id)

      const [contactsRes, docsRes] = await Promise.all([
        supabase
          .from('contacts')
          .select('id, name, initials')
          .eq('user_id', user.id)
          .order('sort_order', { ascending: true, nullsFirst: false }),
        supabase
          .from('documents')
          .select('id, name, type, created_at')
          .eq('shared_case_id', sharedCaseId)
          .order('created_at', { ascending: false }),
      ])

      setContacts((contactsRes.data ?? []) as Contact[])
      setAllDocs((docsRes.data ?? []) as Doc[])
      setLoading(false)
    }
    load()
  }, [router, sharedCaseId])

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!title.trim() || !userId) return
    setSaving(true)
    setError(null)

    let assignedToUser = false
    let assignedContactId: string | null = null
    if (assignee === 'yo') {
      assignedToUser = true
    } else if (assignee.startsWith('c:')) {
      assignedContactId = assignee.slice(2)
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('tasks')
      .insert({
        shared_case_id:      sharedCaseId,
        title:               title.trim(),
        description:         description.trim() || null,
        due_date:            date || null,
        status:              'pendiente',
        assigned_to_user:    assignedToUser,
        assigned_contact_id: assignedContactId,
      })
      .select('id')
      .single()

    if (insertErr) {
      setSaving(false)
      setError('No se pudo guardar la tarea. Intentá de nuevo.')
      return
    }

    // Asociar documentos seleccionados
    if (selectedDocIds.length > 0) {
      await supabase.from('task_documents').insert(
        selectedDocIds.map(docId => ({
          task_id:     inserted.id,
          document_id: docId,
        }))
      )
    }

    // Registrar en shared_case_history
    await supabase.from('shared_case_history').insert({
      shared_case_id: sharedCaseId,
      title:          'Tarea creada',
      description:    `Tarea "${title.trim()}" creada`,
      event_type:     'tarea_agregada',
      created_by:     userId,
      task_id:        inserted.id,
    })

    // Llamar al endpoint en background
    fetch('/api/task-context', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ task_id: inserted.id, user_id: userId }),
    }).catch((e) => console.error('[nueva-tarea-shared] task-context error:', e))

    router.replace('/case/shared/' + sharedCaseId)
  }

  // ── Helpers display ──────────────────────────────────────────────────────────

  function getAssigneeDisplay() {
    if (!assignee) return null
    if (assignee === 'yo') return {
      label: 'Yo', initials: 'Yo',
      bg: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
    }
    if (assignee.startsWith('c:')) {
      const c = contacts.find(c => `c:${c.id}` === assignee)
      if (c) return {
        label:    c.name,
        initials: (c.initials ?? initialsFrom(c.name)).slice(0, 2),
        bg:       'linear-gradient(135deg, #f4ab66, #E8913A)',
      }
    }
    return null
  }

  const assigneeDisplay = getAssigneeDisplay()

  // ── Render ───────────────────────────────────────────────────────────────────

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
        .nueva-tarea-shared-bg { animation: heroBgDrift 30s ease-in-out infinite; }
      `}</style>

      {/* Dropdown */}
      {assigneeDropdown.open && (
        <AssigneeDropdownPortal
          contacts={contacts}
          selectedValue={assignee}
          anchorRect={assigneeDropdown.anchorRect}
          onSelect={setAssignee}
          onClose={() => setAssigneeDropdown({ open: false, anchorRect: null })}
        />
      )}

      <div className="nueva-tarea-shared-bg flex min-h-screen">
        <Sidebar />

        <main className="flex-1 ml-0 md:ml-[240px] min-h-screen px-5 py-8 pb-28 md:px-10 md:py-10 md:pb-10">

          {/* Breadcrumb */}
          <nav style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Link href={`/case/shared/${sharedCaseId}`} style={{
              fontSize: '0.8125rem', color: '#0A7E8C', fontWeight: 600,
              textDecoration: 'none',
            }}>
              Tema compartido
            </Link>
            <span style={{ color: '#5a7478', fontSize: '0.8125rem' }}>→</span>
            <span style={{ fontSize: '0.8125rem', color: '#5a7478', fontWeight: 500 }}>
              Nueva tarea
            </span>
          </nav>

          {loading ? (
            <div style={{ maxWidth: 560, margin: '0 auto' }}>
              <div style={{
                background: '#FFFFFF', borderRadius: '1.5rem',
                boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                padding: 32, textAlign: 'center',
              }}>
                <p style={{ color: '#5a7478', fontSize: '0.875rem' }}>Cargando…</p>
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: 560, margin: '0 auto' }}>

              {/* Hero */}
              <div style={{ textAlign: 'center', padding: '16px 0 28px' }}>
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: 'rgba(61,199,166,0.08)',
                  border: '2px dashed rgba(61,199,166,0.45)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 14px',
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                    stroke="#0A7E8C" strokeWidth="1.8" strokeLinecap="round"
                    strokeLinejoin="round">
                    <polyline points="9 11 12 14 22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                </div>
                <h1 style={{
                  fontSize: '1.5rem', fontWeight: 800,
                  letterSpacing: '-0.02em', color: '#1A1A2E',
                }}>Nueva tarea</h1>
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  marginBottom: 16, padding: '10px 16px',
                  borderRadius: '0.75rem',
                  background: 'rgba(186,26,26,0.07)',
                  border: '1px solid rgba(186,26,26,0.18)',
                  fontSize: '0.8125rem', color: '#ba1a1a', fontWeight: 600,
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 8,
                }}>
                  <span>{error}</span>
                  <button onClick={() => setError(null)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#ba1a1a', fontSize: '1rem', lineHeight: 1,
                  }}>✕</button>
                </div>
              )}

              {/* Card 1 — Título */}
              <div style={{
                background: '#FFFFFF', borderRadius: '1.5rem',
                boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                marginBottom: 24, overflow: 'hidden',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'flex-start',
                  padding: '16px 20px', gap: 12,
                }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                    textTransform: 'uppercase', color: '#5a7478',
                    minWidth: 80, flexShrink: 0, paddingTop: 3,
                  }}>Tarea</span>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder=" "
                    autoFocus
                    style={{
                      flex: 1, border: 'none', background: 'none',
                      fontSize: '0.875rem', fontWeight: 600,
                      outline: 'none', color: '#1A1A2E', fontFamily: 'inherit',
                    }}
                  />
                </div>
              </div>

              {/* Card 2 — Datos opcionales */}
              <p style={{
                fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: '#5a7478',
                marginBottom: 12,
              }}>Datos opcionales</p>
              <div style={{
                background: '#FFFFFF', borderRadius: '1.5rem',
                boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                marginBottom: 24, overflow: 'hidden',
              }}>
                {/* Descripción */}
                <div style={{
                  display: 'flex', alignItems: 'flex-start',
                  padding: '16px 20px',
                  borderBottom: '1px solid rgba(10,126,140,0.08)', gap: 12,
                }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                    textTransform: 'uppercase', color: '#5a7478',
                    minWidth: 80, flexShrink: 0, paddingTop: 3,
                  }}>Descripción</span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Contexto adicional…"
                    rows={3}
                    style={{
                      flex: 1, border: 'none', background: 'none',
                      fontSize: '0.875rem', fontWeight: 400,
                      outline: 'none', color: '#1A1A2E', fontFamily: 'inherit',
                      resize: 'none', lineHeight: 1.6,
                    }}
                  />
                </div>

                {/* Fecha */}
                <div style={{
                  display: 'flex', alignItems: 'center',
                  padding: '16px 20px',
                  borderBottom: '1px solid rgba(10,126,140,0.08)', gap: 12,
                }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                    textTransform: 'uppercase', color: '#5a7478',
                    minWidth: 80, flexShrink: 0,
                  }}>Fecha</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    style={{
                      flex: 1, border: 'none', background: 'none',
                      fontSize: '0.875rem', fontWeight: 400,
                      outline: 'none', color: '#1A1A2E', fontFamily: 'inherit',
                      colorScheme: 'light',
                    }}
                  />
                </div>

                {/* Horario */}
                <div style={{
                  display: 'flex', alignItems: 'center',
                  padding: '16px 20px', gap: 12,
                  borderBottom: '1px solid rgba(10,126,140,0.08)',
                  position: 'relative',
                }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                    textTransform: 'uppercase', color: '#5a7478',
                    minWidth: 80, flexShrink: 0,
                  }}>Horario</span>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="HH:MM"
                      value={time}
                      onChange={(e) => { setTime(e.target.value); setTimeOpen(true) }}
                      onFocus={() => setTimeOpen(true)}
                      onBlur={() => setTimeout(() => setTimeOpen(false), 150)}
                      style={{
                        width: '100%', border: 'none', background: 'none',
                        fontSize: '0.875rem', fontWeight: 400,
                        outline: 'none', color: '#1A1A2E', fontFamily: 'inherit',
                      }}
                    />
                    {timeOpen && (
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 6px)',
                        left: -20, right: -20, maxHeight: 220, overflowY: 'auto',
                        background: '#FFFFFF', borderRadius: '1rem',
                        boxShadow: '0 8px 32px rgba(10,126,140,0.18)',
                        border: '1px solid rgba(10,126,140,0.10)', zIndex: 400,
                      }}>
                        {TIME_OPTIONS.filter(t => !time || t.startsWith(time)).map((t, i, arr) => (
                          <div
                            key={t}
                            onMouseDown={() => { setTime(t); setTimeOpen(false) }}
                            style={{
                              padding: '10px 20px', fontSize: '0.875rem',
                              fontWeight: time === t ? 700 : 400,
                              color: time === t ? '#0A7E8C' : '#1A1A2E',
                              background: time === t ? 'rgba(10,126,140,0.07)' : 'transparent',
                              cursor: 'pointer',
                              borderBottom: i < arr.length - 1
                                ? '1px solid rgba(10,126,140,0.06)' : 'none',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(61,199,166,0.10)' }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = time === t
                                ? 'rgba(10,126,140,0.07)' : 'transparent'
                            }}
                          >
                            {t}
                          </div>
                        ))}
                        {TIME_OPTIONS.filter(t => !time || t.startsWith(time)).length === 0 && (
                          <div style={{
                            padding: '14px 20px', fontSize: '0.875rem',
                            color: '#5a7478', textAlign: 'center',
                          }}>
                            Sin resultados
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Asignado */}
                <div style={{
                  display: 'flex', alignItems: 'center',
                  padding: '16px 20px', gap: 12,
                }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                    textTransform: 'uppercase', color: '#5a7478',
                    minWidth: 80, flexShrink: 0,
                  }}>Asignado</span>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {assigneeDisplay && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%',
                          background: assigneeDisplay.bg, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.6rem', fontWeight: 700, color: 'white',
                        }}>{assigneeDisplay.initials}</div>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1A1A2E' }}>
                          {assigneeDisplay.label}
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => setAssigneeDropdown({
                        open: true, anchorRect: e.currentTarget.getBoundingClientRect(),
                      })}
                      style={{
                        padding: 0, background: 'none', border: 'none',
                        color: '#0A7E8C', fontSize: '0.8125rem', fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit',
                        textDecoration: 'underline', textUnderlineOffset: 3,
                      }}>
                      {assignee ? 'Cambiar' : 'Asignar'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Documentos */}
              {allDocs.length > 0 && (
                <>
                  <p style={{
                    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                    textTransform: 'uppercase', color: '#5a7478',
                    marginBottom: 12, marginTop: 8,
                  }}>Documentos relacionados</p>
                  <div style={{
                    background: '#FFFFFF', borderRadius: '1.5rem',
                    boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                    marginBottom: 24, overflow: 'hidden',
                  }}>
                    {selectedDocIds.length > 0 && (
                      <div style={{ padding: '12px 20px 4px' }}>
                        {selectedDocIds.map(docId => {
                          const d = allDocs.find(d => d.id === docId)
                          if (!d) return null
                          return (
                            <div key={docId} style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '8px 0',
                              borderBottom: '1px solid rgba(10,126,140,0.08)',
                            }}>
                              <div style={{
                                width: 28, height: 28, borderRadius: '0.375rem',
                                background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                                display: 'flex', alignItems: 'center',
                                justifyContent: 'center', flexShrink: 0,
                              }}>
                                <svg width="12" height="12" viewBox="0 0 24 24"
                                  fill="none" stroke="white" strokeWidth="1.8"
                                  strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                </svg>
                              </div>
                              <span style={{
                                flex: 1, fontSize: '0.875rem', fontWeight: 600,
                                color: '#1A1A2E', whiteSpace: 'nowrap',
                                overflow: 'hidden', textOverflow: 'ellipsis',
                              }}>{d.name}</span>
                              <button
                                type="button"
                                onClick={() => setSelectedDocIds(prev => prev.filter(id => id !== docId))}
                                style={{
                                  background: 'none', border: 'none',
                                  cursor: 'pointer', color: '#5a7478',
                                  padding: 4, flexShrink: 0,
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = '#ba1a1a' }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = '#5a7478' }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24"
                                  fill="none" stroke="currentColor" strokeWidth="2"
                                  strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="18" y1="6" x2="6" y2="18" />
                                  <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {docPickerOpen && (
                      <div style={{ padding: '12px 20px 14px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {allDocs
                            .filter(d => !selectedDocIds.includes(d.id))
                            .map(d => (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => {
                                  setSelectedDocIds(prev => [...prev, d.id])
                                  setDocPickerOpen(false)
                                }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 10,
                                  padding: '8px 10px', borderRadius: '0.5rem',
                                  background: 'rgba(10,126,140,0.04)',
                                  border: '1px solid rgba(10,126,140,0.10)',
                                  cursor: 'pointer', textAlign: 'left',
                                  fontFamily: 'inherit', transition: 'background 0.15s',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(10,126,140,0.09)' }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(10,126,140,0.04)' }}
                              >
                                <span style={{
                                  flex: 1, fontSize: '0.8125rem', fontWeight: 600,
                                  color: '#1A1A2E', whiteSpace: 'nowrap',
                                  overflow: 'hidden', textOverflow: 'ellipsis',
                                }}>{d.name}</span>
                                <span style={{
                                  fontSize: '0.7rem', color: '#5a7478', flexShrink: 0,
                                }}>
                                  {DOC_TYPE_LABELS[d.type ?? ''] ?? ''}
                                </span>
                              </button>
                            ))
                          }
                          {allDocs.filter(d => !selectedDocIds.includes(d.id)).length === 0 && (
                            <p style={{ fontSize: '0.8125rem', color: '#5a7478', fontStyle: 'italic', margin: 0 }}>
                              No hay más documentos disponibles.
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setDocPickerOpen(false)}
                          style={{
                            marginTop: 8, background: 'none', border: 'none',
                            cursor: 'pointer', color: '#5a7478',
                            fontSize: '0.75rem', fontFamily: 'inherit',
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    )}

                    {!docPickerOpen && (
                      <div style={{
                        padding: '10px 20px 14px',
                        borderTop: selectedDocIds.length > 0
                          ? '1px solid rgba(10,126,140,0.08)' : 'none',
                      }}>
                        <button
                          type="button"
                          onClick={() => setDocPickerOpen(true)}
                          style={{
                            background: 'none', border: 'none',
                            cursor: 'pointer', color: '#0A7E8C',
                            fontSize: '0.8125rem', fontWeight: 600,
                            fontFamily: 'inherit', padding: 0,
                            textDecoration: 'underline',
                            textUnderlineOffset: 3,
                          }}
                        >
                          + Asociar documento
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Submit */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving || !title.trim()}
                style={{
                  width: '100%', padding: '14px', borderRadius: 9999,
                  border: 'none',
                  cursor: (saving || !title.trim()) ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: '0.875rem',
                  background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                  color: 'white',
                  opacity: (saving || !title.trim()) ? 0.6 : 1,
                  transition: 'filter 0.15s', fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => {
                  if (!saving && title.trim())
                    e.currentTarget.style.filter = 'brightness(1.08)'
                }}
                onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)' }}
              >
                {saving ? 'Guardando…' : 'Crear tarea'}
              </button>

            </div>
          )}
        </main>
      </div>
    </>
  )
}
