'use client'

import { useEffect, useState, useRef } from 'react'
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

type Topic = {
  id:    string
  name:  string
  color: string | null
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TOPIC_COLORS = [
  { value: '#0A7E8C', label: 'Teal' },
  { value: '#2ECDA7', label: 'Mint' },
  { value: '#8FA44A', label: 'Verde' },
  { value: '#E8913A', label: 'Naranja' },
  { value: '#4BAAB5', label: 'Celeste' },
  { value: '#7B8FA6', label: 'Gris azul' },
]

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

// ── Componente TopicDropdownPortal ─────────────────────────────────────────────

function TopicDropdownPortal({
  topics,
  selectedId,
  anchorRect,
  view,
  editTopic,
  editTopicName,
  setEditTopicName,
  editTopicColor,
  setEditTopicColor,
  editTopicLoading,
  onToggleTopic,
  onOpenEdit,
  onOpenCreate,
  onBack,
  onSave,
  onDelete,
  onClose,
}: {
  topics:            Topic[]
  selectedId:        string
  anchorRect:        DOMRect | null
  view:              'list' | 'edit' | 'create'
  editTopic:         Topic | null
  editTopicName:     string
  setEditTopicName:  (v: string) => void
  editTopicColor:    string
  setEditTopicColor: (v: string) => void
  editTopicLoading:  boolean
  onToggleTopic:     (id: string) => void
  onOpenEdit:        (t: Topic) => void
  onOpenCreate:      () => void
  onBack:            () => void
  onSave:            () => void
  onDelete:          () => void
  onClose:           () => void
}) {
  if (!anchorRect) return null

  const top  = Math.min(anchorRect.bottom + 8, window.innerHeight - 320)
  const left = Math.max(8, Math.min(anchorRect.left, window.innerWidth - 280))

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 500 }} />
      <div style={{
        position: 'fixed', top, left, width: 268,
        background: '#FFFFFF', borderRadius: '0.875rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        zIndex: 501, overflow: 'hidden',
      }}>

        {view === 'list' && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px 10px',
              borderBottom: '1px solid rgba(10,126,140,0.10)',
            }}>
              <span style={{
                fontSize: '0.75rem', fontWeight: 700,
                color: '#1A1A2E', letterSpacing: '0.04em',
              }}>Temas</span>
              <button onClick={onClose} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#5a7478', fontSize: '1rem', lineHeight: 1, padding: 2,
              }}>✕</button>
            </div>
            <div style={{ padding: '8px 10px', maxHeight: 240, overflowY: 'auto' }}>
              {topics.length === 0 && (
                <p style={{
                  fontSize: '0.75rem', color: '#5a7478',
                  fontStyle: 'italic', padding: '6px 4px',
                }}>No hay temas creados todavía.</p>
              )}
              {topics.map((t) => {
                const isSelected = selectedId === t.id
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <button
                      type="button"
                      onClick={() => onToggleTopic(t.id)}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center',
                        gap: 8, padding: '8px 10px',
                        background: t.color ?? '#0A7E8C',
                        border: 'none', borderRadius: '0.5rem',
                        cursor: 'pointer', textAlign: 'left',
                        opacity: isSelected ? 1 : 0.75,
                        transition: 'opacity 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = isSelected ? '1' : '0.75' }}
                    >
                      <div style={{
                        width: 16, height: 16, borderRadius: '0.25rem',
                        background: isSelected
                          ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)',
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'center', flexShrink: 0,
                      }}>
                        {isSelected && (
                          <svg width="10" height="10" viewBox="0 0 24 24"
                            fill="none" stroke={t.color ?? '#0A7E8C'}
                            strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      <span style={{
                        fontSize: '0.8125rem', fontWeight: 600,
                        color: 'white', flex: 1,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{t.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenEdit(t)}
                      style={{
                        width: 32, height: 36, borderRadius: '0.5rem',
                        background: 'rgba(10,126,140,0.07)',
                        border: 'none', cursor: 'pointer', flexShrink: 0,
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'center', color: '#5a7478',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(10,126,140,0.14)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(10,126,140,0.07)' }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
            <div style={{
              padding: '8px 10px 12px',
              borderTop: topics.length > 0 ? '1px solid rgba(10,126,140,0.08)' : 'none',
            }}>
              <button
                type="button"
                onClick={onOpenCreate}
                style={{
                  width: '100%', padding: '8px 10px',
                  background: 'rgba(10,126,140,0.07)',
                  border: 'none', borderRadius: '0.5rem',
                  cursor: 'pointer', textAlign: 'center',
                  fontSize: '0.8125rem', fontWeight: 600,
                  color: '#0A7E8C', fontFamily: 'inherit',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(10,126,140,0.13)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(10,126,140,0.07)' }}
              >
                + Crear tema nuevo
              </button>
            </div>
          </>
        )}

        {(view === 'edit' || view === 'create') && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center',
              padding: '12px 14px 10px', gap: 8,
              borderBottom: '1px solid rgba(10,126,140,0.10)',
            }}>
              <button onClick={onBack} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#5a7478', padding: '0 4px 0 0', lineHeight: 1,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <span style={{
                flex: 1, fontSize: '0.75rem', fontWeight: 700,
                color: '#1A1A2E', letterSpacing: '0.04em', textAlign: 'center',
              }}>
                {view === 'create' ? 'Crear tema' : 'Editar tema'}
              </span>
              <button onClick={onClose} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#5a7478', fontSize: '1rem', lineHeight: 1, padding: 2,
              }}>✕</button>
            </div>
            <div style={{ padding: '12px 14px 16px' }}>
              <div style={{
                width: '100%', height: 36, borderRadius: '0.5rem',
                background: editTopicColor, marginBottom: 12,
                display: 'flex', alignItems: 'center', paddingLeft: 12,
              }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'white' }}>
                  {editTopicName || '…'}
                </span>
              </div>
              <p style={{
                fontSize: '0.7rem', fontWeight: 700, color: '#5a7478',
                marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>Nombre</p>
              <input
                type="text"
                value={editTopicName}
                onChange={(e) => setEditTopicName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); onSave() }
                  if (e.key === 'Escape') onBack()
                }}
                autoFocus
                placeholder="Nombre del tema…"
                style={{
                  width: '100%', padding: '8px 10px',
                  border: '1.5px solid rgba(10,126,140,0.20)',
                  borderRadius: '0.5rem', fontSize: '0.875rem',
                  fontWeight: 600, outline: 'none', color: '#1A1A2E',
                  fontFamily: 'inherit', marginBottom: 14,
                  boxSizing: 'border-box', background: '#FAF8F5',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#0A7E8C' }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(10,126,140,0.20)' }}
              />
              <p style={{
                fontSize: '0.7rem', fontWeight: 700, color: '#5a7478',
                marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>Color</p>
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)',
                gap: 6, marginBottom: 14,
              }}>
                {TOPIC_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setEditTopicColor(c.value)}
                    title={c.label}
                    style={{
                      height: 28, borderRadius: '0.375rem',
                      background: c.value, border: 'none', cursor: 'pointer',
                      outline: editTopicColor === c.value
                        ? `2.5px solid ${c.value}` : '2.5px solid transparent',
                      outlineOffset: 2,
                      transform: editTopicColor === c.value ? 'scale(1.1)' : 'scale(1)',
                      transition: 'transform 0.15s',
                    }}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={onSave}
                disabled={editTopicLoading || !editTopicName.trim()}
                style={{
                  width: '100%', padding: '9px',
                  background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                  color: 'white', border: 'none', borderRadius: '0.5rem',
                  fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit', marginBottom: 8,
                  opacity: (editTopicLoading || !editTopicName.trim()) ? 0.5 : 1,
                }}
              >
                {editTopicLoading ? '…' : 'Guardar'}
              </button>
              {view === 'edit' && (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={editTopicLoading}
                  style={{
                    width: '100%', padding: '8px',
                    background: 'none', color: '#ba1a1a',
                    border: 'none', borderRadius: '0.5rem',
                    fontSize: '0.8125rem', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                    opacity: editTopicLoading ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(186,26,26,0.07)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                >
                  Eliminar tema
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function NuevaTareaPage() {
  const router = useRouter()

  const [userId,  setUserId]  = useState<string | null>(null)
  const [crisisId, setCrisisId] = useState<string | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [topics,   setTopics]   = useState<Topic[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  type Doc = {
    id:   string
    name: string
    type: string | null
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
  const [topicId,     setTopicId]     = useState('')

  // Dropdowns
  const [assigneeDropdown, setAssigneeDropdown] = useState<{
    open: boolean; anchorRect: DOMRect | null
  }>({ open: false, anchorRect: null })

  const [topicDropdown, setTopicDropdown] = useState<{
    open: boolean; view: 'list' | 'edit' | 'create'
    editTopic: Topic | null; anchorRect: DOMRect | null
  }>({ open: false, view: 'list', editTopic: null, anchorRect: null })

  const [editTopicName,    setEditTopicName]    = useState('')
  const [editTopicColor,   setEditTopicColor]   = useState('#0A7E8C')
  const [editTopicLoading, setEditTopicLoading] = useState(false)

  // Documentos a asociar
  const [allDocs,       setAllDocs]       = useState<Doc[]>([])
  const [selectedDocIds,setSelectedDocIds]= useState<string[]>([])
  const [docPickerOpen, setDocPickerOpen] = useState(false)

  // ── Auth + load ──────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) { router.replace('/login'); return }
      setUserId(user.id)

      const { data: crisis } = await supabase
        .from('crises')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'activa')
        .maybeSingle()

      if (!crisis) { router.replace('/gestion'); return }
      setCrisisId(crisis.id)

      const [contactsRes, topicsRes, docsRes] = await Promise.all([
        supabase
          .from('contacts')
          .select('id, name, initials')
          .eq('user_id', user.id)
          .in('proximity', ['nucleo', 'ayuda'])
          .order('sort_order', { ascending: true, nullsFirst: false }),
        supabase
          .from('topics')
          .select('id, name, color')
          .eq('crisis_id', crisis.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('documents')
          .select('id, name, type, created_at')
          .eq('crisis_id', crisis.id)
          .order('created_at', { ascending: false }),
      ])

      setContacts((contactsRes.data ?? []) as Contact[])
      setTopics((topicsRes.data ?? []) as Topic[])
      setAllDocs((docsRes.data ?? []) as Doc[])
      setLoading(false)
    }
    load()
  }, [router])

  // ── Assignee dropdown ────────────────────────────────────────────────────────

  function openAssigneeDropdown(e: React.MouseEvent<HTMLButtonElement>) {
    setAssigneeDropdown({ open: true, anchorRect: e.currentTarget.getBoundingClientRect() })
  }

  // ── Topic dropdown ───────────────────────────────────────────────────────────

  function openTopicDropdown(e: React.MouseEvent<HTMLButtonElement>) {
    setTopicDropdown(prev => ({
      ...prev, open: true,
      anchorRect: e.currentTarget.getBoundingClientRect(),
    }))
  }

  function closeTopicDropdown() {
    setTopicDropdown(prev => ({ ...prev, open: false }))
    setEditTopicName('')
    setEditTopicColor('#0A7E8C')
  }

  async function handleSaveTopic() {
    if (!editTopicName.trim() || !crisisId || !userId) return
    setEditTopicLoading(true)

    if (topicDropdown.view === 'create') {
      const { data: newTopic, error } = await supabase
        .from('topics')
        .insert({
          crisis_id: crisisId,
          user_id:   userId,
          name:      editTopicName.trim(),
          color:     editTopicColor,
        })
        .select('id, name, color')
        .single()
      setEditTopicLoading(false)
      if (error) { setError(error.message); return }
      setTopics(prev => [...prev, newTopic as Topic])
      setTopicId(newTopic.id)
    } else if (topicDropdown.view === 'edit' && topicDropdown.editTopic) {
      const { error } = await supabase
        .from('topics')
        .update({ name: editTopicName.trim(), color: editTopicColor })
        .eq('id', topicDropdown.editTopic.id)
      setEditTopicLoading(false)
      if (error) { setError(error.message); return }
      setTopics(prev => prev.map(t =>
        t.id === topicDropdown.editTopic!.id
          ? { ...t, name: editTopicName.trim(), color: editTopicColor }
          : t
      ))
    }
    setTopicDropdown(prev => ({ ...prev, view: 'list', editTopic: null }))
    setEditTopicName('')
    setEditTopicColor('#0A7E8C')
  }

  async function handleDeleteTopic() {
    if (!topicDropdown.editTopic) return
    setEditTopicLoading(true)
    const { error } = await supabase
      .from('topics')
      .delete()
      .eq('id', topicDropdown.editTopic.id)
    setEditTopicLoading(false)
    if (error) { setError(error.message); return }
    const deletedId = topicDropdown.editTopic.id
    setTopics(prev => prev.filter(t => t.id !== deletedId))
    if (topicId === deletedId) setTopicId('')
    setTopicDropdown(prev => ({ ...prev, view: 'list', editTopic: null }))
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!title.trim() || !crisisId || !userId) return
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
        crisis_id:           crisisId,
        title:               title.trim(),
        description:         description.trim() || null,
        due_date:            date || null,
        status:              'pendiente',
        assigned_to_user:    assignedToUser,
        assigned_contact_id: assignedContactId,
        topic_id:            topicId || null,
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

    // Registrar en task_history
    await supabase.from('task_history').insert({
      task_id:     inserted.id,
      crisis_id:   crisisId,
      user_id:     userId,
      event_type:  'tarea_creada',
      description: `Tarea "${title.trim()}" creada`,
    })

    // Llamar al endpoint en background (no bloquea la navegación)
    fetch('/api/task-context', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ task_id: inserted.id, user_id: userId }),
    }).catch((e) => console.error('[nueva-tarea] task-context error:', e))

    router.replace(`/gestion/tarea/${inserted.id}`)
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
        label: c.name,
        initials: (c.initials ?? initialsFrom(c.name)).slice(0, 2),
        bg: 'linear-gradient(135deg, #f4ab66, #E8913A)',
      }
    }
    return null
  }

  const assigneeDisplay = getAssigneeDisplay()
  const selectedTopic   = topics.find(t => t.id === topicId)

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
        .nueva-tarea-bg { animation: heroBgDrift 30s ease-in-out infinite; }
      `}</style>

      {/* Dropdowns */}
      {assigneeDropdown.open && (
        <AssigneeDropdownPortal
          contacts={contacts}
          selectedValue={assignee}
          anchorRect={assigneeDropdown.anchorRect}
          onSelect={setAssignee}
          onClose={() => setAssigneeDropdown({ open: false, anchorRect: null })}
        />
      )}
      {topicDropdown.open && (
        <TopicDropdownPortal
          topics={topics}
          selectedId={topicId}
          anchorRect={topicDropdown.anchorRect}
          view={topicDropdown.view}
          editTopic={topicDropdown.editTopic}
          editTopicName={editTopicName}
          setEditTopicName={setEditTopicName}
          editTopicColor={editTopicColor}
          setEditTopicColor={setEditTopicColor}
          editTopicLoading={editTopicLoading}
          onToggleTopic={(id) => setTopicId(prev => prev === id ? '' : id)}
          onOpenEdit={(t) => {
            setEditTopicName(t.name)
            setEditTopicColor(t.color ?? '#0A7E8C')
            setTopicDropdown(prev => ({ ...prev, view: 'edit', editTopic: t }))
          }}
          onOpenCreate={() => {
            setEditTopicName('')
            setEditTopicColor('#0A7E8C')
            setTopicDropdown(prev => ({ ...prev, view: 'create', editTopic: null }))
          }}
          onBack={() => setTopicDropdown(prev => ({ ...prev, view: 'list', editTopic: null }))}
          onSave={handleSaveTopic}
          onDelete={handleDeleteTopic}
          onClose={closeTopicDropdown}
        />
      )}

      <div className="nueva-tarea-bg flex min-h-screen">
        <Sidebar />

        <main className="flex-1 ml-0 md:ml-[240px] min-h-screen px-5 py-8 pb-28 md:px-10 md:py-10 md:pb-10">

          {/* Breadcrumb */}
          <nav style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Link href="/gestion" style={{
              fontSize: '0.8125rem', color: '#0A7E8C', fontWeight: 600,
              textDecoration: 'none',
            }}>
              Gestión
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
                    {/* Docs seleccionados */}
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

                    {/* Picker */}
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

                    {/* Botón */}
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
