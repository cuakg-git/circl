'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
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
  id:         string
  name:       string
  status:     string
  category:   string | null
  started_at: string | null
  ai_summary: string | null
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

type Topic = {
  id:        string
  name:      string
  color:     string | null
  crisis_id: string
}

type Contact = {
  id:           string
  name:         string
  role:         string | null
  proximity:    string | null
  initials:     string | null
  phone:        string | null
  email:        string | null
  relationship: string | null
}

type Doc = {
  id:                     string
  name:                   string
  type:                   string | null
  created_at:             string
  storage_path:           string
  original_filename:      string | null
  file_size_bytes:        number | null
  file_mime_type:         string | null
  uploaded_by_user:       boolean | null
  uploaded_by_contact_id: string | null
}

type HistoryEvent = {
  id:          string
  title:       string
  description: string | null
  occurred_at: string
}

// Sidesheet modes
type SSMode = 'task-view' | 'task-add' | 'member-view' | 'member-add' | 'doc-view' | 'doc-add' | null

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtLongDate(iso: string | null) {
  if (!iso) return '—'
  const s = new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function fmtShortDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso)
    .toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
    .replace('.', '')
}

function getInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

/** Try to parse a free-text date string into an ISO date string (YYYY-MM-DD).
 *  Returns null if unparseable. */
function parseDate(raw: string): string | null {
  if (!raw.trim()) return null
  const d = new Date(raw.trim())
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10)
  }
  return null
}

/** Decode assignee select value into task fields. */
function decodeAssignee(val: string) {
  if (val === 'yo')           return { assigned_to_user: true,  assigned_contact_id: null }
  if (val.startsWith('c:'))   return { assigned_to_user: false, assigned_contact_id: val.slice(2) }
  return                             { assigned_to_user: false, assigned_contact_id: null }
}

/** Encode task back to assignee select value. */
function encodeAssignee(t: Task) {
  if (t.assigned_to_user)          return 'yo'
  if (t.assigned_contact_id)       return `c:${t.assigned_contact_id}`
  return ''
}

// ── Time options (every 15 min) ────────────────────────────────────────────────

const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4).toString().padStart(2, '0')
  const m = ((i % 4) * 15).toString().padStart(2, '0')
  return `${h}:${m}`
})

// ── Role mapping ───────────────────────────────────────────────────────────────

const ROLE_BADGES: Record<string, { label: string; bg: string; color: string }> = {
  acompanamiento:      { label: 'Acompañ.',  bg: 'rgba(46,205,167,0.10)', color: '#0a6e5a' },
  logistico:           { label: 'Logístico', bg: 'rgba(232,145,58,0.10)', color: '#b86a10' },
  prestador_servicios: { label: 'Prestador', bg: 'rgba(10,126,140,0.07)', color: '#0A7E8C' },
}

const ROLE_LABELS: Record<string, string> = {
  acompanamiento:      'Acompañamiento',
  logistico:           'Logístico',
  prestador_servicios: 'Prestador de servicios',
}

const PROXIMITY_LABELS: Record<string, string> = {
  nucleo:       'Es parte de mi núcleo',
  ayuda:        'Es alguien que me ayuda o puede ayudar',
  profesional:  'Es un proveedor de servicios o un profesional',
}

const TOPIC_COLORS = [
  { value: '#0A7E8C', label: 'Teal' },
  { value: '#2ECDA7', label: 'Mint' },
  { value: '#8FA44A', label: 'Verde' },
  { value: '#E8913A', label: 'Naranja' },
  { value: '#4BAAB5', label: 'Celeste' },
  { value: '#7B8FA6', label: 'Gris azul' },
]

const DOC_TYPE_LABELS: Record<string, string> = {
  estudio_medico: 'Estudio médico',
  receta:         'Receta',
  informe:        'Informe',
  otros:          'Otros',
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function IconDoc() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}

function IconAddTask() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A7E8C"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  )
}

function IconAddPerson() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A7E8C"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8"  x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  )
}

function IconUpload() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A7E8C"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function IconClose({ color = '#5a7478' }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6"  x2="6"  y2="18" />
      <line x1="6"  y1="6"  x2="18" y2="18" />
    </svg>
  )
}

function IconDownload({ color = 'white' }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function IconTaskAlt({ done }: { done: boolean }) {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
      stroke={done ? '#8fa4a8' : 'white'} strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  )
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-bold uppercase text-[#5a7478]"
      style={{ fontSize: '0.875rem', letterSpacing: '0.1em', marginBottom: 16 }}>
      {children}
    </p>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#FFFFFF', borderRadius: '1.5rem',
      boxShadow: '0 4px 24px rgba(10,126,140,0.08)', padding: 24, ...style,
    }}>
      {children}
    </div>
  )
}

// ── Sidesheet shared elements ──────────────────────────────────────────────────

const SS_INPUT_STYLE: React.CSSProperties = {
  flex: 1, border: 'none', background: 'none',
  fontSize: '0.875rem', fontWeight: 600, outline: 'none',
  color: '#1A1A2E', fontFamily: 'inherit',
}

const SS_SELECT_STYLE: React.CSSProperties = {
  flex: 1, maxWidth: 220,
  background: '#FAF8F5',
  border: '1.5px solid rgba(10,126,140,0.12)',
  borderRadius: 9999,
  padding: '8px 36px 8px 16px',
  fontSize: '0.875rem', color: '#1A1A2E',
  outline: 'none', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235a7478' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: 16,
  cursor: 'pointer',
}

// ── Page ───────────────────────────────────────────────────────────────────────

