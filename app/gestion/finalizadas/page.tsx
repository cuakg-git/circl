'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import {
  SkeletonStyles, SkeletonText, SkeletonBase,
} from '@/components/Skeleton'

// ── Types ──────────────────────────────────────────────────────────────────────

type Crisis = {
  id:   string
  name: string
}

type Topic = {
  id:    string
  name:  string
  color: string | null
}

type Contact = {
  id:       string
  name:     string
  initials: string | null
}

type Task = {
  id:                  string
  title:               string
  status:              string
  due_date:            string | null
  assigned_contact_id: string | null
  assigned_to_user:    boolean | null
  topic_id:            string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TOPIC_COLORS = [
  { value: '#0A7E8C', label: 'Teal' },
  { value: '#2ECDA7', label: 'Mint' },
  { value: '#8FA44A', label: 'Verde' },
  { value: '#E8913A', label: 'Naranja' },
  { value: '#4BAAB5', label: 'Celeste' },
  { value: '#7B8FA6', label: 'Gris azul' },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtLongDate(iso: string | null) {
  if (!iso) return '—'
  const s = new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function getInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function encodeAssignee(t: Task) {
  if (t.assigned_to_user) return 'yo'
  if (t.assigned_contact_id) return `c:${t.assigned_contact_id}`
  return ''
}

// ── TopicDropdownPortal ────────────────────────────────────────────────────────

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

  const PANEL_W = 260
  const left = Math.min(anchorRect.left, (typeof window !== 'undefined' ? window.innerWidth : 800) - PANEL_W - 8)
  const top  = anchorRect.bottom + 6

  const panel = (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 500 }}
      />

      {/* Floating panel */}
      <div
        style={{
          position: 'fixed', top, left, width: PANEL_W,
          background: '#FFFFFF', borderRadius: '1rem',
          boxShadow: '0 8px 36px rgba(0,0,0,0.18)',
          border: '1px solid rgba(10,126,140,0.10)',
          zIndex: 501, overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── LIST VIEW ── */}
        {view === 'list' && (
          <div>
            <div style={{ padding: '10px 14px 6px', borderBottom: '1px solid rgba(10,126,140,0.08)' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5a7478' }}>
                Temas
              </span>
            </div>
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              {/* "Sin tema" row */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 14px', cursor: 'pointer',
                  background: selectedId === '' ? 'rgba(10,126,140,0.06)' : 'transparent',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => { if (selectedId !== '') e.currentTarget.style.background = 'rgba(10,126,140,0.04)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = selectedId === '' ? 'rgba(10,126,140,0.06)' : 'transparent' }}
                onClick={() => onToggleTopic('')}
              >
                <div style={{
                  width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                  border: '1.5px dashed #9ab4b8', background: 'transparent',
                }} />
                <span style={{ flex: 1, fontSize: '0.8rem', fontWeight: 500, color: '#5a7478' }}>Sin tema</span>
                {selectedId === '' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0A7E8C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              {topics.map((t) => {
                const isSelected = selectedId === t.id
                return (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '9px 14px', cursor: 'pointer',
                      background: isSelected ? `${t.color ?? '#0A7E8C'}12` : 'transparent',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(10,126,140,0.04)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = isSelected ? `${t.color ?? '#0A7E8C'}12` : 'transparent' }}
                  >
                    <div
                      onClick={() => onToggleTopic(t.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}
                    >
                      <div style={{
                        width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                        background: t.color ?? '#0A7E8C',
                      }} />
                      <span style={{ flex: 1, fontSize: '0.8rem', fontWeight: 500, color: '#1A1A2E' }}>{t.name}</span>
                      {isSelected && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.color ?? '#0A7E8C'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onOpenEdit(t) }}
                      title="Editar tema"
                      style={{
                        width: 24, height: 24, borderRadius: '0.35rem', flexShrink: 0,
                        background: 'none', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#9ab4b8', transition: 'background 0.12s, color 0.12s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(10,126,140,0.08)'; e.currentTarget.style.color = '#0A7E8C' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#9ab4b8' }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
            {/* Create link */}
            <div style={{ borderTop: '1px solid rgba(10,126,140,0.08)', padding: '8px 14px' }}>
              <button
                type="button"
                onClick={onOpenCreate}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#0A7E8C', fontSize: '0.75rem', fontWeight: 700,
                  fontFamily: 'inherit', padding: 0, display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Crear tema nuevo
              </button>
            </div>
          </div>
        )}

        {/* ── EDIT / CREATE VIEW ── */}
        {(view === 'edit' || view === 'create') && (
          <div style={{ padding: '14px' }}>
            <button
              type="button"
              onClick={onBack}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#5a7478', fontSize: '0.7rem', fontWeight: 600,
                fontFamily: 'inherit', padding: 0, marginBottom: 10,
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              ← Volver
            </button>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5a7478', marginBottom: 8 }}>
              {view === 'create' ? 'Nuevo tema' : 'Editar tema'}
            </div>
            <input
              type="text"
              placeholder="Nombre del tema…"
              value={editTopicName}
              onChange={(e) => setEditTopicName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); onSave() }
                if (e.key === 'Escape') { onClose() }
              }}
              autoFocus
              style={{
                width: '100%', border: 'none',
                borderBottom: '1.5px solid rgba(10,126,140,0.2)',
                background: 'transparent', fontSize: '0.875rem',
                fontWeight: 600, outline: 'none', color: '#1A1A2E',
                fontFamily: 'inherit', padding: '2px 0', marginBottom: 10,
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {TOPIC_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setEditTopicColor(c.value)}
                  title={c.label}
                  style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: c.value, border: 'none', cursor: 'pointer',
                    outline: editTopicColor === c.value ? `2.5px solid ${c.value}` : '2.5px solid transparent',
                    outlineOffset: 2,
                    transform: editTopicColor === c.value ? 'scale(1.2)' : 'scale(1)',
                    transition: 'transform 0.15s',
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                type="button"
                onClick={onSave}
                disabled={editTopicLoading || !editTopicName.trim()}
                style={{
                  background: '#0A7E8C', color: 'white', border: 'none',
                  borderRadius: '0.5rem', padding: '6px 16px',
                  fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit',
                  opacity: (editTopicLoading || !editTopicName.trim()) ? 0.5 : 1,
                }}
              >
                {editTopicLoading ? '…' : view === 'create' ? 'Crear' : 'Guardar'}
              </button>
              {view === 'edit' && editTopic && (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={editTopicLoading}
                  style={{
                    background: 'rgba(186,26,26,0.07)', color: '#ba1a1a', border: 'none',
                    borderRadius: '0.5rem', padding: '6px 14px',
                    fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                    fontFamily: 'inherit', opacity: editTopicLoading ? 0.5 : 1,
                    marginLeft: 'auto',
                  }}
                >
                  Eliminar
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )

  return createPortal(panel, document.body)
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function FinalizadasPage() {
  const router = useRouter()

  const [loading,  setLoading]  = useState(true)
  const [crisis,   setCrisis]   = useState<Crisis | null>(null)
  const [tasks,    setTasks]    = useState<Task[]>([])
  const [topics,   setTopics]   = useState<Topic[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])

  const [ssMode,    setSsMode]    = useState<'task-view' | null>(null)
  const [ssTask,    setSsTask]    = useState<Task | null>(null)
  const [ssLoading, setSsLoading] = useState(false)
  const [ssError,   setSsError]   = useState<string | null>(null)
  const [tvAssignee, setTvAssignee] = useState('')
  const [tvTopicId,        setTvTopicId]        = useState<string>('')
  const [editTopicName,    setEditTopicName]    = useState('')
  const [editTopicColor,   setEditTopicColor]   = useState('#0A7E8C')
  const [editTopicLoading, setEditTopicLoading] = useState(false)
  const [topicDropdown,    setTopicDropdown]    = useState<{
    open:       boolean
    view:       'list' | 'edit' | 'create'
    editTopic:  Topic | null
    anchorRect: DOMRect | null
  }>({
    open: false, view: 'list',
    editTopic: null, anchorRect: null,
  })

  useEffect(() => {
    async function load() {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) { router.replace('/login'); return }

      const { data: activeCrisis } = await supabase
        .from('crises')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('status', 'activa')
        .maybeSingle()

      if (!activeCrisis) { setLoading(false); return }
      setCrisis(activeCrisis)

      const [tasksRes, topicsRes, contactsRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('id, title, status, due_date, assigned_contact_id, assigned_to_user, topic_id')
          .eq('crisis_id', activeCrisis.id)
          .eq('status', 'completada')
          .order('due_date', { ascending: false, nullsFirst: false }),
        supabase
          .from('topics')
          .select('id, name, color')
          .eq('crisis_id', activeCrisis.id)
          .order('created_at', { ascending: true }),
        supabase
          .from('crisis_contacts')
          .select('contact:contacts(id, name, initials)')
          .eq('crisis_id', activeCrisis.id),
      ])

      setTasks((tasksRes.data ?? []) as Task[])
      setTopics((topicsRes.data ?? []) as Topic[])

      const ccRows = (contactsRes.data ?? []) as { contact: Contact | Contact[] | null }[]
      const dedup  = new Map<string, Contact>()
      for (const r of ccRows) {
        const c = Array.isArray(r.contact) ? r.contact[0] : r.contact
        if (c && !dedup.has(c.id)) dedup.set(c.id, c)
      }
      setContacts(Array.from(dedup.values()))

      setLoading(false)
    }
    load()
  }, [router])

  const contactById = new Map(contacts.map((c) => [c.id, c]))
  const isOpen      = ssMode !== null

  function openTaskView(t: Task) {
    setSsTask(t)
    setTvAssignee(encodeAssignee(t))
    setTvTopicId(t.topic_id ?? '')
    setSsError(null)
    setSsMode('task-view')
  }

  function closeSheet() {
    setSsMode(null)
    setSsTask(null)
    setSsError(null)
  }

  async function handleToggleStatus() {
    if (!ssTask || ssLoading) return
    setSsLoading(true)
    setSsError(null)
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'pendiente' })
      .eq('id', ssTask.id)
    setSsLoading(false)
    if (error) { setSsError(error.message); return }
    setTasks(prev => prev.filter(t => t.id !== ssTask.id))
    closeSheet()
  }

  function openTopicDropdown(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    setTopicDropdown({ open: true, view: 'list', editTopic: null, anchorRect: rect })
  }

  function closeTopicDropdown() {
    setTopicDropdown(prev => ({ ...prev, open: false }))
    setEditTopicName('')
    setEditTopicColor('#0A7E8C')
  }

  function openEditTopic(topic: Topic) {
    setEditTopicName(topic.name)
    setEditTopicColor(topic.color ?? '#0A7E8C')
    setTopicDropdown(prev => ({ ...prev, view: 'edit', editTopic: topic }))
  }

  function openCreateTopic() {
    setEditTopicName('')
    setEditTopicColor('#0A7E8C')
    setTopicDropdown(prev => ({ ...prev, view: 'create', editTopic: null }))
  }

  async function handleTopicChange(topicId: string) {
    if (!ssTask) return
    setTvTopicId(topicId)
    const { error } = await supabase
      .from('tasks')
      .update({ topic_id: topicId || null })
      .eq('id', ssTask.id)
    if (error) { setSsError(error.message); return }
    setTasks(prev => prev.map(t =>
      t.id === ssTask.id ? { ...t, topic_id: topicId || null } : t
    ))
  }

  async function handleToggleTopicOnTask(topicId: string) {
    const newId = tvTopicId === topicId ? '' : topicId
    setTvTopicId(newId)
    await handleTopicChange(newId)
  }

  async function handleSaveTopic() {
    if (!editTopicName.trim() || !crisis?.id) return
    setEditTopicLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setEditTopicLoading(false); return }

    if (topicDropdown.view === 'create') {
      const { data: newTopic, error } = await supabase
        .from('topics')
        .insert({
          crisis_id: crisis.id,
          user_id:   user.id,
          name:      editTopicName.trim(),
          color:     editTopicColor,
        })
        .select('id, name, color')
        .single()
      setEditTopicLoading(false)
      if (error) { setSsError(error.message); return }
      setTopics(prev => [...prev, newTopic as Topic])
      setTvTopicId(newTopic.id)
      await handleTopicChange(newTopic.id)
    } else if (topicDropdown.view === 'edit' && topicDropdown.editTopic) {
      const { error } = await supabase
        .from('topics')
        .update({ name: editTopicName.trim(), color: editTopicColor })
        .eq('id', topicDropdown.editTopic.id)
      setEditTopicLoading(false)
      if (error) { setSsError(error.message); return }
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
    if (error) { setSsError(error.message); return }
    const deletedId = topicDropdown.editTopic.id
    setTopics(prev => prev.filter(t => t.id !== deletedId))
    if (tvTopicId === deletedId) setTvTopicId('')
    setTopicDropdown(prev => ({ ...prev, view: 'list', editTopic: null }))
  }

  return (
    <>
      {/* ══════════════════════════════════════════════════════════════════════
          SIDESHEET OVERLAY + PANEL
      ══════════════════════════════════════════════════════════════════════ */}

      {/* Overlay */}
      <div
        onClick={closeSheet}
        style={{
          position:       'fixed',
          inset:          0,
          background:     'rgba(0,0,0,0.22)',
          zIndex:         200,
          opacity:        isOpen ? 1 : 0,
          pointerEvents:  isOpen ? 'auto' : 'none',
          transition:     'opacity 0.3s',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position:   'fixed',
          top:        0,
          right:      0,
          width:      420,
          maxWidth:   '100vw',
          height:     '100vh',
          background: '#f0f4f8',
          boxShadow:  isOpen ? '0 0 40px rgba(0,0,0,0.16)' : 'none',
          zIndex:     201,
          transform:  isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s, box-shadow 0.3s',
          overflowY:  'auto',
        }}
      >
        {/* ── TASK VIEW ── */}
        {ssMode === 'task-view' && ssTask && (() => {
          const isDone = ssTask.status === 'completada'
          return (
            <div style={{ padding: '0 24px 40px', flex: 1 }}>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                textAlign: 'center', padding: '24px 0 20px',
                borderBottom: '1px solid rgba(10,126,140,0.12)', marginBottom: 24,
              }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: isDone ? 'rgba(46,205,167,0.08)' : 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '1.5rem', color: 'white',
                  boxShadow: '0 8px 40px rgba(10,126,140,0.16)', marginBottom: 14,
                }}>
                  {isDone ? (
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                      stroke="#2ECDA7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : ''}
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8, color: '#1A1A2E' }}>
                  {ssTask.title}
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
                }}>Detalles</p>
                <div style={{
                  background: '#FFFFFF', borderRadius: '1rem',
                  boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                  padding: 0, borderRadius: '1rem',
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '13px 20px', borderBottom: '1px solid rgba(10,126,140,0.12)', gap: 12,
                  }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                      textTransform: 'uppercase', color: '#5a7478', minWidth: 80,
                    }}>Fecha</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1A1A2E', flex: 1 }}>
                      {ssTask.due_date ? fmtLongDate(ssTask.due_date) : 'Sin fecha'}
                    </span>
                  </div>

                  <div style={{
                    display: 'flex', alignItems: 'center',
                    padding: '13px 20px',
                    borderTop: '1px solid rgba(10,126,140,0.12)', gap: 12,
                  }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                      textTransform: 'uppercase', color: '#5a7478',
                      minWidth: 80, flexShrink: 0,
                    }}>Tema</span>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {tvTopicId && (() => {
                        const t = topics.find(tp => tp.id === tvTopicId)
                        return t ? (
                          <span style={{
                            padding: '3px 10px', borderRadius: 9999,
                            background: `${t.color ?? '#0A7E8C'}22`,
                            color: t.color ?? '#0A7E8C',
                            fontSize: '0.75rem', fontWeight: 700,
                          }}>{t.name}</span>
                        ) : null
                      })()}
                      <button
                        type="button"
                        onClick={(e) => openTopicDropdown(e)}
                        style={{
                          padding: 0, background: 'none', border: 'none',
                          color: '#0A7E8C', fontSize: '0.8125rem',
                          fontWeight: 600, cursor: 'pointer',
                          fontFamily: 'inherit',
                          textDecoration: 'underline',
                          textUnderlineOffset: 3,
                        }}
                      >
                        {tvTopicId ? 'Cambiar' : 'Agregar'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {ssError && (
                <p style={{
                  fontSize: '0.7rem', color: '#ba1a1a', fontWeight: 600,
                  marginBottom: 16, padding: '10px 14px',
                  background: 'rgba(186,26,26,0.06)', borderRadius: '0.6rem',
                }}>
                  {ssError}
                </p>
              )}

              <div style={{ marginBottom: 24 }}>
                <button
                  onClick={handleToggleStatus}
                  disabled={ssLoading}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 9999,
                    border: 'none', cursor: ssLoading ? 'not-allowed' : 'pointer',
                    fontWeight: 700, fontSize: '0.875rem', transition: 'filter 0.15s',
                    background: isDone
                      ? 'rgba(10,126,140,0.12)'
                      : 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                    color: isDone ? '#0A7E8C' : 'white',
                    opacity: ssLoading ? 0.6 : 1,
                  }}
                >
                  {ssLoading ? 'Procesando…' : 'Reabrir tarea'}
                </button>
              </div>
            </div>
          )
        })()}
      </div>

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
          50% {
            background:
              radial-gradient(ellipse at 10% 22%, rgba(61,199,166,0.03)  0%, transparent 55%),
              radial-gradient(ellipse at 78%  8%, rgba(80,220,175,0.07)  0%, transparent 50%),
              radial-gradient(ellipse at 92% 75%, rgba(224,121,49,0.08)  0%, transparent 52%),
              radial-gradient(ellipse at 18% 92%, rgba(158,160,81,0.08)  0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 65%),
              #f0f4f8;
          }
        }
        .finalizadas-bg { animation: heroBgDrift 30s ease-in-out infinite; }
      `}</style>

      {topicDropdown.open && (
        <TopicDropdownPortal
          topics={topics}
          selectedId={tvTopicId}
          anchorRect={topicDropdown.anchorRect}
          view={topicDropdown.view}
          editTopic={topicDropdown.editTopic}
          editTopicName={editTopicName}
          setEditTopicName={setEditTopicName}
          editTopicColor={editTopicColor}
          setEditTopicColor={setEditTopicColor}
          editTopicLoading={editTopicLoading}
          onToggleTopic={handleToggleTopicOnTask}
          onOpenEdit={openEditTopic}
          onOpenCreate={openCreateTopic}
          onBack={() => setTopicDropdown(prev => ({
            ...prev, view: 'list', editTopic: null,
          }))}
          onSave={handleSaveTopic}
          onDelete={handleDeleteTopic}
          onClose={closeTopicDropdown}
        />
      )}

      <div className="finalizadas-bg flex min-h-screen">
        <Sidebar />

        <main className="flex-1 ml-0 md:ml-[240px] min-h-screen px-5 py-8 pb-28 md:px-10 md:py-10 md:pb-10">
          <SkeletonStyles />

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
              Tareas finalizadas
            </span>
          </nav>

          {/* Header */}
          {!loading && crisis && (
            <div style={{ marginBottom: 32 }}>
              <h1 style={{
                fontSize: '2rem', fontWeight: 800,
                letterSpacing: '-0.03em', color: '#1A1A2E',
                marginBottom: 4, lineHeight: 1.15,
              }}>
                Tareas finalizadas
              </h1>
              <p style={{ fontSize: '0.875rem', color: '#5a7478', fontWeight: 500 }}>
                {crisis.name}
              </p>
            </div>
          )}

          {/* Empty state — no active crisis */}
          {!loading && !crisis && (
            <div style={{ textAlign: 'center', marginTop: 80 }}>
              <p style={{ fontSize: '1rem', fontWeight: 700, color: '#1A1A2E', marginBottom: 8 }}>
                No hay ninguna crisis activa
              </p>
              <Link href="/chat" style={{
                display: 'inline-block', background: '#0A7E8C', color: 'white',
                fontWeight: 700, borderRadius: 9999, padding: '12px 28px',
                fontSize: '0.875rem', textDecoration: 'none',
              }}>
                Hablar con el agente
              </Link>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div>
              <div style={{ marginBottom: 32 }}>
                <SkeletonText width="35%" style={{ height: 32, marginBottom: 10 }} />
                <SkeletonText width="50%" />
              </div>
              <div style={{
                background: '#FFFFFF', borderRadius: '1.5rem',
                boxShadow: '0 4px 24px rgba(10,126,140,0.08)', padding: 24,
              }}>
                {[80, 60, 75, 55, 70].map((w, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '13px 0',
                    borderBottom: i < 4 ? '1px solid rgba(10,126,140,0.08)' : 'none',
                  }}>
                    <div style={{ flex: 1 }}>
                      <SkeletonText width={`${w}%`} />
                      <div style={{ marginTop: 6 }}>
                        <SkeletonBase width={80} height={10} style={{ borderRadius: 4 }} />
                      </div>
                    </div>
                    <SkeletonBase width={24} height={24} style={{ borderRadius: '50%', flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lista de tareas finalizadas */}
          {!loading && crisis && (
            <div style={{ maxWidth: 680 }}>
              <div style={{
                background: '#FFFFFF', borderRadius: '1.5rem',
                boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                padding: 24,
              }}>
                {tasks.length === 0 ? (
                  <p style={{
                    fontSize: '0.875rem', color: '#5a7478',
                    textAlign: 'center', padding: '24px 0',
                    fontStyle: 'italic',
                  }}>
                    No hay tareas finalizadas todavía.
                  </p>
                ) : (
                  <div className="flex flex-col">
                    {tasks.map((t, i) => {
                      const contact = t.assigned_contact_id
                        ? contactById.get(t.assigned_contact_id)
                        : null
                      let avInitials = '', avBg = ''
                      if (t.assigned_to_user) {
                        avInitials = 'Yo'
                        avBg = 'linear-gradient(135deg, #0A7E8C, #2ECDA7)'
                      } else if (contact) {
                        avInitials = (contact.initials ?? getInitials(contact.name)).slice(0, 2)
                        avBg = 'linear-gradient(135deg, #f4ab66, #E8913A)'
                      }
                      const topic = t.topic_id
                        ? topics.find(tp => tp.id === t.topic_id)
                        : null

                      return (
                        <div
                          key={t.id}
                          onClick={() => openTaskView(t)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 14,
                            padding: '13px 6px',
                            borderBottom: i < tasks.length - 1
                              ? '1px solid rgba(10,126,140,0.08)' : 'none',
                            margin: '0 -6px',
                            cursor: 'pointer',
                            borderRadius: '0.5rem',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(61,199,166,0.07)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                        >
                          {/* Check icon */}
                          <div style={{
                            width: 20, height: 20, borderRadius: '50%',
                            background: 'rgba(46,205,167,0.15)',
                            display: 'flex', alignItems: 'center',
                            justifyContent: 'center', flexShrink: 0,
                          }}>
                            <svg width="11" height="11" viewBox="0 0 24 24"
                              fill="none" stroke="#2ECDA7"
                              strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>

                          {/* Contenido */}
                          <div className="flex-1 min-w-0">
                            <div style={{
                              fontSize: '0.875rem', fontWeight: 600,
                              color: '#1A1A2E',
                              whiteSpace: 'nowrap', overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}>
                              {t.title}
                            </div>
                            <div style={{
                              display: 'flex', alignItems: 'center',
                              gap: 8, marginTop: 3, flexWrap: 'wrap',
                            }}>
                              {t.due_date && (
                                <span style={{ fontSize: '0.7rem', color: '#5a7478' }}>
                                  {fmtLongDate(t.due_date)}
                                </span>
                              )}
                              {topic && (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center',
                                  padding: '1px 7px', borderRadius: 9999,
                                  background: `${topic.color ?? '#0A7E8C'}22`,
                                  color: topic.color ?? '#0A7E8C',
                                  fontSize: '0.65rem', fontWeight: 700,
                                  letterSpacing: '0.04em',
                                }}>
                                  {topic.name}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Avatar asignado */}
                          {avInitials && (
                            <div style={{
                              width: 24, height: 24, borderRadius: '50%',
                              background: avBg, flexShrink: 0,
                              display: 'flex', alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.62rem', fontWeight: 700, color: 'white',
                            }}>
                              {avInitials}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  )
}
