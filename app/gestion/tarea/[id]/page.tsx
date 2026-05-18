'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────────

type Task = {
  id:                  string
  title:               string
  description:         string | null
  status:              string
  due_date:            string | null
  assigned_contact_id: string | null
  assigned_to_user:    boolean | null
  topic_id:            string | null
  context:             string | null
  created_at:          string
}

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

type Doc = {
  id:                string
  name:              string
  type:              string | null
  created_at:        string
  storage_path:      string
  original_filename: string | null
  file_mime_type:    string | null
}

type TaskDoc = {
  id:          string
  document_id: string
  doc:         Doc
}

type HistoryEvent = {
  id:          string
  event_type:  string
  description: string | null
  occurred_at: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  estudio_medico: 'Estudio médico',
  receta:         'Receta',
  informe:        'Informe',
  otros:          'Otros',
}

const DOC_TYPE_OPTIONS = Object.entries(DOC_TYPE_LABELS)

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

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const s = new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function fmtDateTime(iso: string) {
  const d = new Date(iso)
  const date = d.toLocaleDateString('es-AR', {
    day: 'numeric', month: 'long',
  })
  const time = d.toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit',
  })
  return `${date.charAt(0).toUpperCase() + date.slice(1)} · ${time}`
}

const EVENT_LABELS: Record<string, string> = {
  tarea_creada:        'Tarea creada',
  estado_cambiado:     'Estado actualizado',
  asignacion_cambiada: 'Asignación cambiada',
  tema_cambiado:       'Tema cambiado',
  contexto_actualizado:'Descripción actualizada',
}

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
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1A1A2E' }}>
            Asignar a
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#5a7478', fontSize: '1rem', lineHeight: 1,
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
                  fontSize: '0.875rem',
                  fontWeight: isSelected ? 700 : 500,
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
  topics, selectedId, anchorRect, view, editTopic,
  editTopicName, setEditTopicName, editTopicColor, setEditTopicColor,
  editTopicLoading, onToggleTopic, onOpenEdit, onOpenCreate,
  onBack, onSave, onDelete, onClose,
}: {
  topics: Topic[]; selectedId: string; anchorRect: DOMRect | null
  view: 'list' | 'edit' | 'create'; editTopic: Topic | null
  editTopicName: string; setEditTopicName: (v: string) => void
  editTopicColor: string; setEditTopicColor: (v: string) => void
  editTopicLoading: boolean
  onToggleTopic: (id: string) => void; onOpenEdit: (t: Topic) => void
  onOpenCreate: () => void; onBack: () => void
  onSave: () => void; onDelete: () => void; onClose: () => void
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
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1A1A2E' }}>Temas</span>
              <button onClick={onClose} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#5a7478', fontSize: '1rem', lineHeight: 1,
              }}>✕</button>
            </div>
            <div style={{ padding: '8px 10px', maxHeight: 240, overflowY: 'auto' }}>
              {topics.length === 0 && (
                <p style={{ fontSize: '0.75rem', color: '#5a7478', fontStyle: 'italic', padding: '6px 4px' }}>
                  No hay temas creados todavía.
                </p>
              )}
              {topics.map((t) => {
                const isSelected = selectedId === t.id
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <button
                      type="button"
                      onClick={() => onToggleTopic(t.id)}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 10px', background: t.color ?? '#0A7E8C',
                        border: 'none', borderRadius: '0.5rem', cursor: 'pointer',
                        opacity: isSelected ? 1 : 0.75, transition: 'opacity 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = isSelected ? '1' : '0.75' }}
                    >
                      <div style={{
                        width: 16, height: 16, borderRadius: '0.25rem',
                        background: isSelected ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {isSelected && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                            stroke={t.color ?? '#0A7E8C'} strokeWidth="3.5"
                            strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      <span style={{
                        fontSize: '0.8125rem', fontWeight: 600, color: 'white',
                        flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>{t.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenEdit(t)}
                      style={{
                        width: 32, height: 36, borderRadius: '0.5rem',
                        background: 'rgba(10,126,140,0.07)', border: 'none',
                        cursor: 'pointer', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#5a7478', transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(10,126,140,0.14)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(10,126,140,0.07)' }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2"
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
                type="button" onClick={onOpenCreate}
                style={{
                  width: '100%', padding: '8px 10px',
                  background: 'rgba(10,126,140,0.07)',
                  border: 'none', borderRadius: '0.5rem', cursor: 'pointer',
                  textAlign: 'center', fontSize: '0.8125rem', fontWeight: 600,
                  color: '#0A7E8C', fontFamily: 'inherit', transition: 'background 0.15s',
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <span style={{
                flex: 1, fontSize: '0.75rem', fontWeight: 700,
                color: '#1A1A2E', textAlign: 'center',
              }}>
                {view === 'create' ? 'Crear tema' : 'Editar tema'}
              </span>
              <button onClick={onClose} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#5a7478', fontSize: '1rem', lineHeight: 1,
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
                type="text" value={editTopicName}
                onChange={(e) => setEditTopicName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); onSave() }
                  if (e.key === 'Escape') onBack()
                }}
                autoFocus placeholder="Nombre del tema…"
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
                    key={c.value} type="button"
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
                type="button" onClick={onSave}
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
                  type="button" onClick={onDelete}
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

export default function TareaDetailPage() {
  const router  = useRouter()
  const params  = useParams()
  const taskId  = params.id as string

  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [task,     setTask]     = useState<Task | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [topics,   setTopics]   = useState<Topic[]>([])
  const [history,  setHistory]  = useState<HistoryEvent[]>([])
  const [userId,   setUserId]   = useState<string | null>(null)
  const [crisisId, setCrisisId] = useState<string | null>(null)
  const [error,    setError]    = useState<string | null>(null)

  // Edición inline
  const [editingTitle, setEditingTitle]   = useState(false)
  const [titleVal,     setTitleVal]       = useState('')
  const [editingDesc,  setEditingDesc]    = useState(false)
  const [descVal,      setDescVal]        = useState('')
  const [editingDate,  setEditingDate]    = useState(false)
  const [dateVal,      setDateVal]        = useState('')

  // Dropdowns
  const [assigneeVal, setAssigneeVal] = useState('')
  const [assigneeDropdown, setAssigneeDropdown] = useState<{
    open: boolean; anchorRect: DOMRect | null
  }>({ open: false, anchorRect: null })

  const [topicVal, setTopicVal] = useState('')
  const [topicDropdown, setTopicDropdown] = useState<{
    open: boolean; view: 'list' | 'edit' | 'create'
    editTopic: Topic | null; anchorRect: DOMRect | null
  }>({ open: false, view: 'list', editTopic: null, anchorRect: null })

  const [editTopicName,    setEditTopicName]    = useState('')
  const [editTopicColor,   setEditTopicColor]   = useState('#0A7E8C')
  const [editTopicLoading, setEditTopicLoading] = useState(false)

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Documentos asociados
  const [taskDocs,        setTaskDocs]        = useState<TaskDoc[]>([])
  const [allDocs,         setAllDocs]         = useState<Doc[]>([])
  const [docPickerOpen,   setDocPickerOpen]   = useState(false)
  const [docLinkLoading,  setDocLinkLoading]  = useState(false)
  const [docUnlinkLoading,setDocUnlinkLoading]= useState<string | null>(null)

  // Upload de documento nuevo
  const [docUploadOpen,   setDocUploadOpen]   = useState(false)
  const [uploadName,      setUploadName]      = useState('')
  const [uploadType,      setUploadType]      = useState('estudio_medico')
  const [uploadFile,      setUploadFile]      = useState<File | null>(null)
  const [uploadLoading,   setUploadLoading]   = useState(false)
  const [isDragging,      setIsDragging]      = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

  // Contexto y sugerencias
  const [taskContext,       setTaskContext]       = useState<string | null>(null)
  const [contextLoading,    setContextLoading]    = useState(false)
  const [suggestedAssignee, setSuggestedAssignee] = useState<{
    name: string; reason: string
  } | null>(null)
  const [suggestedTopics,   setSuggestedTopics]   = useState<string[]>([])

  // Minichat
  const [chatMessages,    setChatMessages]    = useState<
    { role: 'agent' | 'user'; content: string }[]
  >([])
  const [chatInput,       setChatInput]       = useState('')
  const [chatLoading,     setChatLoading]     = useState(false)
  const [chatQuestion,    setChatQuestion]    = useState<string | null>(null)
  const [chatSuggestions, setChatSuggestions] = useState<string[]>([])
  const [chatDone,        setChatDone]        = useState(false)

  // ── Load ──────────────────────────────────────────────────────────────────────

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

      const [taskRes, contactsRes, topicsRes, historyRes, taskDocsRes, allDocsRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('id, title, description, status, due_date, assigned_contact_id, assigned_to_user, topic_id, context, created_at')
          .eq('id', taskId)
          .eq('crisis_id', crisis.id)
          .maybeSingle(),
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
          .from('task_history')
          .select('id, event_type, description, occurred_at')
          .eq('task_id', taskId)
          .order('occurred_at', { ascending: false }),
        supabase
          .from('task_documents')
          .select('id, document_id, doc:documents(id, name, type, created_at, storage_path, original_filename, file_mime_type)')
          .eq('task_id', taskId)
          .order('created_at', { ascending: false }),
        supabase
          .from('documents')
          .select('id, name, type, created_at, storage_path, original_filename, file_mime_type')
          .eq('crisis_id', crisis.id)
          .order('created_at', { ascending: false }),
      ])

      if (!taskRes.data) { router.replace('/gestion'); return }

      const t = taskRes.data as Task
      setTask(t)
      setTaskContext(t.context ?? null)

      // Inicializar minichat con pregunta inicial
      setChatQuestion('Hay alguna novedad con esta tarea')
      setChatSuggestions([
        'Todo sigue igual',
        'Cambió la fecha',
        'Ya la hice',
      ])

      setTitleVal(t.title)
      setDescVal(t.description ?? '')
      setDateVal(t.due_date ?? '')

      // Encode assignee
      if (t.assigned_to_user) setAssigneeVal('yo')
      else if (t.assigned_contact_id) setAssigneeVal(`c:${t.assigned_contact_id}`)
      else setAssigneeVal('')

      setTopicVal(t.topic_id ?? '')
      setContacts((contactsRes.data ?? []) as Contact[])
      setTopics((topicsRes.data ?? []) as Topic[])
      setHistory((historyRes.data ?? []) as HistoryEvent[])
      const rawTaskDocs = (taskDocsRes.data ?? []).map((row: any) => ({
        id:          row.id,
        document_id: row.document_id,
        doc:         Array.isArray(row.doc) ? row.doc[0] : row.doc,
      })) as TaskDoc[]
      setTaskDocs(rawTaskDocs)
      setAllDocs((allDocsRes.data ?? []) as Doc[])
      setLoading(false)

      if (t.context) {
        // Tarea con contexto ya generado: pedir solo sugerencias (modo liviano)
        fetch('/api/task-context', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            task_id:          taskRes.data.id,
            user_id:          user.id,
            suggestions_only: true,
          }),
        })
          .then(r => r.json())
          .then(json => {
            if (json.suggested_assignee) setSuggestedAssignee(json.suggested_assignee)
            if (json.suggested_topics?.length > 0) setSuggestedTopics(json.suggested_topics)
          })
          .catch(e => console.error('[tarea-detail] suggestions error:', e))
      } else {
        // Tarea sin contexto: generarlo completo
        fetch('/api/task-context', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ task_id: taskRes.data.id, user_id: user.id }),
        })
          .then(r => r.json())
          .then(json => {
            if (json.context)            setTaskContext(json.context)
            if (json.suggested_assignee) setSuggestedAssignee(json.suggested_assignee)
            if (json.suggested_topics?.length > 0) setSuggestedTopics(json.suggested_topics)
            if (json.next_question) {
              setChatQuestion(json.next_question)
              setChatSuggestions(json.suggestions ?? [])
            }
          })
          .catch(e => console.error('[tarea-detail] init context error:', e))
      }
    }
    load()
  }, [router, taskId])

  // ── Reload history ────────────────────────────────────────────────────────────

  function fmtShortDate(iso: string | null) {
    if (!iso) return ''
    return new Date(iso)
      .toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
      .replace('.', '')
  }

  async function reloadTaskDocs() {
    const { data } = await supabase
      .from('task_documents')
      .select('id, document_id, doc:documents(id, name, type, created_at, storage_path, original_filename, file_mime_type)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
    if (data) {
      const rawTaskDocs = data.map((row: any) => ({
        id:          row.id,
        document_id: row.document_id,
        doc:         Array.isArray(row.doc) ? row.doc[0] : row.doc,
      })) as TaskDoc[]
      setTaskDocs(rawTaskDocs)
    }
  }

  async function handleLinkDoc(docId: string) {
    setDocLinkLoading(true)
    const { error } = await supabase
      .from('task_documents')
      .insert({ task_id: taskId, document_id: docId })
    setDocLinkLoading(false)
    if (error) { setError(error.message); return }
    await reloadTaskDocs()
    setDocPickerOpen(false)
    await logEvent('contexto_actualizado', 'Documento asociado a la tarea')
  }

  function handleFileSelect(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setError('El archivo supera el límite de 10 MB')
      return
    }
    setError(null)
    setUploadFile(file)
    if (!uploadName.trim()) {
      setUploadName(file.name.replace(/\.[^/.]+$/, ''))
    }
  }

  async function handleUploadNewDoc() {
    if (!uploadFile || !uploadName.trim() || !crisisId || uploadLoading) return
    setUploadLoading(true)
    setError(null)

    // 1. Subir archivo a storage
    const timestamp = Date.now()
    const safeName  = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path      = `${crisisId}/${timestamp}_${safeName}`

    const { error: uploadErr } = await supabase.storage
      .from('docs')
      .upload(path, uploadFile)

    if (uploadErr) {
      setUploadLoading(false)
      setError(`Error al subir el archivo: ${uploadErr.message}`)
      return
    }

    // 2. Crear registro en documents
    const { data: newDoc, error: dbErr } = await supabase
      .from('documents')
      .insert({
        crisis_id:              crisisId,
        name:                   uploadName.trim(),
        type:                   uploadType,
        storage_path:           path,
        original_filename:      uploadFile.name,
        file_size_bytes:        uploadFile.size,
        file_mime_type:         uploadFile.type,
        uploaded_by_user:       true,
        uploaded_by_contact_id: null,
      })
      .select('id')
      .single()

    if (dbErr) {
      await supabase.storage.from('docs').remove([path])
      setUploadLoading(false)
      setError(dbErr.message)
      return
    }

    // 3. Asociar a la tarea
    const { error: linkErr } = await supabase
      .from('task_documents')
      .insert({ task_id: taskId, document_id: newDoc.id })

    if (linkErr) {
      setUploadLoading(false)
      setError(linkErr.message)
      return
    }

    // 4. Recargar y resetear
    await reloadTaskDocs()

    // Recargar allDocs también
    const { data: freshDocs } = await supabase
      .from('documents')
      .select('id, name, type, created_at, storage_path, original_filename, file_mime_type')
      .eq('crisis_id', crisisId)
      .order('created_at', { ascending: false })
    if (freshDocs) setAllDocs(freshDocs as Doc[])

    await logEvent('contexto_actualizado', `Documento "${uploadName.trim()}" subido y asociado`)

    setUploadLoading(false)
    setDocUploadOpen(false)
    setUploadName('')
    setUploadType('estudio_medico')
    setUploadFile(null)
  }

  async function handleUnlinkDoc(taskDocId: string) {
    setDocUnlinkLoading(taskDocId)
    const { error } = await supabase
      .from('task_documents')
      .delete()
      .eq('id', taskDocId)
    setDocUnlinkLoading(null)
    if (error) { setError(error.message); return }
    await reloadTaskDocs()
  }

  async function reloadHistory() {
    const { data } = await supabase
      .from('task_history')
      .select('id, event_type, description, occurred_at')
      .eq('task_id', taskId)
      .order('occurred_at', { ascending: false })
    if (data) setHistory(data as HistoryEvent[])
  }

  // ── callTaskContext ───────────────────────────────────────────────────────────

  async function callTaskContext(userMessage?: string) {
    if (!userId) return
    setChatLoading(true)
    setSuggestedAssignee(null)
    setSuggestedTopics([])

    // Agregar mensaje del usuario al historial si existe
    const newHistory = userMessage
      ? [...chatMessages, { role: 'user' as const, content: userMessage }]
      : chatMessages

    if (userMessage) {
      setChatMessages(newHistory)
      setChatInput('')
    }

    try {
      const res = await fetch('/api/task-context', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          task_id:      taskId,
          user_id:      userId,
          user_message: userMessage ?? null,
          chat_history: newHistory,
        }),
      })
      const json = await res.json()

      // Actualizar contexto
      if (json.context) setTaskContext(json.context)

      // Agregar respuesta del agente al historial
      if (json.context && userMessage) {
        setChatMessages(prev => [
          ...prev,
          { role: 'agent', content: json.context },
        ])
      }

      // Sugerencias de asignado y tema
      if (json.suggested_assignee) setSuggestedAssignee(json.suggested_assignee)
      if (json.suggested_topics?.length > 0) setSuggestedTopics(json.suggested_topics)

      // Próxima pregunta o fin del chat
      if (json.next_question) {
        setChatQuestion(json.next_question)
        setChatSuggestions(json.suggestions ?? [])
        setChatDone(false)
      } else {
        setChatQuestion(null)
        setChatSuggestions([])
        setChatDone(true)
      }

      // Aplicar field_updates automáticamente
      if (json.field_updates && Object.keys(json.field_updates).length > 0) {
        const fu = json.field_updates

        // Actualizar estado local de la tarea
        setTask(prev => {
          if (!prev) return null
          const updated = { ...prev }
          if (fu.due_date !== undefined)         updated.due_date         = fu.due_date
          if (fu.status !== undefined)           updated.status           = fu.status
          if (fu.assigned_to_user !== undefined) {
            updated.assigned_to_user    = fu.assigned_to_user
            updated.assigned_contact_id = null
          }
          if (fu.assigned_contact_name) {
            const match = contacts.find(c =>
              c.name.toLowerCase() === fu.assigned_contact_name.toLowerCase()
            )
            if (match) {
              updated.assigned_contact_id = match.id
              updated.assigned_to_user    = false
            }
          }
          return updated
        })

        // Actualizar assigneeVal si cambió
        if (fu.assigned_to_user === true) {
          setAssigneeVal('yo')
        } else if (fu.assigned_contact_name) {
          const match = contacts.find(c =>
            c.name.toLowerCase() === fu.assigned_contact_name.toLowerCase()
          )
          if (match) setAssigneeVal(`c:${match.id}`)
        }

        // Actualizar dateVal si cambió
        if (fu.due_date !== undefined) setDateVal(fu.due_date ?? '')

        // Log en historial
        await reloadHistory()
      }

    } catch (e) {
      console.error('[tarea-detail] task-context error:', e)
    } finally {
      setChatLoading(false)
      setContextLoading(false)
    }
  }

  // ── handleChatSubmit ─────────────────────────────────────────────────────────

  async function handleChatSubmit(message: string) {
    if (!message.trim() || chatLoading) return
    await callTaskContext(message.trim())
  }

  // ── Log helper ────────────────────────────────────────────────────────────────

  async function logEvent(eventType: string, description: string) {
    if (!userId || !crisisId) return
    await supabase.from('task_history').insert({
      task_id:     taskId,
      crisis_id:   crisisId,
      user_id:     userId,
      event_type:  eventType,
      description,
    })
    await reloadHistory()
  }

  // ── Save handlers ─────────────────────────────────────────────────────────────

  async function saveTitle() {
    if (!titleVal.trim() || titleVal === task?.title) {
      setEditingTitle(false)
      setTitleVal(task?.title ?? '')
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('tasks').update({ title: titleVal.trim() }).eq('id', taskId)
    setSaving(false)
    if (error) { setError(error.message); return }
    setTask(prev => prev ? { ...prev, title: titleVal.trim() } : null)
    await logEvent('contexto_actualizado', `Título actualizado a "${titleVal.trim()}"`)
    callTaskContext()
    setEditingTitle(false)
  }

  async function saveDesc() {
    setSaving(true)
    const { error } = await supabase
      .from('tasks').update({ description: descVal.trim() || null }).eq('id', taskId)
    setSaving(false)
    if (error) { setError(error.message); return }
    setTask(prev => prev ? { ...prev, description: descVal.trim() || null } : null)
    if (descVal.trim()) {
      await logEvent('contexto_actualizado', 'Descripción actualizada')
    }
    callTaskContext()
    setEditingDesc(false)
  }

  async function saveDate() {
    setSaving(true)
    const { error } = await supabase
      .from('tasks').update({ due_date: dateVal || null }).eq('id', taskId)
    setSaving(false)
    if (error) { setError(error.message); return }
    setTask(prev => prev ? { ...prev, due_date: dateVal || null } : null)
    await logEvent('contexto_actualizado', `Fecha actualizada a ${dateVal || 'sin fecha'}`)
    callTaskContext()
    setEditingDate(false)
  }

  async function handleAssigneeChange(val: string) {
    setAssigneeVal(val)
    const fields = val === 'yo'
      ? { assigned_to_user: true,  assigned_contact_id: null }
      : val.startsWith('c:')
        ? { assigned_to_user: false, assigned_contact_id: val.slice(2) }
        : { assigned_to_user: false, assigned_contact_id: null }

    const { error } = await supabase
      .from('tasks').update(fields).eq('id', taskId)
    if (error) { setError(error.message); return }

    let assigneeName = 'nadie'
    if (val === 'yo') assigneeName = 'Yo'
    else if (val.startsWith('c:')) {
      const c = contacts.find(c => `c:${c.id}` === val)
      assigneeName = c?.name ?? 'un contacto'
    }
    await logEvent('asignacion_cambiada', `Asignada a ${assigneeName}`)
    callTaskContext()
  }

  async function handleTopicChange(topicId: string) {
    setTopicVal(topicId)
    const { error } = await supabase
      .from('tasks').update({ topic_id: topicId || null }).eq('id', taskId)
    if (error) { setError(error.message); return }
    const topic = topics.find(t => t.id === topicId)
    await logEvent('tema_cambiado', topic ? `Tema: ${topic.name}` : 'Tema removido')
    callTaskContext()
  }

  async function handleToggleStatus() {
    if (!task) return
    const newStatus = task.status === 'completada' ? 'pendiente' : 'completada'
    setSaving(true)
    const { error } = await supabase
      .from('tasks').update({ status: newStatus }).eq('id', taskId)
    setSaving(false)
    if (error) { setError(error.message); return }
    setTask(prev => prev ? { ...prev, status: newStatus } : null)
    await logEvent(
      'estado_cambiado',
      newStatus === 'completada' ? 'Tarea marcada como completada' : 'Tarea reabierta'
    )
  }

  async function handleDelete() {
    setDeleteLoading(true)
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    setDeleteLoading(false)
    if (error) { setError(error.message); return }
    router.replace('/gestion')
  }

  // ── Topic handlers ────────────────────────────────────────────────────────────

  async function handleSaveTopic() {
    if (!editTopicName.trim() || !crisisId || !userId) return
    setEditTopicLoading(true)

    if (topicDropdown.view === 'create') {
      const { data: newTopic, error } = await supabase
        .from('topics')
        .insert({ crisis_id: crisisId, user_id: userId, name: editTopicName.trim(), color: editTopicColor })
        .select('id, name, color').single()
      setEditTopicLoading(false)
      if (error) { setError(error.message); return }
      setTopics(prev => [...prev, newTopic as Topic])
      await handleTopicChange(newTopic.id)
    } else if (topicDropdown.view === 'edit' && topicDropdown.editTopic) {
      const { error } = await supabase
        .from('topics')
        .update({ name: editTopicName.trim(), color: editTopicColor })
        .eq('id', topicDropdown.editTopic.id)
      setEditTopicLoading(false)
      if (error) { setError(error.message); return }
      setTopics(prev => prev.map(t =>
        t.id === topicDropdown.editTopic!.id
          ? { ...t, name: editTopicName.trim(), color: editTopicColor } : t
      ))
    }
    setTopicDropdown(prev => ({ ...prev, view: 'list', editTopic: null }))
    setEditTopicName('')
    setEditTopicColor('#0A7E8C')
  }

  async function handleDeleteTopic() {
    if (!topicDropdown.editTopic) return
    setEditTopicLoading(true)
    const { error } = await supabase.from('topics').delete().eq('id', topicDropdown.editTopic.id)
    setEditTopicLoading(false)
    if (error) { setError(error.message); return }
    const deletedId = topicDropdown.editTopic.id
    setTopics(prev => prev.filter(t => t.id !== deletedId))
    if (topicVal === deletedId) {
      setTopicVal('')
      await supabase.from('tasks').update({ topic_id: null }).eq('id', taskId)
    }
    setTopicDropdown(prev => ({ ...prev, view: 'list', editTopic: null }))
  }

  // ── Computed ──────────────────────────────────────────────────────────────────

  const isDone        = task?.status === 'completada'
  const selectedTopic = topics.find(t => t.id === topicVal)

  function getAssigneeDisplay() {
    if (!assigneeVal) return null
    if (assigneeVal === 'yo') return {
      label: 'Yo', initials: 'Yo',
      bg: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
    }
    if (assigneeVal.startsWith('c:')) {
      const c = contacts.find(c => `c:${c.id}` === assigneeVal)
      if (c) return {
        label: c.name,
        initials: (c.initials ?? initialsFrom(c.name)).slice(0, 2),
        bg: 'linear-gradient(135deg, #f4ab66, #E8913A)',
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
        .tarea-detail-bg { animation: heroBgDrift 30s ease-in-out infinite; }
      `}</style>

      {/* Dropdowns */}
      {assigneeDropdown.open && (
        <AssigneeDropdownPortal
          contacts={contacts}
          selectedValue={assigneeVal}
          anchorRect={assigneeDropdown.anchorRect}
          onSelect={handleAssigneeChange}
          onClose={() => setAssigneeDropdown({ open: false, anchorRect: null })}
        />
      )}
      {topicDropdown.open && (
        <TopicDropdownPortal
          topics={topics}
          selectedId={topicVal}
          anchorRect={topicDropdown.anchorRect}
          view={topicDropdown.view}
          editTopic={topicDropdown.editTopic}
          editTopicName={editTopicName}
          setEditTopicName={setEditTopicName}
          editTopicColor={editTopicColor}
          setEditTopicColor={setEditTopicColor}
          editTopicLoading={editTopicLoading}
          onToggleTopic={(id) => handleTopicChange(topicVal === id ? '' : id)}
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
          onClose={() => {
            setTopicDropdown(prev => ({ ...prev, open: false }))
            setEditTopicName('')
            setEditTopicColor('#0A7E8C')
          }}
        />
      )}

      <div className="tarea-detail-bg flex min-h-screen">
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
              {task?.title ?? '…'}
            </span>
          </nav>

          {loading && (
            <div style={{ maxWidth: 560, margin: '0 auto' }}>
              <div style={{
                background: '#FFFFFF', borderRadius: '1.5rem',
                boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                padding: 32, textAlign: 'center',
              }}>
                <p style={{ color: '#5a7478', fontSize: '0.875rem' }}>Cargando…</p>
              </div>
            </div>
          )}

          {!loading && task && (
            <div style={{ maxWidth: 560, margin: '0 auto' }}>

              {/* Hero */}
              <div style={{ textAlign: 'center', padding: '16px 0 28px' }}>
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: isDone
                    ? 'rgba(46,205,167,0.15)'
                    : 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 14px',
                  boxShadow: isDone ? 'none' : '0 8px 40px rgba(10,126,140,0.16)',
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                    stroke={isDone ? '#2ECDA7' : 'white'}
                    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 11 12 14 22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                </div>

                {/* Título editable */}
                {editingTitle ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                    <input
                      type="text"
                      value={titleVal}
                      onChange={(e) => setTitleVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveTitle()
                        if (e.key === 'Escape') { setEditingTitle(false); setTitleVal(task.title) }
                      }}
                      autoFocus
                      style={{
                        fontSize: '1.25rem', fontWeight: 800,
                        letterSpacing: '-0.02em', color: '#1A1A2E',
                        border: 'none', borderBottom: '2px solid #0A7E8C',
                        background: 'transparent', outline: 'none',
                        fontFamily: 'inherit', textAlign: 'center',
                        width: '100%', maxWidth: 400,
                      }}
                    />
                    <button onClick={saveTitle} disabled={saving}
                      style={{
                        background: '#0A7E8C', color: 'white', border: 'none',
                        borderRadius: '0.5rem', padding: '4px 12px',
                        fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                        fontFamily: 'inherit', flexShrink: 0,
                      }}>
                      {saving ? '…' : 'OK'}
                    </button>
                  </div>
                ) : (
                  <h1
                    onClick={() => setEditingTitle(true)}
                    style={{
                      fontSize: '1.5rem', fontWeight: 800,
                      letterSpacing: '-0.02em',
                      cursor: 'pointer', marginBottom: 10,
                      textDecoration: isDone ? 'line-through' : 'none',
                      color: isDone ? '#5a7478' : '#1A1A2E',
                    }}
                  >
                    {task.title}
                  </h1>
                )}

                {/* Badge status */}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', borderRadius: 9999,
                  padding: '3px 11px', fontSize: '0.7rem', fontWeight: 700,
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                  background: isDone
                    ? 'rgba(46,205,167,0.14)' : 'rgba(232,145,58,0.12)',
                  color: isDone ? '#0a6e5a' : '#b86a10',
                }}>
                  {isDone ? 'Completada' : 'Pendiente'}
                </span>

                {/* Card Lo que sé — con minichat */}
                <div style={{
                  background: '#FFFFFF',
                  borderRadius: '1.5rem',
                  boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                  marginTop: 20, overflow: 'hidden',
                }}>
                  {/* Header */}
                  <div style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid rgba(10,126,140,0.08)',
                  }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700,
                      letterSpacing: '0.12em', textTransform: 'uppercase',
                      color: '#5a7478',
                    }}>
                      Lo que sé
                    </span>
                  </div>

                  <div style={{ padding: '16px 20px' }}>

                    {/* Contexto actual */}
                    {taskContext && (
                      <p style={{
                        fontSize: '0.875rem', color: '#5a7478',
                        fontStyle: 'italic', lineHeight: 1.65,
                        margin: '0 0 16px', textAlign: 'left',
                      }}>
                        {taskContext}
                      </p>
                    )}

                    {/* Minichat */}
                    {chatDone ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <p style={{
                          fontSize: '0.8125rem', color: '#5a7478',
                          fontStyle: 'italic', margin: 0, flex: 1, textAlign: 'left',
                        }}>
                          Por ahora ya tengo bastante contexto sobre esta tarea.
                          Volvé cuando haya novedades.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setChatDone(false)
                            setChatMessages([])
                            setChatQuestion('Hay alguna novedad con esta tarea')
                            setChatSuggestions([
                              'Todo sigue igual',
                              'Cambió la fecha',
                              'Ya la hice',
                            ])
                          }}
                          style={{
                            padding: '6px 14px', borderRadius: 9999,
                            border: '1.5px solid rgba(10,126,140,0.25)',
                            background: 'white', color: '#0A7E8C',
                            fontSize: '0.8125rem', fontWeight: 600,
                            cursor: 'pointer', flexShrink: 0,
                            fontFamily: 'inherit', transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(10,126,140,0.06)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'white' }}
                        >
                          Reintentar
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Pregunta actual */}
                        {chatQuestion && (
                          <p style={{
                            fontSize: '0.875rem', fontWeight: 600,
                            color: '#1A1A2E', marginBottom: 12, marginTop: 0,
                            textAlign: 'left',
                          }}>
                            {chatQuestion}?
                          </p>
                        )}

                        {/* Chips de sugerencias */}
                        {chatSuggestions.length > 0 && (
                          <div style={{
                            display: 'flex', flexWrap: 'wrap', gap: 8,
                            marginBottom: 12,
                          }}>
                            {chatSuggestions.map((s, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => handleChatSubmit(s)}
                                disabled={chatLoading}
                                style={{
                                  padding: '6px 14px', borderRadius: 9999,
                                  border: '1.5px solid rgba(10,126,140,0.25)',
                                  background: 'white', color: '#0A7E8C',
                                  fontSize: '0.8125rem', fontWeight: 600,
                                  cursor: chatLoading ? 'not-allowed' : 'pointer',
                                  opacity: chatLoading ? 0.5 : 1,
                                  transition: 'background 0.15s',
                                  fontFamily: 'inherit',
                                }}
                                onMouseEnter={(e) => {
                                  if (!chatLoading)
                                    e.currentTarget.style.background = 'rgba(10,126,140,0.06)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'white'
                                }}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Input libre */}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                          <textarea
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handleChatSubmit(chatInput)
                              }
                            }}
                            disabled={chatLoading}
                            placeholder="O escribí tu respuesta…"
                            rows={1}
                            style={{
                              flex: 1,
                              border: '1.5px solid rgba(10,126,140,0.12)',
                              borderRadius: '1rem',
                              padding: '10px 14px',
                              fontSize: '0.875rem',
                              lineHeight: 1.5,
                              resize: 'none',
                              outline: 'none',
                              fontFamily: 'inherit',
                              color: '#1A1A2E',
                              background: '#FAF8F5',
                              minHeight: 42,
                              maxHeight: 100,
                              transition: 'border-color 0.2s',
                            }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = '#0A7E8C' }}
                            onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(10,126,140,0.12)' }}
                          />
                          <button
                            type="button"
                            onClick={() => handleChatSubmit(chatInput)}
                            disabled={chatLoading || !chatInput.trim()}
                            style={{
                              width: 42, height: 42, borderRadius: '50%',
                              border: 'none',
                              cursor: chatLoading || !chatInput.trim()
                                ? 'not-allowed' : 'pointer',
                              background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                              color: 'white',
                              display: 'flex', alignItems: 'center',
                              justifyContent: 'center', flexShrink: 0,
                              opacity: chatLoading || !chatInput.trim() ? 0.4 : 1,
                              transition: 'opacity 0.15s',
                            }}
                          >
                            {chatLoading ? (
                              <span style={{ fontSize: 10 }}>…</span>
                            ) : (
                              <svg width="16" height="16" viewBox="0 0 24 24"
                                fill="none" stroke="currentColor"
                                strokeWidth="2" strokeLinecap="round"
                                strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13" />
                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
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

              {/* Card de datos */}
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
                  {editingDesc ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <textarea
                        value={descVal}
                        onChange={(e) => setDescVal(e.target.value)}
                        autoFocus rows={3}
                        style={{
                          border: '1.5px solid #0A7E8C', borderRadius: '0.5rem',
                          padding: '8px 10px', fontSize: '0.875rem',
                          outline: 'none', color: '#1A1A2E', fontFamily: 'inherit',
                          resize: 'none', lineHeight: 1.6, background: '#FAF8F5',
                        }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={saveDesc} disabled={saving}
                          style={{
                            background: '#0A7E8C', color: 'white', border: 'none',
                            borderRadius: '0.5rem', padding: '4px 12px',
                            fontSize: '0.75rem', fontWeight: 700,
                            cursor: 'pointer', fontFamily: 'inherit',
                          }}>
                          {saving ? '…' : 'Guardar'}
                        </button>
                        <button
                          onClick={() => { setEditingDesc(false); setDescVal(task.description ?? '') }}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: '#5a7478', fontSize: '0.75rem', fontFamily: 'inherit',
                          }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => setEditingDesc(true)}
                      style={{ flex: 1, cursor: 'pointer' }}
                    >
                      {task.description ? (
                        <p style={{
                          fontSize: '0.875rem', color: '#1A1A2E',
                          lineHeight: 1.6, margin: 0,
                        }}>{task.description}</p>
                      ) : (
                        <p style={{
                          fontSize: '0.875rem', color: '#5a7478',
                          fontStyle: 'italic', margin: 0,
                        }}>Agregar descripción…</p>
                      )}
                    </div>
                  )}
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
                  {editingDate ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
                      <input
                        type="date" value={dateVal}
                        onChange={(e) => setDateVal(e.target.value)}
                        autoFocus
                        style={{
                          flex: 1, border: 'none',
                          borderBottom: '1.5px solid #0A7E8C',
                          background: 'transparent', fontSize: '0.875rem',
                          outline: 'none', color: '#1A1A2E',
                          fontFamily: 'inherit', colorScheme: 'light',
                        }}
                      />
                      <button onClick={saveDate} disabled={saving}
                        style={{
                          background: '#0A7E8C', color: 'white', border: 'none',
                          borderRadius: '0.5rem', padding: '4px 12px',
                          fontSize: '0.75rem', fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}>
                        {saving ? '…' : 'OK'}
                      </button>
                      <button
                        onClick={() => { setEditingDate(false); setDateVal(task.due_date ?? '') }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: '#5a7478', fontSize: '0.75rem', fontFamily: 'inherit',
                        }}>
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <>
                      <span style={{
                        fontSize: '0.875rem', fontWeight: 600,
                        color: '#1A1A2E', flex: 1,
                      }}>
                        {task.due_date ? fmtDate(task.due_date) : '—'}
                      </span>
                      <button
                        onClick={() => setEditingDate(true)}
                        style={{
                          padding: 0, background: 'none', border: 'none',
                          color: '#0A7E8C', fontSize: '0.8125rem', fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'inherit',
                          textDecoration: 'underline', textUnderlineOffset: 3,
                        }}>
                        {task.due_date ? 'Cambiar' : 'Agregar'}
                      </button>
                    </>
                  )}
                </div>

                {/* Asignado */}
                <div style={{
                  display: 'flex', alignItems: 'center',
                  padding: '16px 20px',
                  borderBottom: '1px solid rgba(10,126,140,0.08)', gap: 12,
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
                      {assigneeVal ? 'Cambiar' : 'Asignar'}
                    </button>
                  </div>
                </div>

                {/* Sugerencia de asignado */}
                {suggestedAssignee && !assigneeVal && (
                  <div style={{
                    padding: '10px 20px 14px',
                    borderBottom: '1px solid rgba(10,126,140,0.08)',
                    background: 'rgba(10,126,140,0.03)',
                  }}>
                    <p style={{
                      fontSize: '0.7rem', fontWeight: 700,
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                      color: '#0A7E8C', marginBottom: 6,
                    }}>
                      Sugerencia de Mhiru
                    </p>
                    <p style={{
                      fontSize: '0.8125rem', color: '#5a7478',
                      lineHeight: 1.55, marginBottom: 10,
                    }}>
                      {suggestedAssignee.reason}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        // Buscar el contacto por nombre y asignarlo
                        const match = contacts.find(c =>
                          c.name.toLowerCase() === suggestedAssignee.name.toLowerCase()
                        )
                        if (match) {
                          handleAssigneeChange(`c:${match.id}`)
                        } else if (suggestedAssignee.name.toLowerCase() === 'yo') {
                          handleAssigneeChange('yo')
                        }
                        setSuggestedAssignee(null)
                      }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '5px 12px', borderRadius: 9999,
                        background: 'rgba(10,126,140,0.10)',
                        border: 'none', cursor: 'pointer',
                        color: '#0A7E8C', fontSize: '0.8125rem',
                        fontWeight: 700, fontFamily: 'inherit',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(10,126,140,0.18)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(10,126,140,0.10)' }}
                    >
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #f4ab66, #E8913A)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.55rem', fontWeight: 700, color: 'white',
                        flexShrink: 0,
                      }}>
                        {suggestedAssignee.name.slice(0, 2).toUpperCase()}
                      </div>
                      Asignar a {suggestedAssignee.name}
                    </button>
                  </div>
                )}

                {/* Tema */}
                <div style={{
                  display: 'flex', alignItems: 'center',
                  padding: '16px 20px', gap: 12,
                }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                    textTransform: 'uppercase', color: '#5a7478',
                    minWidth: 80, flexShrink: 0,
                  }}>Tema</span>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {selectedTopic && (
                      <span style={{
                        padding: '3px 10px', borderRadius: 9999,
                        background: `${selectedTopic.color ?? '#0A7E8C'}22`,
                        color: selectedTopic.color ?? '#0A7E8C',
                        fontSize: '0.75rem', fontWeight: 700,
                      }}>{selectedTopic.name}</span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        setTopicDropdown(prev => ({
                          ...prev, open: true,
                          anchorRect: rect,
                        }))
                      }}
                      style={{
                        padding: 0, background: 'none', border: 'none',
                        color: '#0A7E8C', fontSize: '0.8125rem', fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit',
                        textDecoration: 'underline', textUnderlineOffset: 3,
                      }}>
                      {topicVal ? 'Cambiar' : 'Agregar'}
                    </button>
                  </div>
                </div>

                {/* Temas sugeridos */}
                {suggestedTopics.length > 0 && !topicVal && (
                  <div style={{
                    padding: '10px 20px 14px',
                    background: 'rgba(10,126,140,0.03)',
                  }}>
                    <p style={{
                      fontSize: '0.7rem', fontWeight: 700,
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                      color: '#0A7E8C', marginBottom: 8,
                    }}>
                      Temas sugeridos
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {suggestedTopics.map((name) => {
                        const topic = topics.find(t =>
                          t.name.toLowerCase() === name.toLowerCase()
                        )
                        if (!topic) return null
                        return (
                          <button
                            key={topic.id}
                            type="button"
                            onClick={() => {
                              handleTopicChange(topic.id)
                              setSuggestedTopics([])
                            }}
                            style={{
                              padding: '5px 12px', borderRadius: 9999,
                              background: `${topic.color ?? '#0A7E8C'}22`,
                              border: `1.5px solid ${topic.color ?? '#0A7E8C'}44`,
                              color: topic.color ?? '#0A7E8C',
                              fontSize: '0.8125rem', fontWeight: 700,
                              cursor: 'pointer', fontFamily: 'inherit',
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = `${topic.color ?? '#0A7E8C'}33`
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = `${topic.color ?? '#0A7E8C'}22`
                            }}
                          >
                            + {topic.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Botón toggle status */}
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={saving}
                style={{
                  width: '100%', padding: '14px', borderRadius: 9999,
                  border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: '0.875rem',
                  background: isDone
                    ? 'rgba(10,126,140,0.12)'
                    : 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                  color: isDone ? '#0A7E8C' : 'white',
                  opacity: saving ? 0.6 : 1,
                  transition: 'filter 0.15s', fontFamily: 'inherit',
                  marginBottom: 24,
                }}
                onMouseEnter={(e) => { if (!saving) e.currentTarget.style.filter = 'brightness(1.06)' }}
                onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)' }}
              >
                {saving ? 'Procesando…' : isDone ? 'Reabrir tarea' : 'Marcar como completada'}
              </button>

              {/* Documentos asociados */}
              <div style={{ marginBottom: 24 }}>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
                }}>Documentos</p>
                <div style={{
                  background: '#FFFFFF', borderRadius: '1.5rem',
                  boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                  overflow: 'hidden',
                }}>
                  {/* Lista de docs asociados */}
                  {taskDocs.length === 0 ? (
                    <div style={{ padding: '20px 20px 4px' }}>
                      <p style={{
                        fontSize: '0.875rem', color: '#5a7478',
                        fontStyle: 'italic', margin: '0 0 16px',
                      }}>
                        No hay documentos asociados todavía.
                      </p>
                    </div>
                  ) : (
                    <div style={{ padding: '12px 20px 4px' }}>
                      {taskDocs.map((td) => {
                        const d = td.doc
                        const isUnlinking = docUnlinkLoading === td.id
                        return (
                          <div key={td.id} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 0',
                            borderBottom: '1px solid rgba(10,126,140,0.08)',
                          }}>
                            {/* Ícono doc */}
                            <div style={{
                              width: 32, height: 32, borderRadius: '0.5rem',
                              background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                              display: 'flex', alignItems: 'center',
                              justifyContent: 'center', flexShrink: 0,
                            }}>
                              <svg width="14" height="14" viewBox="0 0 24 24"
                                fill="none" stroke="white" strokeWidth="1.8"
                                strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                              </svg>
                            </div>
                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{
                                fontSize: '0.875rem', fontWeight: 600,
                                color: '#1A1A2E', margin: 0,
                                whiteSpace: 'nowrap', overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}>{d.name}</p>
                              <p style={{
                                fontSize: '0.7rem', color: '#5a7478', margin: 0,
                              }}>
                                {[DOC_TYPE_LABELS[d.type ?? ''], fmtShortDate(d.created_at)].filter(Boolean).join(' · ')}
                              </p>
                            </div>
                            {/* Quitar */}
                            <button
                              type="button"
                              onClick={() => handleUnlinkDoc(td.id)}
                              disabled={isUnlinking}
                              style={{
                                background: 'none', border: 'none',
                                cursor: isUnlinking ? 'not-allowed' : 'pointer',
                                color: '#5a7478', padding: 4, flexShrink: 0,
                                opacity: isUnlinking ? 0.4 : 1,
                                transition: 'color 0.15s',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = '#ba1a1a' }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = '#5a7478' }}
                              title="Quitar documento"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24"
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

                  {/* Picker de documentos existentes */}
                  {docPickerOpen && (
                    <div style={{ padding: '12px 20px 16px' }}>
                      <p style={{
                        fontSize: '0.7rem', fontWeight: 700,
                        letterSpacing: '0.06em', textTransform: 'uppercase',
                        color: '#5a7478', marginBottom: 10,
                      }}>Seleccioná un documento</p>
                      {(() => {
                        const linkedIds = new Set(taskDocs.map(td => td.document_id))
                        const available = allDocs.filter(d => !linkedIds.has(d.id))
                        if (available.length === 0) {
                          return (
                            <p style={{
                              fontSize: '0.8125rem', color: '#5a7478',
                              fontStyle: 'italic',
                            }}>
                              No hay documentos disponibles para asociar.
                            </p>
                          )
                        }
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {available.map((d) => (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => handleLinkDoc(d.id)}
                                disabled={docLinkLoading}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 10,
                                  padding: '8px 10px', borderRadius: '0.625rem',
                                  background: 'rgba(10,126,140,0.04)',
                                  border: '1px solid rgba(10,126,140,0.10)',
                                  cursor: docLinkLoading ? 'not-allowed' : 'pointer',
                                  textAlign: 'left', fontFamily: 'inherit',
                                  opacity: docLinkLoading ? 0.6 : 1,
                                  transition: 'background 0.15s',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(10,126,140,0.09)' }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(10,126,140,0.04)' }}
                              >
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
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{
                                    fontSize: '0.8125rem', fontWeight: 600,
                                    color: '#1A1A2E', margin: 0,
                                    whiteSpace: 'nowrap', overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}>{d.name}</p>
                                  <p style={{ fontSize: '0.7rem', color: '#5a7478', margin: 0 }}>
                                    {[DOC_TYPE_LABELS[d.type ?? ''], fmtShortDate(d.created_at)].filter(Boolean).join(' · ')}
                                  </p>
                                </div>
                                <svg width="14" height="14" viewBox="0 0 24 24"
                                  fill="none" stroke="#0A7E8C" strokeWidth="2.5"
                                  strokeLinecap="round" strokeLinejoin="round"
                                  style={{ flexShrink: 0 }}>
                                  <line x1="12" y1="5" x2="12" y2="19" />
                                  <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                              </button>
                            ))}
                          </div>
                        )
                      })()}
                      <button
                        type="button"
                        onClick={() => setDocPickerOpen(false)}
                        style={{
                          marginTop: 10, background: 'none', border: 'none',
                          cursor: 'pointer', color: '#5a7478',
                          fontSize: '0.75rem', fontFamily: 'inherit',
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  )}

                  {/* Formulario de upload */}
                  {docUploadOpen && (
                    <div style={{ padding: '12px 20px 16px', borderTop: '1px solid rgba(10,126,140,0.08)' }}>
                      <p style={{
                        fontSize: '0.7rem', fontWeight: 700,
                        letterSpacing: '0.06em', textTransform: 'uppercase',
                        color: '#5a7478', marginBottom: 10,
                      }}>Subir documento nuevo</p>

                      {/* Drop zone */}
                      <div
                        onDragEnter={(e) => { e.preventDefault(); dragCounterRef.current++; setIsDragging(true) }}
                        onDragLeave={() => { dragCounterRef.current--; if (dragCounterRef.current === 0) setIsDragging(false) }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault()
                          dragCounterRef.current = 0
                          setIsDragging(false)
                          const file = e.dataTransfer.files[0]
                          if (file) handleFileSelect(file)
                        }}
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          border: `2px dashed ${isDragging ? 'rgba(61,199,166,0.75)' : 'rgba(61,199,166,0.35)'}`,
                          borderRadius: '0.625rem', padding: '20px',
                          textAlign: 'center', cursor: 'pointer',
                          background: isDragging ? 'rgba(61,199,166,0.07)' : 'rgba(10,126,140,0.02)',
                          transition: 'all 0.2s', marginBottom: 12,
                        }}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          style={{ display: 'none' }}
                          accept=".pdf,image/*,.doc,.docx"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleFileSelect(file)
                          }}
                        />
                        {uploadFile ? (
                          <p style={{ fontSize: '0.8125rem', color: '#0A7E8C', fontWeight: 600, margin: 0 }}>
                            {uploadFile.name}
                          </p>
                        ) : (
                          <p style={{ fontSize: '0.8125rem', color: '#5a7478', margin: 0 }}>
                            Hacé clic o arrastrá el archivo
                          </p>
                        )}
                      </div>

                      {/* Nombre */}
                      <input
                        type="text"
                        placeholder="Nombre del documento…"
                        value={uploadName}
                        onChange={(e) => setUploadName(e.target.value)}
                        style={{
                          width: '100%', padding: '8px 12px',
                          border: '1.5px solid rgba(10,126,140,0.20)',
                          borderRadius: '0.5rem', fontSize: '0.875rem',
                          fontWeight: 600, outline: 'none', color: '#1A1A2E',
                          fontFamily: 'inherit', marginBottom: 10,
                          boxSizing: 'border-box', background: '#FAF8F5',
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = '#0A7E8C' }}
                        onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(10,126,140,0.20)' }}
                      />

                      {/* Tipo */}
                      <select
                        value={uploadType}
                        onChange={(e) => setUploadType(e.target.value)}
                        style={{
                          width: '100%', padding: '8px 12px',
                          border: '1.5px solid rgba(10,126,140,0.20)',
                          borderRadius: '0.5rem', fontSize: '0.875rem',
                          outline: 'none', color: '#1A1A2E',
                          fontFamily: 'inherit', marginBottom: 12,
                          boxSizing: 'border-box', background: '#FAF8F5',
                          appearance: 'none', cursor: 'pointer',
                        }}
                      >
                        {DOC_TYPE_OPTIONS.map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>

                      {/* Botones */}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          onClick={handleUploadNewDoc}
                          disabled={uploadLoading || !uploadFile || !uploadName.trim()}
                          style={{
                            flex: 1, padding: '8px 0',
                            background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                            color: 'white', border: 'none',
                            borderRadius: '0.5rem', fontSize: '0.8125rem',
                            fontWeight: 700, cursor: 'pointer',
                            fontFamily: 'inherit',
                            opacity: (uploadLoading || !uploadFile || !uploadName.trim()) ? 0.5 : 1,
                          }}
                        >
                          {uploadLoading ? 'Subiendo…' : 'Subir y asociar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDocUploadOpen(false)
                            setUploadName('')
                            setUploadType('estudio_medico')
                            setUploadFile(null)
                          }}
                          style={{
                            background: 'none', border: 'none',
                            cursor: 'pointer', color: '#5a7478',
                            fontSize: '0.8125rem', fontFamily: 'inherit',
                            padding: '8px 12px',
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Botones agregar — solo si ningún panel está abierto */}
                  {!docPickerOpen && !docUploadOpen && (
                    <div style={{
                      borderTop: taskDocs.length > 0
                        ? '1px solid rgba(10,126,140,0.08)' : 'none',
                      padding: '10px 20px 16px',
                      display: 'flex', gap: 16, flexWrap: 'wrap',
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
                        + Asociar existente
                      </button>
                      <button
                        type="button"
                        onClick={() => setDocUploadOpen(true)}
                        style={{
                          background: 'none', border: 'none',
                          cursor: 'pointer', color: '#0A7E8C',
                          fontSize: '0.8125rem', fontWeight: 600,
                          fontFamily: 'inherit', padding: 0,
                          textDecoration: 'underline',
                          textUnderlineOffset: 3,
                        }}
                      >
                        + Subir nuevo
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Actividad */}
              <div style={{ marginBottom: 24 }}>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
                }}>Actividad</p>
                <div style={{
                  background: '#FFFFFF', borderRadius: '1.5rem',
                  boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                  overflow: 'hidden',
                }}>
                  {history.length === 0 ? (
                    <p style={{
                      fontSize: '0.875rem', color: '#5a7478',
                      textAlign: 'center', padding: '24px',
                      fontStyle: 'italic',
                    }}>
                      Sin actividad registrada todavía.
                    </p>
                  ) : (
                    history.map((h, i) => (
                      <div key={h.id} style={{
                        display: 'flex', gap: 12, padding: '14px 20px',
                        borderBottom: i < history.length - 1
                          ? '1px solid rgba(10,126,140,0.08)' : 'none',
                      }}>
                        {/* Dot */}
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: '#2ECDA7', flexShrink: 0,
                          marginTop: 6,
                        }} />
                        <div style={{ flex: 1 }}>
                          <p style={{
                            fontSize: '0.875rem', fontWeight: 600,
                            color: '#1A1A2E', margin: '0 0 2px',
                          }}>
                            {EVENT_LABELS[h.event_type] ?? h.event_type}
                          </p>
                          {h.description && (
                            <p style={{
                              fontSize: '0.8125rem', color: '#5a7478',
                              margin: '0 0 4px', lineHeight: 1.5,
                            }}>
                              {h.description}
                            </p>
                          )}
                          <p style={{ fontSize: '0.7rem', color: '#5a7478', margin: 0 }}>
                            {fmtDateTime(h.occurred_at)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Acciones */}
              <div style={{ marginBottom: 24 }}>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
                }}>Acciones</p>
                <div style={{
                  background: '#FFFFFF', borderRadius: '1rem',
                  boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                  padding: '13px 20px',
                }}>
                  {deleteConfirm ? (
                    <div>
                      <p style={{
                        fontSize: '0.875rem', color: '#1A1A2E',
                        fontWeight: 600, marginBottom: 12,
                      }}>
                        ¿Eliminar esta tarea?<br />
                        <span style={{ fontWeight: 400, fontSize: '0.8125rem', color: '#5a7478' }}>
                          Esta acción no se puede deshacer.
                        </span>
                      </p>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button
                          onClick={() => setDeleteConfirm(false)}
                          disabled={deleteLoading}
                          style={{
                            flex: 1, padding: '9px 0',
                            background: 'rgba(10,126,140,0.07)',
                            color: '#0A7E8C', border: 'none',
                            borderRadius: '0.6rem', fontWeight: 700,
                            fontSize: '0.875rem', cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}>
                          Cancelar
                        </button>
                        <button
                          onClick={handleDelete}
                          disabled={deleteLoading}
                          style={{
                            flex: 1, padding: '9px 0',
                            background: 'rgba(186,26,26,0.10)',
                            color: '#ba1a1a', border: 'none',
                            borderRadius: '0.6rem', fontWeight: 700,
                            fontSize: '0.875rem', cursor: 'pointer',
                            fontFamily: 'inherit',
                            opacity: deleteLoading ? 0.6 : 1,
                          }}>
                          {deleteLoading ? 'Eliminando…' : 'Eliminar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', gap: 12,
                    }}>
                      <span style={{ fontSize: '0.875rem', color: '#5a7478', flex: 1 }}>
                        Eliminar esta tarea
                      </span>
                      <button
                        onClick={() => setDeleteConfirm(true)}
                        style={{
                          background: 'rgba(186,26,26,0.06)', color: '#ba1a1a',
                          border: 'none', borderRadius: '0.6rem',
                          padding: '7px 16px', fontSize: '0.875rem',
                          fontWeight: 700, cursor: 'pointer',
                          transition: 'background 0.15s', fontFamily: 'inherit',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(186,26,26,0.14)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(186,26,26,0.06)' }}
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </main>
      </div>
    </>
  )
}