function TopicDropdownPortal({
  topics,
  selectedId,
  topicDropdown,
  editTopicName,
  setEditTopicName,
  editTopicColor,
  setEditTopicColor,
  editTopicLoading,
  onClose,
  onToggleTopic,
  onOpenEdit,
  onOpenCreate,
  onSaveTopic,
  onDeleteTopic,
}: {
  topics:            Topic[]
  selectedId:        string
  topicDropdown:     { open: boolean; context: 'view' | 'add'; view: 'list' | 'edit' | 'create'; editTopic: Topic | null; anchorRect: DOMRect | null }
  editTopicName:     string
  setEditTopicName:  (v: string) => void
  editTopicColor:    string
  setEditTopicColor: (v: string) => void
  editTopicLoading:  boolean
  onClose:           () => void
  onToggleTopic:     (id: string) => void
  onOpenEdit:        (t: Topic) => void
  onOpenCreate:      () => void
  onSaveTopic:       () => void
  onDeleteTopic:     () => void
}) {
  const { anchorRect, view, editTopic } = topicDropdown
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
            {/* Back */}
            <button
              type="button"
              onClick={() => { setEditTopicName(''); setEditTopicColor('#0A7E8C'); onClose() }}
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
                if (e.key === 'Enter') { e.preventDefault(); onSaveTopic() }
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
                onClick={onSaveTopic}
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
                  onClick={onDeleteTopic}
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

export default function GestionPage() {
  const [id, setId] = useState<string | null>(null)
  const router  = useRouter()

  // ── Page data state ──────────────────────────────────────────────────────────
  const [crisis,   setCrisis]   = useState<Crisis | null>(null)
  const [tasks,    setTasks]    = useState<Task[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [docs,     setDocs]     = useState<Doc[]>([])
  const [history,  setHistory]  = useState<HistoryEvent[]>([])
  const [loading,  setLoading]  = useState(true)

  const [topics, setTopics] = useState<Topic[]>([])
  const [topicDropdown, setTopicDropdown] = useState<{
    open:       boolean
    context:    'view' | 'add'
    view:       'list' | 'edit' | 'create'
    editTopic:  Topic | null
    anchorRect: DOMRect | null
  }>({ open: false, context: 'view', view: 'list', editTopic: null, anchorRect: null })
  const [editTopicName,    setEditTopicName]    = useState('')
  const [editTopicColor,   setEditTopicColor]   = useState('#0A7E8C')
  const [editTopicLoading, setEditTopicLoading] = useState(false)
  const [addTopicId,       setAddTopicId]       = useState<string>('')

  // ── Sidesheet state ──────────────────────────────────────────────────────────
  const [ssMode,    setSsMode]    = useState<SSMode>(null)
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null)
  const [ssTask,    setSsTask]    = useState<Task | null>(null)
  const [ssLoading, setSsLoading] = useState(false)
  const [ssError,   setSsError]   = useState<string | null>(null)

  // Task-add form fields
  const [addTitle,    setAddTitle]    = useState('')
  const [addDate,     setAddDate]     = useState('')
  const [addTime,     setAddTime]     = useState('')
  const [timeOpen,    setTimeOpen]    = useState(false)
  const [addAssignee, setAddAssignee] = useState('')

  // Task-view: local assignee select (to allow editing without page reload)
  const [tvAssignee, setTvAssignee] = useState('')

  // Member sidesheet state
  const [ssMember,    setSsMember]    = useState<Contact | null>(null)
  const [mvRole,      setMvRole]      = useState('')
  const [mvProximity, setMvProximity] = useState('')
  const [availableContacts, setAvailableContacts] = useState<Contact[]>([])
  const [availableLoading,  setAvailableLoading]  = useState(false)

  // Doc sidesheet state
  const [ssDoc,          setSsDoc]          = useState<Doc | null>(null)
  const [docName,        setDocName]        = useState('')
  const [docType,        setDocType]        = useState('estudio_medico')
  const [docFile,        setDocFile]        = useState<File | null>(null)
  const [isDraggingDoc,  setIsDraggingDoc]  = useState(false)
  const fileInputRef                        = useRef<HTMLInputElement>(null)
  const dragCounterRef                      = useRef(0)

  // Doc preview modal state
  const [docModalOpen,    setDocModalOpen]    = useState(false)
  const [docModalUrl,     setDocModalUrl]     = useState<string | null>(null)
  const [docModalLoading, setDocModalLoading] = useState(false)
  const [docThumbUrl,     setDocThumbUrl]     = useState<string | null>(null)

  // ── Load data ────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) { router.replace('/login'); return }

      const { data: activeCrisis, error: activeCrisisError } = await supabase
        .from('crises')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'activa')
        .maybeSingle()

      if (activeCrisisError || !activeCrisis) {
        setLoading(false)
        return
      }

      setId(activeCrisis.id)
      const currentId = activeCrisis.id

      const [crisisRes, tasksRes, contactsRes, docsRes, historyRes, topicsRes] = await Promise.all([
        supabase
          .from('crises')
          .select('id, name, status, category, started_at, ai_summary')
          .eq('id', currentId).eq('user_id', user.id).maybeSingle(),
        supabase
          .from('tasks')
          .select('id, title, status, due_date, assigned_contact_id, assigned_to_user, topic_id')
          .eq('crisis_id', currentId).order('due_date', { ascending: true, nullsFirst: false }),
        supabase
          .from('crisis_contacts')
          .select('contact:contacts(id, name, role, proximity, initials, phone, email, relationship)')
          .eq('crisis_id', currentId),
        supabase
          .from('documents')
          .select('id, name, type, created_at, storage_path, original_filename, file_size_bytes, file_mime_type, uploaded_by_user, uploaded_by_contact_id')
          .eq('crisis_id', currentId).order('created_at', { ascending: false }),
        supabase
          .from('crisis_history')
          .select('id, title, description, occurred_at')
          .eq('crisis_id', currentId).order('occurred_at', { ascending: false }),
        supabase
          .from('topics')
          .select('id, name, color, crisis_id')
          .eq('crisis_id', currentId)
          .order('created_at', { ascending: true }),
      ])

      if (crisisRes.error) console.error('Error crisis:', crisisRes.error)
      if (!crisisRes.data) { router.replace('/crisis'); return }
      setCrisis(crisisRes.data)

      if (tasksRes.error) console.error('Error tasks:', tasksRes.error)
      setTasks((tasksRes.data ?? []) as Task[])

      if (contactsRes.error) console.error('Error contacts:', contactsRes.error)
      const ccRows = (contactsRes.data ?? []) as { contact: Contact | Contact[] | null }[]
      const dedup  = new Map<string, Contact>()
      for (const r of ccRows) {
        const c = Array.isArray(r.contact) ? r.contact[0] : r.contact
        if (c && !dedup.has(c.id)) dedup.set(c.id, c)
      }
      setContacts(Array.from(dedup.values()))

      if (docsRes.error) console.error('Error docs:', docsRes.error)
      setDocs((docsRes.data ?? []) as Doc[])

      if (historyRes.error) console.error('Error history:', historyRes.error)
      setHistory((historyRes.data ?? []) as HistoryEvent[])

      setTopics((topicsRes.data ?? []) as Topic[])

      setLoading(false)
    }
    load()
  }, [id, router])

  // ── Task reload ───────────────────────────────────────────────────────────────

  const reloadTasks = useCallback(async () => {
    const { data } = await supabase
      .from('tasks')
      .select('id, title, status, due_date, assigned_contact_id, assigned_to_user, topic_id')
      .eq('crisis_id', id)
      .eq('status', 'pendiente')
      .order('due_date', { ascending: true, nullsFirst: false })
    if (data) setTasks(data as Task[])
  }, [id])

  const reloadContacts = useCallback(async () => {
    const { data } = await supabase
      .from('crisis_contacts')
      .select('contact:contacts(id, name, role, proximity, initials, phone, email, relationship)')
      .eq('crisis_id', id)
    if (!data) return
    const ccRows = data as { contact: Contact | Contact[] | null }[]
    const dedup  = new Map<string, Contact>()
    for (const r of ccRows) {
      const c = Array.isArray(r.contact) ? r.contact[0] : r.contact
      if (c && !dedup.has(c.id)) dedup.set(c.id, c)
    }
    setContacts(Array.from(dedup.values()))
  }, [id])

  const reloadHistory = useCallback(async () => {
    const { data } = await supabase
      .from('crisis_history')
      .select('id, title, description, occurred_at')
      .eq('crisis_id', id)
      .order('occurred_at', { ascending: false })
    if (data) setHistory(data as HistoryEvent[])
  }, [id])

  const reloadTopics = useCallback(async () => {
    const { data } = await supabase
      .from('topics')
      .select('id, name, color, crisis_id')
      .eq('crisis_id', id)
      .order('created_at', { ascending: true })
    if (data) setTopics(data as Topic[])
  }, [id])

  const reloadDocs = useCallback(async () => {
    const { data } = await supabase
      .from('documents')
      .select('id, name, type, created_at, storage_path, original_filename, file_size_bytes, file_mime_type, uploaded_by_user, uploaded_by_contact_id')
      .eq('crisis_id', id)
      .order('created_at', { ascending: false })
    if (data) setDocs(data as Doc[])
  }, [id])

  const logHistory = useCallback(async (title: string, description: string | null, eventType: string) => {
    const { error } = await supabase.from('crisis_history').insert({
      crisis_id:   id,
      title,
      description,
      event_type:  eventType,
      occurred_at: new Date().toISOString(),
    })
    if (error) {
      console.error('Error logging history:', error.message, error.details, error.hint, error.code)
      return
    }
    await reloadHistory()
  }, [id, reloadHistory])

  // ── Close modal on Escape ─────────────────────────────────────────────────────

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && docModalOpen) {
        setDocModalOpen(false)
        setDocModalUrl(null)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [docModalOpen])

  // ── Sidesheet helpers ─────────────────────────────────────────────────────────

  function openTaskView(t: Task) {
    setSsTask(t)
    setTvAssignee(encodeAssignee(t))
    setSsError(null)
    setSsMode('task-view')
  }

  function openTaskAdd() {
    setAddTitle('')
    setAddDate('')
    setAddTime('')
    setTimeOpen(false)
    setAddAssignee('')
    setAddTopicId('')
    setSsError(null)
    setSsMode('task-add')
  }

  function openMemberView(c: Contact) {
    setSsMember(c)
    setMvRole(c.role ?? '')
    setMvProximity(c.proximity ?? '')
    setSsError(null)
    setSsMode('member-view')
  }

  async function openMemberAdd() {
    setSsError(null)
    setAvailableContacts([])
    setAvailableLoading(true)
    setSsMode('member-add')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setAvailableLoading(false); return }

    const { data: allContacts, error } = await supabase
      .from('contacts')
      .select('id, name, role, proximity, initials, phone, email, relationship')
      .eq('user_id', user.id)
      .order('name', { ascending: true })

    setAvailableLoading(false)
    if (error) { setSsError(error.message); return }

    const inCrisis = new Set(contacts.map((c) => c.id))
    const available = (allContacts ?? []).filter((c) => !inCrisis.has(c.id)) as Contact[]
    setAvailableContacts(available)
  }

  function closeSheet() {
    setSsMode(null)
    setSsTask(null)
    setSsMember(null)
    setSsDoc(null)
    setSsError(null)
    setDocModalOpen(false)
    setDocModalUrl(null)
    setDocThumbUrl(null)
  }

  // ── Topic dropdown handlers ───────────────────────────────────────────────────

  function openTopicDropdown(e: React.MouseEvent, context: 'view' | 'add') {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setTopicDropdown({ open: true, context, view: 'list', editTopic: null, anchorRect: rect })
    setEditTopicName('')
    setEditTopicColor('#0A7E8C')
  }

  function closeTopicDropdown() {
    setTopicDropdown(prev => ({ ...prev, open: false }))
  }

  function openEditTopic(t: Topic) {
    setEditTopicName(t.name)
    setEditTopicColor(t.color ?? '#0A7E8C')
    setTopicDropdown(prev => ({ ...prev, view: 'edit', editTopic: t }))
  }

  function openCreateTopic() {
    setEditTopicName('')
    setEditTopicColor('#0A7E8C')
    setTopicDropdown(prev => ({ ...prev, view: 'create', editTopic: null }))
  }

  async function handleSaveTopic() {
    if (!editTopicName.trim() || !id) return
    setEditTopicLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setEditTopicLoading(false); return }

    if (topicDropdown.view === 'create') {
      const { data: newTopic, error } = await supabase
        .from('topics')
        .insert({ crisis_id: id, user_id: user.id, name: editTopicName.trim(), color: editTopicColor })
        .select('id, name, color, crisis_id')
        .single()
      setEditTopicLoading(false)
      if (error) { setSsError(error.message); return }
      await reloadTopics()
      // Auto-select the new topic for the triggering context
      if (topicDropdown.context === 'add') {
        setAddTopicId(newTopic.id)
      } else if (topicDropdown.context === 'view' && ssTask) {
        await supabase.from('tasks').update({ topic_id: newTopic.id }).eq('id', ssTask.id)
        await reloadTasks()
        setSsTask(prev => prev ? { ...prev, topic_id: newTopic.id } : prev)
      }
      setTopicDropdown(prev => ({ ...prev, view: 'list', editTopic: null }))
    } else if (topicDropdown.view === 'edit' && topicDropdown.editTopic) {
      const { error } = await supabase
        .from('topics')
        .update({ name: editTopicName.trim(), color: editTopicColor })
        .eq('id', topicDropdown.editTopic.id)
      setEditTopicLoading(false)
      if (error) { setSsError(error.message); return }
      await reloadTopics()
      setTopicDropdown(prev => ({ ...prev, view: 'list', editTopic: null }))
    }
  }

  async function handleDeleteTopic() {
    if (!topicDropdown.editTopic) return
    if (!window.confirm(`¿Eliminar el tema "${topicDropdown.editTopic.name}"?`)) return
    setEditTopicLoading(true)
    const { error } = await supabase.from('topics').delete().eq('id', topicDropdown.editTopic.id)
    setEditTopicLoading(false)
    if (error) { setSsError(error.message); return }
    await reloadTopics()
    // Clear selection if this topic was selected
    if (topicDropdown.context === 'add' && addTopicId === topicDropdown.editTopic.id) setAddTopicId('')
    if (topicDropdown.context === 'view' && ssTask?.topic_id === topicDropdown.editTopic.id) {
      await supabase.from('tasks').update({ topic_id: null }).eq('id', ssTask.id)
      await reloadTasks()
      setSsTask(prev => prev ? { ...prev, topic_id: null } : prev)
    }
    setTopicDropdown(prev => ({ ...prev, view: 'list', editTopic: null }))
  }

  async function handleToggleTopicOnTask(topicId: string) {
    if (topicDropdown.context === 'add') {
      setAddTopicId(topicId)
      closeTopicDropdown()
    } else if (topicDropdown.context === 'view' && ssTask) {
      // '' means "Sin tema" → always set null; otherwise toggle
      const newId = topicId === ''
        ? null
        : ssTask.topic_id === topicId ? null : topicId
      const { error } = await supabase.from('tasks').update({ topic_id: newId }).eq('id', ssTask.id)
      if (error) { setSsError(error.message); return }
      await reloadTasks()
      setSsTask(prev => prev ? { ...prev, topic_id: newId } : prev)
      closeTopicDropdown()
    }
  }

  // ── Task view actions ─────────────────────────────────────────────────────────

  async function handleAssigneeChange(val: string) {
    if (!ssTask) return
    setTvAssignee(val)
    const fields = decodeAssignee(val)
    const { error } = await supabase.from('tasks').update(fields).eq('id', ssTask.id)
    if (error) { setSsError(error.message); return }
    await reloadTasks()

    let assigneeName: string | null = null
    if (val === 'yo') {
      assigneeName = 'Yo'
    } else if (val.startsWith('c:')) {
      const c = contactById.get(val.slice(2))
      assigneeName = c?.name ?? null
    }
    if (assigneeName) {
      await logHistory('Tarea reasignada', `${ssTask.title} → ${assigneeName}`, 'actualizacion_general')
    }
  }

  async function handleToggleStatus() {
    if (!ssTask || ssLoading) return
    setSsLoading(true)
    setSsError(null)
    const newStatus = ssTask.status === 'completada' ? 'pendiente' : 'completada'
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', ssTask.id)
    setSsLoading(false)
    if (error) { setSsError(error.message); return }

    if (newStatus === 'completada') {
      // 1. Cerrar el sidesheet
      closeSheet()
      // 2. Disparar animación en la tarea
      setCompletingTaskId(ssTask.id)
      // 3. Después de la animación, recargar tareas
      setTimeout(async () => {
        setCompletingTaskId(null)
        await reloadTasks()
        await logHistory('Tarea completada', ssTask.title, 'tarea_completada')
      }, 900)
    } else {
      await reloadTasks()
      closeSheet()
    }
  }

  async function handleDelete() {
    if (!ssTask) return
    if (!window.confirm(`¿Eliminar la tarea "${ssTask.title}"?`)) return
    setSsLoading(true)
    setSsError(null)
    const { error } = await supabase.from('tasks').delete().eq('id', ssTask.id)
    setSsLoading(false)
    if (error) { setSsError(error.message); return }
    await reloadTasks()
    closeSheet()
  }

  // ── Task add action ───────────────────────────────────────────────────────────

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault()
    if (!addTitle.trim() || ssLoading) return
    setSsLoading(true)
    setSsError(null)
    const title          = addTitle.trim()
    const assigneeFields = decodeAssignee(addAssignee)
    const dateStr        = parseDate(addDate)
    const dueDate        = dateStr && addTime ? `${dateStr}T${addTime}:00` : dateStr
    const { error } = await supabase.from('tasks').insert({
      crisis_id: id,
      title,
      due_date:  dueDate,
      status:    'pendiente',
      topic_id:  addTopicId || null,
      ...assigneeFields,
    })
    setSsLoading(false)
    if (error) { setSsError(error.message); return }
    await reloadTasks()
    await logHistory('Tarea agregada', title, 'tarea_agregada')
    closeSheet()
  }

  // ── Member view actions ───────────────────────────────────────────────────────

  async function handleRoleChange(val: string) {
    if (!ssMember) return
    setMvRole(val)
    setSsError(null)
    const { error } = await supabase.from('contacts').update({ role: val }).eq('id', ssMember.id)
    if (error) { setSsError(error.message); return }
    await reloadContacts()
  }

  async function handleProximityChange(val: string) {
    if (!ssMember) return
    setMvProximity(val)
    setSsError(null)
    const { error } = await supabase.from('contacts').update({ proximity: val }).eq('id', ssMember.id)
    if (error) { setSsError(error.message); return }
    await reloadContacts()
  }

  async function handleRemoveMember() {
    if (!ssMember) return
    if (!window.confirm(`¿Quitar a ${ssMember.name.split(' ')[0]} de esta crisis?`)) return
    setSsLoading(true)
    setSsError(null)
    const { error } = await supabase
      .from('crisis_contacts')
      .delete()
      .eq('crisis_id', id)
      .eq('contact_id', ssMember.id)
    setSsLoading(false)
    if (error) { setSsError(error.message); return }
    await reloadContacts()
    closeSheet()
  }

  // ── Member add action ─────────────────────────────────────────────────────────

  async function handleAddMember(c: Contact) {
    if (ssLoading) return
    setSsLoading(true)
    setSsError(null)
    const { error } = await supabase
      .from('crisis_contacts')
      .insert({ crisis_id: id, contact_id: c.id })
    setSsLoading(false)
    if (error) { setSsError(error.message); return }
    await reloadContacts()
    closeSheet()
  }

  // ── Doc view / add actions ────────────────────────────────────────────────────

  async function openDocView(d: Doc) {
    setSsDoc(d)
    setSsError(null)
    setDocThumbUrl(null)
    setSsMode('doc-view')
    const mime = d.file_mime_type ?? ''
    if (mime.startsWith('image/') || mime === 'application/pdf') {
      const { data } = await supabase.storage.from('docs').createSignedUrl(d.storage_path, 3600)
      if (data?.signedUrl) setDocThumbUrl(data.signedUrl)
    }
  }

  function openDocAdd() {
    setDocName('')
    setDocType('estudio_medico')
    setDocFile(null)
    setSsError(null)
    setSsMode('doc-add')
  }

  function handleFileSelect(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      setSsError('El archivo supera el límite de 10 MB')
      return
    }
    setSsError(null)
    setDocFile(file)
  }

  async function handleDocDownload(urlOverride?: string) {
    if (!ssDoc) return
    let url = urlOverride ?? null
    if (!url) {
      setSsLoading(true)
      setSsError(null)
      const { data, error } = await supabase.storage.from('docs').createSignedUrl(
        ssDoc.storage_path, 3600,
        { download: ssDoc.original_filename ?? ssDoc.name },
      )
      setSsLoading(false)
      if (error || !data?.signedUrl) {
        setSsError('No se pudo generar el link de descarga')
        return
      }
      url = data.signedUrl
    }
    const a = document.createElement('a')
    a.href = url
    a.download = ssDoc.original_filename ?? ssDoc.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  async function handleDocOpen() {
    if (!ssDoc) return
    if (docThumbUrl) {
      setDocModalUrl(docThumbUrl)
      setDocModalOpen(true)
      return
    }
    setDocModalLoading(true)
    setSsError(null)
    const { data, error } = await supabase.storage.from('docs').createSignedUrl(ssDoc.storage_path, 3600)
    setDocModalLoading(false)
    if (error || !data?.signedUrl) {
      setSsError('No se pudo generar la vista previa')
      return
    }
    setDocModalUrl(data.signedUrl)
    setDocModalOpen(true)
  }

  async function handleDocDelete() {
    if (!ssDoc) return
    if (!window.confirm(`¿Eliminar el documento "${ssDoc.name}"?`)) return
    setSsLoading(true)
    setSsError(null)
    const { error: storageErr } = await supabase.storage.from('docs').remove([ssDoc.storage_path])
    if (storageErr) { setSsLoading(false); setSsError(storageErr.message); return }
    const { error: dbErr } = await supabase.from('documents').delete().eq('id', ssDoc.id)
    setSsLoading(false)
    if (dbErr) { setSsError(dbErr.message); return }
    await reloadDocs()
    closeSheet()
  }

  async function handleAddDoc(e: React.FormEvent) {
    e.preventDefault()
    if (!docFile || ssLoading) return
    setSsLoading(true)
    setSsError(null)
    const timestamp = Date.now()
    const safeName  = docFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path      = `${id}/${timestamp}_${safeName}`
    const { error: uploadErr } = await supabase.storage.from('docs').upload(path, docFile)
    if (uploadErr) {
      setSsLoading(false)
      setSsError(`Error al subir el archivo: ${uploadErr.message}`)
      return
    }
    const { error: dbErr } = await supabase.from('documents').insert({
      crisis_id:              id,
      name:                   docName.trim(),
      type:                   docType,
      storage_path:           path,
      original_filename:      docFile.name,
      file_size_bytes:        docFile.size,
      file_mime_type:         docFile.type,
      uploaded_by_user:       true,
      uploaded_by_contact_id: null,
    })
    if (dbErr) {
      await supabase.storage.from('docs').remove([path])
      setSsLoading(false)
      setSsError(dbErr.message)
      return
    }
    await logHistory('Documento cargado', docName.trim(), 'actualizacion_general')
    await reloadDocs()
    setSsLoading(false)
    closeSheet()
  }

  // ── Derived ───────────────────────────────────────────────────────────────────

  const contactById = new Map(contacts.map((c) => [c.id, c]))
  const isOpen      = ssMode !== null

  // ── Render ────────────────────────────────────────────────────────────────────

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
        .gestion-bg { animation: heroBgDrift 30s ease-in-out infinite; }
        @keyframes strikethrough {
          0%   { width: 0%; opacity: 1; }
          60%  { width: 100%; opacity: 1; }
          100% { width: 100%; opacity: 1; }
        }
        @keyframes taskFadeOut {
          0%   { opacity: 1; transform: translateX(0);    max-height: 80px; }
          100% { opacity: 0; transform: translateX(-12px); max-height: 0;   padding: 0; }
        }
      `}</style>

      {/* ══════════════════════════════════════════════════════════════════════
          TOPIC DROPDOWN PORTAL
      ══════════════════════════════════════════════════════════════════════ */}

      {topicDropdown.open && (
        <TopicDropdownPortal
          topics={topics}
          selectedId={topicDropdown.context === 'view' ? (ssTask?.topic_id ?? '') : addTopicId}
          topicDropdown={topicDropdown}
          editTopicName={editTopicName}
          setEditTopicName={setEditTopicName}
          editTopicColor={editTopicColor}
          setEditTopicColor={setEditTopicColor}
          editTopicLoading={editTopicLoading}
          onClose={closeTopicDropdown}
          onToggleTopic={handleToggleTopicOnTask}
          onOpenEdit={openEditTopic}
          onOpenCreate={openCreateTopic}
          onSaveTopic={handleSaveTopic}
          onDeleteTopic={handleDeleteTopic}
        />
      )}

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
          zIndex:     201,
          transform:  isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
          overflowY:  'auto',
          display:    'flex',
          flexDirection: 'column',
          boxShadow:  '-6px 0 32px rgba(0,0,0,0.10)',
        }}
      >
        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 0', flexShrink: 0,
        }}>
          <span style={{
            fontSize: '0.7rem', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5a7478',
          }}>
            {ssMode === 'task-view'     ? 'Tarea'
             : ssMode === 'task-add'    ? 'Nueva tarea'
             : ssMode === 'member-view' ? 'Miembro del círculo'
             : ssMode === 'member-add'  ? 'Agregar al círculo'
             : ssMode === 'doc-view'    ? 'Documento'
             : ssMode === 'doc-add'     ? 'Cargar documento'
             : ''}
          </span>
          <button
            onClick={closeSheet}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#5a7478', fontSize: '1rem', transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.11)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)' }}
          >
            ✕
          </button>
        </div>

        {/* ── TASK VIEW ── */}
        {ssMode === 'task-view' && ssTask && (() => {
          const isDone = ssTask.status === 'completada'
          return (
            <div style={{ padding: '0 24px 40px', flex: 1 }}>
              {/* Hero */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                textAlign: 'center', padding: '24px 0 20px',
                borderBottom: '1px solid rgba(10,126,140,0.12)', marginBottom: 24,
              }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: isDone ? 'rgba(90,116,120,0.25)' : 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isDone ? 'none' : '0 8px 40px rgba(10,126,140,0.16)',
                  marginBottom: 14,
                }}>
                  <IconTaskAlt done={isDone} />
                </div>
                <div style={{
                  fontSize: '1.5rem', fontWeight: 800,
                  letterSpacing: '-0.02em', marginBottom: 8, color: '#1A1A2E',
                }}>
                  {ssTask.title}
                </div>
                {isDone ? (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', borderRadius: 9999,
                    padding: '3px 11px', fontSize: '0.7rem', fontWeight: 700,
                    letterSpacing: '0.05em', textTransform: 'uppercase',
                    background: 'rgba(90,116,120,0.10)', color: '#5a7478',
                  }}>Completada</span>
                ) : (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', borderRadius: 9999,
                    padding: '3px 11px', fontSize: '0.7rem', fontWeight: 700,
                    letterSpacing: '0.05em', textTransform: 'uppercase',
                    background: 'rgba(46,205,167,0.14)', color: '#0a6e5a',
                  }}>Pendiente</span>
                )}
              </div>

              {/* Detail card */}
              <div style={{ marginBottom: 24 }}>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
                }}>Detalle</p>
                <Card style={{ padding: 0, borderRadius: '1rem' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '13px 20px', borderBottom: '1px solid rgba(10,126,140,0.12)', gap: 12,
                  }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                      textTransform: 'uppercase', color: '#5a7478', minWidth: 80,
                    }}>Asignado a</span>
                    <select
                      value={tvAssignee}
                      onChange={(e) => handleAssigneeChange(e.target.value)}
                      style={SS_SELECT_STYLE}
                    >
                      <option value="">Sin asignar</option>
                      <option value="yo">Yo</option>
                      {contacts.map((c) => (
                        <option key={c.id} value={`c:${c.id}`}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '13px 20px', gap: 12,
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
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {(() => {
                        const t = topics.find(x => x.id === ssTask.topic_id)
                        return t ? (
                          <span style={{
                            padding: '3px 10px', borderRadius: 9999,
                            background: `${t.color ?? '#0A7E8C'}18`,
                            color: t.color ?? '#0A7E8C',
                            fontSize: '0.72rem', fontWeight: 700,
                            border: `1.5px solid ${t.color ?? '#0A7E8C'}40`,
                          }}>{t.name}</span>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: '#9ab4b8', fontWeight: 500 }}>Sin tema</span>
                        )
                      })()}
                      <button
                        type="button"
                        onClick={(e) => openTopicDropdown(e, 'view')}
                        style={{
                          padding: 0, background: 'none', border: 'none',
                          color: '#0A7E8C', fontSize: '0.8125rem',
                          fontWeight: 600, cursor: 'pointer',
                          fontFamily: 'inherit',
                          textDecoration: 'underline',
                          textUnderlineOffset: 3,
                        }}
                      >
                        {ssTask.topic_id ? 'Cambiar' : 'Agregar'}
                      </button>
                    </div>
                  </div>
                </Card>
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
                  {ssLoading ? 'Procesando…' : isDone ? 'Reabrir tarea' : 'Marcar como completada'}
                </button>
              </div>

              <div>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
                }}>Acciones</p>
                <Card style={{ padding: 0, borderRadius: '1rem' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '13px 20px', gap: 12,
                  }}>
                    <span style={{ fontSize: '0.875rem', color: '#5a7478', flex: 1 }}>
                      Eliminar esta tarea
                    </span>
                    <button
                      onClick={handleDelete}
                      disabled={ssLoading}
                      style={{
                        background: 'rgba(186,26,26,0.06)', color: '#ba1a1a',
                        border: 'none', borderRadius: '0.6rem',
                        padding: '7px 16px', fontSize: '0.875rem', fontWeight: 700,
                        cursor: ssLoading ? 'not-allowed' : 'pointer', opacity: ssLoading ? 0.6 : 1,
                        transition: 'filter 0.15s',
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </Card>
              </div>
            </div>
          )
        })()}

        {/* ── TASK ADD ── */}
        {ssMode === 'task-add' && (
          <div style={{ padding: '0 24px 40px', flex: 1 }}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              textAlign: 'center', padding: '24px 0 20px',
              borderBottom: '1px solid rgba(10,126,140,0.12)', marginBottom: 24,
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'rgba(61,199,166,0.08)',
                border: '2px dashed rgba(61,199,166,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 14,
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0A7E8C"
                  strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 11 12 14 22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#1A1A2E' }}>
                Nueva tarea
              </div>
            </div>

            <form onSubmit={handleAddTask}>
              <p style={{
                fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
              }}>Datos</p>
              <Card style={{ padding: 0, borderRadius: '1rem', marginBottom: 24 }}>
                <div style={{
                  display: 'flex', alignItems: 'center',
                  padding: '13px 20px', borderBottom: '1px solid rgba(10,126,140,0.12)', gap: 12,
                }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                    textTransform: 'uppercase', color: '#5a7478', minWidth: 80,
                  }}>Tarea</span>
                  <input
                    type="text" required placeholder="Describí la tarea…"
                    value={addTitle} onChange={(e) => setAddTitle(e.target.value)}
                    style={{ ...SS_INPUT_STYLE }}
                  />
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center',
                  padding: '13px 20px', borderBottom: '1px solid rgba(10,126,140,0.12)', gap: 12,
                }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                    textTransform: 'uppercase', color: '#5a7478', minWidth: 80,
                  }}>Fecha</span>
                  <input
                    type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)}
                    style={{ ...SS_INPUT_STYLE, fontWeight: 400, colorScheme: 'light' }}
                  />
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center',
                  padding: '13px 20px', borderBottom: '1px solid rgba(10,126,140,0.12)', gap: 12,
                  position: 'relative',
                }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                    textTransform: 'uppercase', color: '#5a7478', minWidth: 80,
                  }}>Horario</span>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      type="text" placeholder="HH:MM" value={addTime}
                      onChange={(e) => { setAddTime(e.target.value); setTimeOpen(true) }}
                      onFocus={() => setTimeOpen(true)}
                      onBlur={() => setTimeout(() => setTimeOpen(false), 150)}
                      style={{ ...SS_INPUT_STYLE, fontWeight: 400 }}
                    />
                    {timeOpen && (
                      <div style={{
                        position: 'absolute', top: 'calc(100% + 6px)', left: -20, right: -20,
                        maxHeight: 220, overflowY: 'auto', background: '#FFFFFF',
                        borderRadius: '1rem', boxShadow: '0 8px 32px rgba(10,126,140,0.18)',
                        border: '1px solid rgba(10,126,140,0.10)', zIndex: 400,
                      }}>
                        {TIME_OPTIONS.filter(t => !addTime || t.startsWith(addTime)).map((t, i, arr) => (
                          <div
                            key={t}
                            onMouseDown={() => { setAddTime(t); setTimeOpen(false) }}
                            style={{
                              padding: '10px 20px', fontSize: '0.875rem',
                              fontWeight: addTime === t ? 700 : 400,
                              color: addTime === t ? '#0A7E8C' : '#1A1A2E',
                              background: addTime === t ? 'rgba(10,126,140,0.07)' : 'transparent',
                              cursor: 'pointer',
                              borderBottom: i < arr.length - 1 ? '1px solid rgba(10,126,140,0.06)' : 'none',
                              transition: 'background 0.1s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(61,199,166,0.10)' }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = addTime === t ? 'rgba(10,126,140,0.07)' : 'transparent'
                            }}
                          >
                            {t}
                          </div>
                        ))}
                        {TIME_OPTIONS.filter(t => !addTime || t.startsWith(addTime)).length === 0 && (
                          <div style={{ padding: '14px 20px', fontSize: '0.875rem', color: '#5a7478', textAlign: 'center' }}>
                            Sin resultados
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', padding: '13px 20px', gap: 12 }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                    textTransform: 'uppercase', color: '#5a7478', minWidth: 80,
                  }}>Asignado</span>
                  <select value={addAssignee} onChange={(e) => setAddAssignee(e.target.value)} style={SS_SELECT_STYLE}>
                    <option value="">— Sin asignar —</option>
                    <option value="yo">Yo</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={`c:${c.id}`}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </Card>

              <Card style={{ padding: 0, borderRadius: '1rem', marginBottom: 24, marginTop: 0 }}>
                <div style={{
                  display: 'flex', alignItems: 'center',
                  padding: '13px 20px', gap: 12,
                }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                    textTransform: 'uppercase', color: '#5a7478', minWidth: 80, flexShrink: 0,
                  }}>Tema</span>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {(() => {
                      const t = topics.find(x => x.id === addTopicId)
                      return t ? (
                        <span style={{
                          padding: '3px 10px', borderRadius: 9999,
                          background: `${t.color ?? '#0A7E8C'}18`,
                          color: t.color ?? '#0A7E8C',
                          fontSize: '0.72rem', fontWeight: 700,
                          border: `1.5px solid ${t.color ?? '#0A7E8C'}40`,
                        }}>{t.name}</span>
                      ) : null
                    })()}
                    <button
                      type="button"
                      onClick={(e) => openTopicDropdown(e, 'add')}
                      style={{
                        padding: 0, background: 'none', border: 'none',
                        color: '#0A7E8C', fontSize: '0.8125rem',
                        fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'inherit',
                        textDecoration: 'underline',
                        textUnderlineOffset: 3,
                      }}
                    >
                      {addTopicId ? 'Cambiar' : 'Agregar'}
                    </button>
                  </div>
                </div>
              </Card>

              {ssError && (
                <p style={{
                  fontSize: '0.7rem', color: '#ba1a1a', fontWeight: 600,
                  marginBottom: 16, padding: '10px 14px',
                  background: 'rgba(186,26,26,0.06)', borderRadius: '0.6rem',
                }}>
                  {ssError}
                </p>
              )}

              <button
                type="submit" disabled={ssLoading || !addTitle.trim()}
                style={{
                  width: '100%', padding: '14px', borderRadius: 9999,
                  border: 'none', cursor: ssLoading ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: '0.875rem',
                  background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                  color: 'white',
                  opacity: (ssLoading || !addTitle.trim()) ? 0.6 : 1,
                  transition: 'filter 0.15s',
                }}
              >
                {ssLoading ? 'Guardando…' : 'Agregar tarea'}
              </button>
            </form>
          </div>
        )}

        {/* ── MEMBER VIEW ── */}
        {ssMode === 'member-view' && ssMember && (() => {
          const initials = (ssMember.initials ?? getInitials(ssMember.name)).slice(0, 2)
          const badge = ROLE_BADGES[ssMember.role ?? ''] ?? null
          return (
            <div style={{ padding: '0 24px 40px', flex: 1 }}>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                textAlign: 'center', padding: '24px 0 20px',
                borderBottom: '1px solid rgba(10,126,140,0.12)', marginBottom: 24,
              }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '1.5rem', color: 'white',
                  boxShadow: '0 8px 40px rgba(10,126,140,0.16)', marginBottom: 14,
                }}>
                  {initials}
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8, color: '#1A1A2E' }}>
                  {ssMember.name}
                </div>
                {badge && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', borderRadius: 9999,
                    padding: '3px 11px', fontSize: '0.7rem', fontWeight: 700,
                    letterSpacing: '0.05em', textTransform: 'uppercase',
                    background: badge.bg, color: badge.color,
                  }}>
                    {ROLE_LABELS[ssMember.role ?? ''] ?? badge.label}
                  </span>
                )}
              </div>

              <div style={{ marginBottom: 24 }}>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
                }}>Datos de contacto</p>
                <Card style={{ padding: 0, borderRadius: '1rem' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '13px 20px', borderBottom: '1px solid rgba(10,126,140,0.12)', gap: 12,
                  }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                      textTransform: 'uppercase', color: '#5a7478', minWidth: 80,
                    }}>Teléfono</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1A1A2E', flex: 1 }}>
                      {ssMember.phone || '—'}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '13px 20px', borderBottom: '1px solid rgba(10,126,140,0.12)', gap: 12,
                  }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                      textTransform: 'uppercase', color: '#5a7478', minWidth: 80,
                    }}>Email</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1A1A2E', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ssMember.email || '—'}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '13px 20px', gap: 12,
                  }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                      textTransform: 'uppercase', color: '#5a7478', minWidth: 80,
                    }}>Relación</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1A1A2E', flex: 1 }}>
                      {ssMember.relationship || '—'}
                    </span>
                  </div>
                </Card>
              </div>

              <div style={{ marginBottom: 24 }}>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
                }}>Rol y cercanía</p>
                <Card style={{ padding: 0, borderRadius: '1rem' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '13px 20px', borderBottom: '1px solid rgba(10,126,140,0.12)', gap: 12,
                  }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                      textTransform: 'uppercase', color: '#5a7478', minWidth: 80,
                    }}>Rol</span>
                    <select
                      value={mvRole} onChange={(e) => handleRoleChange(e.target.value)}
                      style={{ ...SS_SELECT_STYLE, maxWidth: 240 }}
                    >
                      <option value="">— Sin rol —</option>
                      {Object.entries(ROLE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '13px 20px', gap: 12,
                  }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                      textTransform: 'uppercase', color: '#5a7478', minWidth: 80,
                    }}>Cercanía</span>
                    <select
                      value={mvProximity} onChange={(e) => handleProximityChange(e.target.value)}
                      style={{ ...SS_SELECT_STYLE, maxWidth: 280 }}
                    >
                      <option value="">— Sin definir —</option>
                      {Object.entries(PROXIMITY_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>
                </Card>
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

              <div>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
                }}>Acciones</p>
                <Card style={{ padding: 0, borderRadius: '1rem' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '13px 20px', gap: 12,
                  }}>
                    <span style={{ fontSize: '0.875rem', color: '#5a7478', flex: 1 }}>
                      Quitar a {ssMember.name.split(' ')[0]} de esta crisis
                    </span>
                    <button
                      onClick={handleRemoveMember} disabled={ssLoading}
                      style={{
                        background: 'rgba(186,26,26,0.06)', color: '#ba1a1a',
                        border: 'none', borderRadius: '0.6rem',
                        padding: '7px 16px', fontSize: '0.875rem', fontWeight: 700,
                        cursor: ssLoading ? 'not-allowed' : 'pointer',
                        opacity: ssLoading ? 0.6 : 1, transition: 'filter 0.15s',
                      }}
                    >
                      Quitar
                    </button>
                  </div>
                </Card>
              </div>
            </div>
          )
        })()}

        {/* ── MEMBER ADD ── */}
        {ssMode === 'member-add' && (
          <div style={{ padding: '0 24px 40px', flex: 1 }}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              textAlign: 'center', padding: '24px 0 20px',
              borderBottom: '1px solid rgba(10,126,140,0.12)', marginBottom: 24,
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'rgba(61,199,166,0.08)',
                border: '2px dashed rgba(61,199,166,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 14,
              }}>
                <IconAddPerson />
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#1A1A2E' }}>
                Agregar al círculo
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

            {availableLoading && (
              <p className="text-center" style={{ fontSize: '0.875rem', color: '#5a7478', padding: '24px 0' }}>
                Cargando contactos…
              </p>
            )}

            {!availableLoading && availableContacts.length === 0 && (
              <Card style={{ padding: 24, textAlign: 'center' }}>
                <p style={{ fontSize: '0.875rem', color: '#5a7478', lineHeight: 1.6 }}>
                  Todos tus contactos ya están en esta crisis.<br />
                  Podés agregar nuevos hablando con el agente.
                </p>
              </Card>
            )}

            {!availableLoading && availableContacts.length > 0 && (
              <>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
                }}>Contactos disponibles</p>
                <Card style={{ padding: 0, borderRadius: '1rem' }}>
                  {availableContacts.map((c, i) => {
                    const initials = (c.initials ?? getInitials(c.name)).slice(0, 2)
                    const badge = ROLE_BADGES[c.role ?? ''] ?? null
                    return (
                      <button
                        key={c.id} type="button" onClick={() => handleAddMember(c)}
                        disabled={ssLoading} className="flex items-center w-full text-left"
                        style={{
                          gap: 12, padding: '14px 20px',
                          borderBottom: i < availableContacts.length - 1 ? '1px solid rgba(10,126,140,0.12)' : 'none',
                          background: 'transparent', border: 'none',
                          cursor: ssLoading ? 'not-allowed' : 'pointer',
                          opacity: ssLoading ? 0.6 : 1, transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => { if (!ssLoading) e.currentTarget.style.background = 'rgba(61,199,166,0.07)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <div className="rounded-full flex items-center justify-center flex-shrink-0 text-white"
                          style={{
                            width: 36, height: 36, fontSize: '0.75rem', fontWeight: 700,
                            background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                          }}>
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-[#1A1A2E] truncate" style={{ fontSize: '0.875rem' }}>
                            {c.name}
                          </div>
                          {c.relationship && (
                            <div style={{ fontSize: '0.7rem', color: '#5a7478', marginTop: 2 }}>
                              {c.relationship}
                            </div>
                          )}
                        </div>
                        {badge && (
                          <span className="inline-flex items-center font-bold uppercase whitespace-nowrap flex-shrink-0"
                            style={{
                              background: badge.bg, color: badge.color, borderRadius: 9999,
                              padding: '3px 11px', fontSize: '0.7rem', letterSpacing: '0.05em',
                            }}>
                            {badge.label}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </Card>
              </>
            )}
          </div>
        )}

        {/* ── DOC VIEW ── */}
        {ssMode === 'doc-view' && ssDoc && (() => {
          const uploader = ssDoc.uploaded_by_user
            ? 'Vos'
            : ssDoc.uploaded_by_contact_id
              ? contactById.get(ssDoc.uploaded_by_contact_id)?.name ?? '—'
              : '—'
          return (
            <div style={{ padding: '0 24px 40px', flex: 1 }}>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                textAlign: 'center', padding: '24px 0 20px',
                borderBottom: '1px solid rgba(10,126,140,0.12)', marginBottom: 24,
              }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 8px 40px rgba(10,126,140,0.16)', marginBottom: 14,
                }}>
                  <IconDoc />
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8, color: '#1A1A2E' }}>
                  {ssDoc.name}
                </div>
                <span style={{ fontSize: '0.7rem', color: '#5a7478' }}>
                  {DOC_TYPE_LABELS[ssDoc.type ?? ''] ?? 'Documento'} · {fmtLongDate(ssDoc.created_at)}
                </span>
              </div>

              <div style={{ marginBottom: 24 }}>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
                }}>Información</p>
                <Card style={{ padding: 0, borderRadius: '1rem' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '13px 20px', borderBottom: '1px solid rgba(10,126,140,0.12)', gap: 12,
                  }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                      textTransform: 'uppercase', color: '#5a7478', minWidth: 80,
                    }}>Tipo</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1A1A2E', flex: 1 }}>
                      {DOC_TYPE_LABELS[ssDoc.type ?? ''] ?? '—'}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '13px 20px', borderBottom: '1px solid rgba(10,126,140,0.12)', gap: 12,
                  }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                      textTransform: 'uppercase', color: '#5a7478', minWidth: 80,
                    }}>Fecha</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1A1A2E', flex: 1 }}>
                      {fmtLongDate(ssDoc.created_at)}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '13px 20px', gap: 12,
                  }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                      textTransform: 'uppercase', color: '#5a7478', minWidth: 80,
                    }}>Subido por</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1A1A2E', flex: 1 }}>
                      {uploader}
                    </span>
                  </div>
                </Card>
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

              <div style={{ marginBottom: 12 }}>
                <button
                  onClick={() => handleDocDownload()} disabled={ssLoading}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 9999,
                    border: 'none', cursor: ssLoading ? 'not-allowed' : 'pointer',
                    fontWeight: 700, fontSize: '0.875rem', transition: 'filter 0.15s',
                    background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                    color: 'white', opacity: ssLoading ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <IconDownload />
                  {ssLoading ? 'Procesando…' : 'Descargar'}
                </button>
              </div>

              {(() => {
                const mime = ssDoc.file_mime_type ?? ''
                const isPreviewable = mime.startsWith('image/') || mime === 'application/pdf'
                if (!isPreviewable) {
                  return (
                    <div style={{ marginBottom: 24 }}>
                      <button
                        onClick={handleDocOpen} disabled={docModalLoading || ssLoading}
                        style={{
                          width: '100%', padding: '13px', borderRadius: 9999,
                          border: '1.5px solid rgba(10,126,140,0.25)',
                          background: 'white', cursor: (docModalLoading || ssLoading) ? 'not-allowed' : 'pointer',
                          fontWeight: 700, fontSize: '0.875rem', color: '#0A7E8C',
                          opacity: (docModalLoading || ssLoading) ? 0.6 : 1, transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(10,126,140,0.04)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'white' }}
                      >
                        {docModalLoading ? 'Cargando…' : 'Ver'}
                      </button>
                    </div>
                  )
                }
                return (
                  <div style={{ marginBottom: 24 }}>
                    <div
                      onClick={handleDocOpen} role="button" tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleDocOpen() }}
                      style={{
                        position: 'relative', borderRadius: '0.875rem', overflow: 'hidden',
                        cursor: 'pointer', border: '1.5px solid rgba(10,126,140,0.18)',
                        height: 180, background: '#f0f4f8',
                        transition: 'box-shadow 0.2s, border-color 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 4px 20px rgba(10,126,140,0.18)'
                        e.currentTarget.style.borderColor = 'rgba(10,126,140,0.38)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = 'none'
                        e.currentTarget.style.borderColor = 'rgba(10,126,140,0.18)'
                      }}
                    >
                      {docThumbUrl ? (
                        mime.startsWith('image/') ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={docThumbUrl} alt={ssDoc.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
                          />
                        ) : (
                          <>
                            <iframe
                              src={`${docThumbUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                              title="preview"
                              style={{ width: '100%', height: '100%', border: 'none', display: 'block', pointerEvents: 'none' }}
                            />
                            <div style={{ position: 'absolute', inset: 0 }} />
                          </>
                        )
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#5a7478', fontSize: '0.8rem' }}>
                          Cargando vista previa…
                        </div>
                      )}
                      <div style={{
                        position: 'absolute', bottom: 10, right: 10,
                        background: 'rgba(10,126,140,0.82)', backdropFilter: 'blur(6px)',
                        borderRadius: 9999, padding: '4px 12px',
                        fontSize: '0.75rem', fontWeight: 700, color: 'white', pointerEvents: 'none',
                      }}>
                        Ver
                      </div>
                    </div>
                  </div>
                )
              })()}

              <div>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
                }}>Acciones</p>
                <Card style={{ padding: 0, borderRadius: '1rem' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '13px 20px', gap: 12,
                  }}>
                    <span style={{ fontSize: '0.875rem', color: '#5a7478', flex: 1 }}>
                      Eliminar este documento
                    </span>
                    <button
                      onClick={handleDocDelete} disabled={ssLoading}
                      style={{
                        background: 'rgba(186,26,26,0.06)', color: '#ba1a1a',
                        border: 'none', borderRadius: '0.6rem',
                        padding: '7px 16px', fontSize: '0.875rem', fontWeight: 700,
                        cursor: ssLoading ? 'not-allowed' : 'pointer',
                        opacity: ssLoading ? 0.6 : 1, transition: 'filter 0.15s',
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </Card>
              </div>
            </div>
          )
        })()}

        {/* ── DOC ADD ── */}
        {ssMode === 'doc-add' && (
          <div style={{ padding: '0 24px 40px', flex: 1 }}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              textAlign: 'center', padding: '24px 0 20px',
              borderBottom: '1px solid rgba(10,126,140,0.12)', marginBottom: 24,
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'rgba(61,199,166,0.08)',
                border: '2px dashed rgba(61,199,166,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 14,
              }}>
                <IconUpload />
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#1A1A2E' }}>
                Cargar documento
              </div>
            </div>

            <form onSubmit={handleAddDoc}>
              <p style={{
                fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
              }}>Documento</p>
              <Card style={{ padding: 0, borderRadius: '1rem', marginBottom: 16 }}>
                <div style={{
                  display: 'flex', alignItems: 'center',
                  padding: '13px 20px', borderBottom: '1px solid rgba(10,126,140,0.12)', gap: 12,
                }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                    textTransform: 'uppercase', color: '#5a7478', minWidth: 80,
                  }}>Nombre</span>
                  <input
                    type="text" required placeholder="Nombre del documento…"
                    value={docName} onChange={(e) => setDocName(e.target.value)}
                    style={{ ...SS_INPUT_STYLE }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', padding: '13px 20px', gap: 12 }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                    textTransform: 'uppercase', color: '#5a7478', minWidth: 80,
                  }}>Tipo</span>
                  <select value={docType} onChange={(e) => setDocType(e.target.value)} style={SS_SELECT_STYLE}>
                    {Object.entries(DOC_TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
              </Card>

              <div
                onDragEnter={(e) => { e.preventDefault(); dragCounterRef.current++; setIsDraggingDoc(true) }}
                onDragLeave={() => { dragCounterRef.current--; if (dragCounterRef.current === 0) setIsDraggingDoc(false) }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  dragCounterRef.current = 0
                  setIsDraggingDoc(false)
                  const file = e.dataTransfer.files[0]
                  if (file) handleFileSelect(file)
                }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isDraggingDoc ? 'rgba(61,199,166,0.75)' : 'rgba(61,199,166,0.35)'}`,
                  borderRadius: '0.75rem', padding: '32px 20px',
                  textAlign: 'center', cursor: 'pointer', marginBottom: 16,
                  background: isDraggingDoc ? 'rgba(61,199,166,0.08)' : 'white',
                  transform: isDraggingDoc ? 'scale(1.025)' : 'scale(1)',
                  transition: 'transform 0.2s ease, background 0.2s ease, border-color 0.2s ease',
                }}
              >
                <input
                  ref={fileInputRef} type="file" style={{ display: 'none' }}
                  accept=".pdf,image/*,.doc,.docx"
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileSelect(file) }}
                />
                <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center', color: '#0A7E8C' }}>
                  <IconUpload />
                </div>
                {docFile ? (
                  <p style={{ fontSize: '0.875rem', color: '#0A7E8C', fontWeight: 600, margin: 0 }}>
                    {docFile.name}
                  </p>
                ) : (
                  <p style={{ fontSize: '0.875rem', color: '#5a7478', margin: 0 }}>
                    Hacé clic o arrastrá el archivo aquí
                  </p>
                )}
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

              <button
                type="submit" disabled={ssLoading || !docName.trim() || !docFile}
                style={{
                  width: '100%', padding: '14px', borderRadius: 9999,
                  border: 'none', cursor: (ssLoading || !docName.trim() || !docFile) ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: '0.875rem',
                  background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                  color: 'white',
                  opacity: (ssLoading || !docName.trim() || !docFile) ? 0.6 : 1,
                  transition: 'filter 0.15s',
                }}
              >
                {ssLoading ? 'Cargando…' : 'Cargar documento'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MAIN PAGE
      ══════════════════════════════════════════════════════════════════════ */}

      <div className="gestion-bg flex min-h-screen">
        <Sidebar />

        <main className="flex-1 ml-0 md:ml-[240px] min-h-screen px-5 py-8 pb-28 md:px-10 md:py-10 md:pb-10">
          <SkeletonStyles />

          {/* Empty state — no active crisis */}
          {!loading && !crisis && (
            <div className="flex justify-center" style={{ marginTop: 80 }}>
              <div style={{ textAlign: 'center', maxWidth: 400 }}>
                <p className="font-bold text-[#1A1A2E]" style={{ fontSize: '1rem', marginBottom: 8 }}>
                  No hay ninguna crisis activa
                </p>
                <p style={{ fontSize: '0.875rem', color: '#5a7478', marginBottom: 24 }}>
                  Hablá con el agente para registrar tu situación.
                </p>
                <Link href="/chat"
                  className="inline-block bg-[#0A7E8C] text-white font-bold rounded-full transition-all hover:brightness-110"
                  style={{ padding: '12px 28px', fontSize: '0.875rem' }}>
                  Hablar con el agente
                </Link>
              </div>
            </div>
          )}

          {/* Header */}
          {crisis && (
            <div style={{ marginBottom: 40 }}>
              <h1 className="font-extrabold text-[#1A1A2E]"
                style={{ fontSize: '2rem', letterSpacing: '-0.03em', marginBottom: 4, lineHeight: 1.15 }}>
                Gestión
              </h1>
              <p style={{ fontSize: '0.875rem', color: '#5a7478', fontWeight: 500 }}>
                {crisis.name}
              </p>
            </div>
          )}

          {/* 2-col grid */}
          <style>{`
            @media (min-width: 581px) {
              .gestion-grid { grid-template-columns: 1fr 1fr !important; }
            }
          `}</style>

          {crisis && (
            <div className="gestion-grid grid items-start" style={{ gap: 24, gridTemplateColumns: '1fr' }}>

              {/* ── Col 1: Tareas ───────────────────────────────────────── */}
              <div>
                <SectionTitle>Tareas</SectionTitle>
                <Card>
                  {tasks.filter(t => t.status === 'pendiente').length > 0 ? (
                    <div className="flex flex-col">
                      {tasks.filter(t => t.status === 'pendiente').map((t, i, arr) => {
                        const contact = t.assigned_contact_id ? contactById.get(t.assigned_contact_id) : null
                        let avInitials = '', avBg = ''
                        if (t.assigned_to_user) {
                          avInitials = 'Yo'; avBg = 'linear-gradient(135deg, #0A7E8C, #2ECDA7)'
                        } else if (contact) {
                          avInitials = (contact.initials ?? getInitials(contact.name)).slice(0, 2)
                          avBg = 'linear-gradient(135deg, #f4ab66, #E8913A)'
                        }
                        const isDone = t.status === 'completada'
                        return (
                          <div
                            key={t.id}
                            className="flex items-center cursor-pointer rounded-md"
                            onClick={() => completingTaskId !== t.id ? openTaskView(t) : undefined}
                            style={{
                              gap: 14, padding: '13px 6px',
                              borderBottom: i < arr.length - 1 ? '1px solid rgba(10,126,140,0.12)' : 'none',
                              margin: '0 -6px',
                              transition: 'background 0.15s',
                              overflow: 'hidden',
                              animation: completingTaskId === t.id
                                ? 'taskFadeOut 0.8s ease-out 0.35s forwards'
                                : 'none',
                            }}
                            onMouseEnter={(e) => { if (completingTaskId !== t.id) e.currentTarget.style.background = 'rgba(61,199,166,0.07)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                          >
                            <div className="flex-1 min-w-0">
                              <div style={{
                                fontSize: '0.875rem',
                                color: completingTaskId === t.id ? '#5a7478' : (isDone ? '#5a7478' : '#1A1A2E'),
                                fontWeight: isDone ? 400 : 600,
                                position: 'relative',
                                display: 'inline-block',
                              }}>
                                {t.title}
                                {/* Línea de tachado animada */}
                                {completingTaskId === t.id && (
                                  <span style={{
                                    position: 'absolute',
                                    left: 0, top: '50%',
                                    height: '1.5px',
                                    background: '#5a7478',
                                    borderRadius: 2,
                                    animation: 'strikethrough 0.35s ease-out forwards',
                                    pointerEvents: 'none',
                                  }} />
                                )}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: '#5a7478', marginTop: 2 }}>
                                {t.due_date ? `Vence el ${fmtLongDate(t.due_date)}` : 'Sin fecha'}
                              </div>
                              {t.topic_id && (() => {
                                const topic = topics.find(tp => tp.id === t.topic_id)
                                return topic ? (
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center',
                                    marginTop: 4,
                                    padding: '2px 8px', borderRadius: 9999,
                                    background: `${topic.color ?? '#0A7E8C'}22`,
                                    color: topic.color ?? '#0A7E8C',
                                    fontSize: '0.65rem', fontWeight: 700,
                                    letterSpacing: '0.04em',
                                  }}>
                                    {topic.name}
                                  </span>
                                ) : null
                              })()}
                            </div>
                            {avInitials && (
                              <div className="rounded-full flex items-center justify-center flex-shrink-0 text-white"
                                style={{ width: 24, height: 24, fontSize: '0.62rem', fontWeight: 700, background: avBg }}>
                                {avInitials}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-[#5a7478] text-center" style={{ fontSize: '0.875rem', padding: '24px 0' }}>
                      Sin tareas todavía
                    </p>
                  )}

                  <div style={{ borderTop: '1px solid rgba(10,126,140,0.12)', marginTop: 4 }}>
                    <button
                      type="button" onClick={openTaskAdd}
                      className="flex items-center gap-3 w-full bg-transparent border-0 text-left cursor-pointer"
                      style={{ padding: '12px 0' }}
                    >
                      <div className="rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ width: 40, height: 40, background: 'rgba(61,199,166,0.08)', border: '1.5px dashed rgba(61,199,166,0.5)' }}>
                        <IconAddTask />
                      </div>
                      <span className="font-bold text-[#0A7E8C]" style={{ fontSize: '0.875rem' }}>
                        Agregar tarea
                      </span>
                    </button>
                  </div>
                </Card>
                <div style={{ marginTop: 12, textAlign: 'right' }}>
                  <Link
                    href="/gestion/finalizadas"
                    style={{
                      fontSize: '0.75rem', fontWeight: 600,
                      color: '#5a7478', textDecoration: 'none',
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#0A7E8C' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#5a7478' }}
                  >
                    Ver tareas finalizadas →
                  </Link>
                </div>
              </div>

              {/* ── Col 2: Documentos ──────────────────────────────────────── */}
              <div>
                <SectionTitle>Documentos</SectionTitle>
                <Card>
                  {docs.length > 0 ? (
                    <div className="flex flex-col" style={{ gap: 10 }}>
                      {docs.map((d) => {
                        const uploaderLabel = d.uploaded_by_user
                          ? 'Cargado por vos'
                          : d.uploaded_by_contact_id
                            ? `Cargado por ${contactById.get(d.uploaded_by_contact_id)?.name ?? '—'}`
                            : ''
                        return (
                          <div key={d.id} className="flex items-center cursor-pointer"
                            onClick={() => openDocView(d)}
                            style={{ gap: 12, padding: '10px 12px', background: 'rgba(10,126,140,0.04)', borderRadius: '0.6rem', transition: 'background 0.15s' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(61,199,166,0.07)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(10,126,140,0.04)' }}
                          >
                            <div className="rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)' }}>
                              <IconDoc />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-[#1A1A2E] truncate" style={{ fontSize: '0.875rem' }}>
                                {d.name}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: '#5a7478', marginTop: 2 }}>
                                {[DOC_TYPE_LABELS[d.type ?? ''], fmtShortDate(d.created_at), uploaderLabel].filter(Boolean).join(' · ')}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-[#5a7478] text-center" style={{ fontSize: '0.875rem', padding: '24px 0' }}>
                      Sin documentos cargados
                    </p>
                  )}
                  <div style={{ borderTop: '1px solid rgba(10,126,140,0.12)', marginTop: 4 }}>
                    <button type="button" onClick={openDocAdd}
                      className="flex items-center gap-3 w-full bg-transparent border-0 text-left cursor-pointer"
                      style={{ padding: '12px 0' }}>
                      <div className="rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ width: 40, height: 40, background: 'rgba(61,199,166,0.08)', border: '1.5px dashed rgba(61,199,166,0.5)' }}>
                        <IconUpload />
                      </div>
                      <span className="font-bold text-[#0A7E8C]" style={{ fontSize: '0.875rem' }}>Agregar documento</span>
                    </button>
                  </div>
                </Card>
              </div>

            </div>
          )}

          {/* ── Loading skeleton ─────────────────────────────────────── */}
          {loading && !crisis && (
            <div>
              {/* Header skeleton */}
              <div className="mb-10">
                <SkeletonText width="25%" style={{ height: 32, marginBottom: 10 }} />
                <SkeletonText width="45%" />
              </div>

              {/* 2-col grid skeleton */}
              <div className="gestion-grid grid items-start" style={{ gap: 24, gridTemplateColumns: '1fr' }}>
                {/* Tasks col */}
                <SkeletonCard>
                  <SkeletonText width="40%" style={{ marginBottom: 16 }} />
                  {[75, 55, 85, 65].map((w, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 py-3"
                      style={{ borderBottom: i < 3 ? '1px solid rgba(10,126,140,0.08)' : 'none' }}>
                      <SkeletonText width={`${w}%`} />
                      <SkeletonAvatar size={24} />
                    </div>
                  ))}
                </SkeletonCard>

                {/* Docs col */}
                <SkeletonCard>
                  <SkeletonText width="40%" style={{ marginBottom: 16 }} />
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3 py-2.5"
                      style={{ borderBottom: i < 2 ? '1px solid rgba(10,126,140,0.08)' : 'none' }}>
                      <SkeletonBase width={36} height={36} style={{ borderRadius: '0.5rem', flexShrink: 0 }} />
                      <div className="flex-1 flex flex-col gap-1.5">
                        <SkeletonText width="70%" />
                        <SkeletonText width="45%" />
                      </div>
                    </div>
                  ))}
                </SkeletonCard>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          DOC PREVIEW MODAL
      ══════════════════════════════════════════════════════════════════════ */}
      {docModalOpen && ssDoc && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => { setDocModalOpen(false); setDocModalUrl(null) }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 300 }}
          />

          {/* Modal */}
          <div
            style={{
              position: 'fixed', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 301, width: 'min(92vw, 860px)', maxHeight: '90vh',
              background: '#fff', borderRadius: '1.25rem',
              boxShadow: '0 24px 80px rgba(0,0,0,0.30)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: '1px solid rgba(10,126,140,0.12)', flexShrink: 0,
            }}>
              <span style={{
                fontSize: '0.875rem', fontWeight: 700, color: '#1A1A2E',
                maxWidth: 'calc(100% - 40px)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {ssDoc.name}
              </span>
              <button
                onClick={() => { setDocModalOpen(false); setDocModalUrl(null) }}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.11)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)' }}
              >
                <IconClose />
              </button>
            </div>

            <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
              {docModalUrl ? (
                (() => {
                  const mime = ssDoc.file_mime_type ?? ''
                  if (mime.startsWith('image/')) {
                    return (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={docModalUrl} alt={ssDoc.name}
                        style={{ display: 'block', maxWidth: '100%', maxHeight: '70vh', margin: 'auto', objectFit: 'contain', padding: 16 }}
                      />
                    )
                  }
                  if (mime === 'application/pdf' || mime === '') {
                    return (
                      <iframe src={docModalUrl} title={ssDoc.name}
                        style={{ width: '100%', height: '70vh', border: 'none', display: 'block' }}
                      />
                    )
                  }
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 220, gap: 12 }}>
                      <span style={{ fontSize: '2.5rem' }}>📄</span>
                      <p style={{ fontSize: '0.875rem', color: '#5a7478', textAlign: 'center', padding: '0 24px' }}>
                        No se puede previsualizar este tipo de archivo.<br />
                        Usá el botón de descarga para abrirlo.
                      </p>
                    </div>
                  )
                })()
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#5a7478', fontSize: '0.875rem' }}>
                  Cargando…
                </div>
              )}
            </div>

            <div style={{
              display: 'flex', gap: 8, padding: '14px 20px',
              borderTop: '1px solid rgba(10,126,140,0.12)',
              flexShrink: 0, justifyContent: 'flex-end',
            }}>
              <button
                onClick={() => handleDocDownload(docModalUrl ?? undefined)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 22px', borderRadius: 9999,
                  border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.875rem',
                  background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                  color: 'white', transition: 'filter 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.08)' }}
                onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)' }}
              >
                <IconDownload />
                Descargar
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
