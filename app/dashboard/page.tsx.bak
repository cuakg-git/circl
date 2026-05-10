'use client'

import { useEffect, useState, use, useCallback, useRef } from 'react'
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

const DOC_TYPE_LABELS: Record<string, string> = {
  estudio_medico: 'Estudio médico',
  receta:         'Receta',
  informe:        'Informe',
  otros:          'Otros',
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function IconChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

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

export default function CrisisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router  = useRouter()

  // ── Page data state ──────────────────────────────────────────────────────────
  const [crisis,   setCrisis]   = useState<Crisis | null>(null)
  const [tasks,    setTasks]    = useState<Task[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [docs,     setDocs]     = useState<Doc[]>([])
  const [history,  setHistory]  = useState<HistoryEvent[]>([])
  const [loading,  setLoading]  = useState(true)

  // ── Sidesheet state ──────────────────────────────────────────────────────────
  const [ssMode,    setSsMode]    = useState<SSMode>(null)
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

      const [crisisRes, tasksRes, contactsRes, docsRes, historyRes] = await Promise.all([
        supabase
          .from('crises')
          .select('id, name, status, category, started_at, ai_summary')
          .eq('id', id).eq('user_id', user.id).maybeSingle(),
        supabase
          .from('tasks')
          .select('id, title, status, due_date, assigned_contact_id, assigned_to_user')
          .eq('crisis_id', id).order('due_date', { ascending: true, nullsFirst: false }),
        supabase
          .from('crisis_contacts')
          .select('contact:contacts(id, name, role, proximity, initials, phone, email, relationship)')
          .eq('crisis_id', id),
        supabase
          .from('documents')
          .select('id, name, type, created_at, storage_path, original_filename, file_size_bytes, file_mime_type, uploaded_by_user, uploaded_by_contact_id')
          .eq('crisis_id', id).order('created_at', { ascending: false }),
        supabase
          .from('crisis_history')
          .select('id, title, description, occurred_at')
          .eq('crisis_id', id).order('occurred_at', { ascending: false }),
      ])

      if (crisisRes.error) console.error('Error crisis:', crisisRes.error)
      if (!crisisRes.data) { router.replace('/crisis'); return }
      setCrisis(crisisRes.data)

      if (tasksRes.error) console.error('Error tasks:', tasksRes.error)
      setTasks((tasksRes.data ?? []) as Task[])

      if (contactsRes.error) console.error('Error contacts:', contactsRes.error)
      // crisis_contacts may have duplicate rows for the same contact_id;
      // dedupe by contact id before storing
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

      setLoading(false)
    }
    load()
  }, [id, router])

  // ── Task reload (no full page refresh) ───────────────────────────────────────

  const reloadTasks = useCallback(async () => {
    const { data } = await supabase
      .from('tasks')
      .select('id, title, status, due_date, assigned_contact_id, assigned_to_user')
      .eq('crisis_id', id)
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

  const reloadDocs = useCallback(async () => {
    const { data } = await supabase
      .from('documents')
      .select('id, name, type, created_at, storage_path, original_filename, file_size_bytes, file_mime_type, uploaded_by_user, uploaded_by_contact_id')
      .eq('crisis_id', id)
      .order('created_at', { ascending: false })
    if (data) setDocs(data as Doc[])
  }, [id])

  // Best-effort write to crisis_history; never blocks the UI on failure
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

  // ── Task view actions ─────────────────────────────────────────────────────────

  async function handleAssigneeChange(val: string) {
    if (!ssTask) return
    setTvAssignee(val)
    const fields = decodeAssignee(val)
    const { error } = await supabase.from('tasks').update(fields).eq('id', ssTask.id)
    if (error) { setSsError(error.message); return }
    await reloadTasks()

    // Log only when assigning to someone (not when clearing the assignee)
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
    await reloadTasks()
    if (newStatus === 'completada') {
      await logHistory('Tarea completada', ssTask.title, 'tarea_completada')
    }
    closeSheet()
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
    // Reuse the thumb URL already fetched on open (avoids a second round-trip)
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
        .crisis-detail-bg { animation: heroBgDrift 30s ease-in-out infinite; }
      `}</style>

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
            {ssMode === 'task-view'   ? 'Tarea'
             : ssMode === 'task-add'  ? 'Nueva tarea'
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
                  {/* Asignado a */}
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
                  {/* Fecha */}
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
                </Card>
              </div>

              {/* Error inline */}
              {ssError && (
                <p style={{
                  fontSize: '0.7rem', color: '#ba1a1a', fontWeight: 600,
                  marginBottom: 16, padding: '10px 14px',
                  background: 'rgba(186,26,26,0.06)', borderRadius: '0.6rem',
                }}>
                  {ssError}
                </p>
              )}

              {/* Toggle status */}
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
                  {ssLoading ? 'Procesando…'
                    : isDone ? 'Reabrir tarea' : 'Marcar como completada'}
                </button>
              </div>

              {/* Acciones / Eliminar */}
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
            {/* Hero */}
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
              <div style={{
                fontSize: '1.5rem', fontWeight: 800,
                letterSpacing: '-0.02em', color: '#1A1A2E',
              }}>
                Nueva tarea
              </div>
            </div>

            <form onSubmit={handleAddTask}>
              <p style={{
                fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
              }}>Datos</p>
              <Card style={{ padding: 0, borderRadius: '1rem', marginBottom: 24 }}>
                {/* Tarea */}
                <div style={{
                  display: 'flex', alignItems: 'center',
                  padding: '13px 20px', borderBottom: '1px solid rgba(10,126,140,0.12)', gap: 12,
                }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                    textTransform: 'uppercase', color: '#5a7478', minWidth: 80,
                  }}>Tarea</span>
                  <input
                    type="text"
                    required
                    placeholder="Describí la tarea…"
                    value={addTitle}
                    onChange={(e) => setAddTitle(e.target.value)}
                    style={{ ...SS_INPUT_STYLE }}
                  />
                </div>
                {/* Fecha */}
                <div style={{
                  display: 'flex', alignItems: 'center',
                  padding: '13px 20px', borderBottom: '1px solid rgba(10,126,140,0.12)', gap: 12,
                }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                    textTransform: 'uppercase', color: '#5a7478', minWidth: 80,
                  }}>Fecha</span>
                  <input
                    type="date"
                    value={addDate}
                    onChange={(e) => setAddDate(e.target.value)}
                    style={{
                      ...SS_INPUT_STYLE,
                      fontWeight: 400,
                      colorScheme: 'light',
                    }}
                  />
                </div>
                {/* Horario */}
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
                      type="text"
                      placeholder="HH:MM"
                      value={addTime}
                      onChange={(e) => { setAddTime(e.target.value); setTimeOpen(true) }}
                      onFocus={() => setTimeOpen(true)}
                      onBlur={() => setTimeout(() => setTimeOpen(false), 150)}
                      style={{ ...SS_INPUT_STYLE, fontWeight: 400 }}
                    />
                    {timeOpen && (
                      <div style={{
                        position:    'absolute',
                        top:         'calc(100% + 6px)',
                        left:        -20,
                        right:       -20,
                        maxHeight:   220,
                        overflowY:   'auto',
                        background:  '#FFFFFF',
                        borderRadius: '1rem',
                        boxShadow:   '0 8px 32px rgba(10,126,140,0.18)',
                        border:      '1px solid rgba(10,126,140,0.10)',
                        zIndex:      400,
                      }}>
                        {TIME_OPTIONS
                          .filter(t => !addTime || t.startsWith(addTime))
                          .map((t, i, arr) => (
                            <div
                              key={t}
                              onMouseDown={() => { setAddTime(t); setTimeOpen(false) }}
                              style={{
                                padding:      '10px 20px',
                                fontSize:     '0.875rem',
                                fontWeight:   addTime === t ? 700 : 400,
                                color:        addTime === t ? '#0A7E8C' : '#1A1A2E',
                                background:   addTime === t ? 'rgba(10,126,140,0.07)' : 'transparent',
                                cursor:       'pointer',
                                borderBottom: i < arr.length - 1 ? '1px solid rgba(10,126,140,0.06)' : 'none',
                                transition:   'background 0.1s',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(61,199,166,0.10)' }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = addTime === t
                                  ? 'rgba(10,126,140,0.07)' : 'transparent'
                              }}
                            >
                              {t}
                            </div>
                          ))
                        }
                        {TIME_OPTIONS.filter(t => !addTime || t.startsWith(addTime)).length === 0 && (
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
                  padding: '13px 20px', gap: 12,
                }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                    textTransform: 'uppercase', color: '#5a7478', minWidth: 80,
                  }}>Asignado</span>
                  <select
                    value={addAssignee}
                    onChange={(e) => setAddAssignee(e.target.value)}
                    style={SS_SELECT_STYLE}
                  >
                    <option value="">— Sin asignar —</option>
                    <option value="yo">Yo</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={`c:${c.id}`}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </Card>

              {/* Error inline */}
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
                type="submit"
                disabled={ssLoading || !addTitle.trim()}
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
              {/* Hero */}
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
                  boxShadow: '0 8px 40px rgba(10,126,140,0.16)',
                  marginBottom: 14,
                }}>
                  {initials}
                </div>
                <div style={{
                  fontSize: '1.5rem', fontWeight: 800,
                  letterSpacing: '-0.02em', marginBottom: 8, color: '#1A1A2E',
                }}>
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

              {/* Datos de contacto */}
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

              {/* Rol y cercanía */}
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
                      value={mvRole}
                      onChange={(e) => handleRoleChange(e.target.value)}
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
                      value={mvProximity}
                      onChange={(e) => handleProximityChange(e.target.value)}
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

              {/* Error inline */}
              {ssError && (
                <p style={{
                  fontSize: '0.7rem', color: '#ba1a1a', fontWeight: 600,
                  marginBottom: 16, padding: '10px 14px',
                  background: 'rgba(186,26,26,0.06)', borderRadius: '0.6rem',
                }}>
                  {ssError}
                </p>
              )}

              {/* Acciones */}
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
                      onClick={handleRemoveMember}
                      disabled={ssLoading}
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
            {/* Hero */}
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
              <div style={{
                fontSize: '1.5rem', fontWeight: 800,
                letterSpacing: '-0.02em', color: '#1A1A2E',
              }}>
                Agregar al círculo
              </div>
            </div>

            {/* Error inline */}
            {ssError && (
              <p style={{
                fontSize: '0.7rem', color: '#ba1a1a', fontWeight: 600,
                marginBottom: 16, padding: '10px 14px',
                background: 'rgba(186,26,26,0.06)', borderRadius: '0.6rem',
              }}>
                {ssError}
              </p>
            )}

            {/* Loading state */}
            {availableLoading && (
              <p className="text-center" style={{ fontSize: '0.875rem', color: '#5a7478', padding: '24px 0' }}>
                Cargando contactos…
              </p>
            )}

            {/* Empty state */}
            {!availableLoading && availableContacts.length === 0 && (
              <Card style={{ padding: 24, textAlign: 'center' }}>
                <p style={{ fontSize: '0.875rem', color: '#5a7478', lineHeight: 1.6 }}>
                  Todos tus contactos ya están en esta crisis.<br />
                  Podés agregar nuevos hablando con el agente.
                </p>
              </Card>
            )}

            {/* Available contacts list */}
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
                        key={c.id}
                        type="button"
                        onClick={() => handleAddMember(c)}
                        disabled={ssLoading}
                        className="flex items-center w-full text-left"
                        style={{
                          gap: 12, padding: '14px 20px',
                          borderBottom: i < availableContacts.length - 1 ? '1px solid rgba(10,126,140,0.12)' : 'none',
                          background: 'transparent', border: 'none',
                          cursor: ssLoading ? 'not-allowed' : 'pointer',
                          opacity: ssLoading ? 0.6 : 1,
                          transition: 'background 0.15s',
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
              {/* Hero */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                textAlign: 'center', padding: '24px 0 20px',
                borderBottom: '1px solid rgba(10,126,140,0.12)', marginBottom: 24,
              }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 8px 40px rgba(10,126,140,0.16)',
                  marginBottom: 14,
                }}>
                  <IconDoc />
                </div>
                <div style={{
                  fontSize: '1.5rem', fontWeight: 800,
                  letterSpacing: '-0.02em', marginBottom: 8, color: '#1A1A2E',
                }}>
                  {ssDoc.name}
                </div>
                <span style={{ fontSize: '0.7rem', color: '#5a7478' }}>
                  {DOC_TYPE_LABELS[ssDoc.type ?? ''] ?? 'Documento'} · {fmtLongDate(ssDoc.created_at)}
                </span>
              </div>

              {/* Información */}
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

              {/* Error */}
              {ssError && (
                <p style={{
                  fontSize: '0.7rem', color: '#ba1a1a', fontWeight: 600,
                  marginBottom: 16, padding: '10px 14px',
                  background: 'rgba(186,26,26,0.06)', borderRadius: '0.6rem',
                }}>
                  {ssError}
                </p>
              )}

              {/* Descargar */}
              <div style={{ marginBottom: 12 }}>
                <button
                  onClick={() => handleDocDownload()}
                  disabled={ssLoading}
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

              {/* Preview thumbnail or Ver button */}
              {(() => {
                const mime = ssDoc.file_mime_type ?? ''
                const isPreviewable = mime.startsWith('image/') || mime === 'application/pdf'
                if (!isPreviewable) {
                  return (
                    <div style={{ marginBottom: 24 }}>
                      <button
                        onClick={handleDocOpen}
                        disabled={docModalLoading || ssLoading}
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
                    {/* Clickable thumbnail */}
                    <div
                      onClick={handleDocOpen}
                      role="button"
                      tabIndex={0}
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
                          <img
                            src={docThumbUrl}
                            alt={ssDoc.name}
                            style={{
                              width: '100%', height: '100%',
                              objectFit: 'cover', display: 'block',
                              pointerEvents: 'none',
                            }}
                          />
                        ) : (
                          /* PDF: render first page via iframe, block all iframe interactions */
                          <>
                            <iframe
                              src={`${docThumbUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                              title="preview"
                              style={{
                                width: '100%', height: '100%',
                                border: 'none', display: 'block',
                                pointerEvents: 'none',
                              }}
                            />
                            {/* Transparent click-through overlay so the div captures the click */}
                            <div style={{ position: 'absolute', inset: 0 }} />
                          </>
                        )
                      ) : (
                        /* Still loading thumb */
                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          height: '100%', color: '#5a7478', fontSize: '0.8rem',
                        }}>
                          Cargando vista previa…
                        </div>
                      )}

                      {/* "Ver" badge overlay */}
                      <div style={{
                        position: 'absolute', bottom: 10, right: 10,
                        background: 'rgba(10,126,140,0.82)',
                        backdropFilter: 'blur(6px)',
                        borderRadius: 9999, padding: '4px 12px',
                        fontSize: '0.75rem', fontWeight: 700, color: 'white',
                        pointerEvents: 'none',
                      }}>
                        Ver
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Eliminar */}
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
                      onClick={handleDocDelete}
                      disabled={ssLoading}
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
            {/* Hero */}
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
              <div style={{
                fontSize: '1.5rem', fontWeight: 800,
                letterSpacing: '-0.02em', color: '#1A1A2E',
              }}>
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
                    type="text"
                    required
                    placeholder="Nombre del documento…"
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    style={{ ...SS_INPUT_STYLE }}
                  />
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center',
                  padding: '13px 20px', gap: 12,
                }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                    textTransform: 'uppercase', color: '#5a7478', minWidth: 80,
                  }}>Tipo</span>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    style={SS_SELECT_STYLE}
                  >
                    {Object.entries(DOC_TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
              </Card>

              {/* Drop zone */}
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
                  ref={fileInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  accept=".pdf,image/*,.doc,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileSelect(file)
                  }}
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

              {/* Error */}
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
                type="submit"
                disabled={ssLoading || !docName.trim() || !docFile}
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

      <div className="crisis-detail-bg flex min-h-screen">
        <Sidebar />

        <main className="flex-1 ml-0 md:ml-[240px] min-h-screen px-5 py-8 pb-28 md:px-10 md:py-10 md:pb-10">
          <SkeletonStyles />

          {/* Back link */}
          <Link
            href="/crisis"
            className="inline-flex items-center gap-1.5 font-semibold text-[#5a7478] no-underline hover:text-[#0A7E8C] transition-colors"
            style={{ fontSize: '0.875rem', marginBottom: 24 }}
          >
            <IconChevronLeft /> Volver a Crisis
          </Link>

          {/* Header */}
          {crisis && (
            <div className="flex items-start justify-between flex-wrap"
              style={{ gap: 12, marginBottom: 40 }}>
              <div>
                <h1 className="font-extrabold text-[#1A1A2E]"
                  style={{ fontSize: '2rem', letterSpacing: '-0.03em', marginBottom: 8, lineHeight: 1.15 }}>
                  {crisis.name}
                </h1>
                <div className="flex items-center flex-wrap" style={{ gap: 10 }}>
                  {crisis.status === 'activa' ? (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', borderRadius: 9999,
                      padding: '3px 11px', fontSize: '0.7rem', fontWeight: 700,
                      letterSpacing: '0.05em', textTransform: 'uppercase',
                      background: 'rgba(46,205,167,0.14)', color: '#0a6e5a',
                    }}>Activa</span>
                  ) : (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', borderRadius: 9999,
                      padding: '3px 11px', fontSize: '0.7rem', fontWeight: 700,
                      letterSpacing: '0.05em', textTransform: 'uppercase',
                      background: 'rgba(90,116,120,0.10)', color: '#5a7478',
                    }}>Resuelta</span>
                  )}
                  <span className="text-[#5a7478]" style={{ fontSize: '0.7rem' }}>
                    Desde el {fmtLongDate(crisis.started_at)} · {daysSince(crisis.started_at)} días
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Contexto */}
          {crisis?.ai_summary && (
            <div style={{ marginBottom: 40 }}>
              <SectionTitle>Contexto</SectionTitle>
              <Card>
                <p className="text-[#5a7478]" style={{ fontSize: '0.875rem', lineHeight: 1.75 }}>
                  {crisis.ai_summary}
                </p>
              </Card>
            </div>
          )}

          {/* 3-col grid */}
          <style>{`
            @media (min-width: 581px) and (max-width: 860px) {
              .crisis-grid { grid-template-columns: 1fr 1fr !important; }
              .crisis-grid-full { grid-column: 1 / -1 !important; }
            }
            @media (min-width: 861px) {
              .crisis-grid { grid-template-columns: repeat(3, 1fr) !important; }
              .crisis-grid-full { grid-column: 1 / -1 !important; }
            }
          `}</style>

          <div className="crisis-grid grid items-start" style={{ gap: 24, gridTemplateColumns: '1fr' }}>

            {/* ── Col 1: Tareas ───────────────────────────────────────── */}
            <div>
              <SectionTitle>Tareas</SectionTitle>
              <Card>
                {tasks.length > 0 ? (
                  <div className="flex flex-col">
                    {tasks.map((t, i) => {
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
                          onClick={() => openTaskView(t)}
                          style={{
                            gap: 14, padding: '13px 6px',
                            borderBottom: i < tasks.length - 1 ? '1px solid rgba(10,126,140,0.12)' : 'none',
                            margin: '0 -6px',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(61,199,166,0.07)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                        >
                          <div className="flex-1 min-w-0">
                            <div style={{
                              fontSize: '0.875rem',
                              textDecoration: isDone ? 'line-through' : 'none',
                              color: isDone ? '#5a7478' : '#1A1A2E',
                              fontWeight: isDone ? 400 : 600,
                            }}>
                              {t.title}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#5a7478', marginTop: 2 }}>
                              {t.due_date ? `Vence el ${fmtLongDate(t.due_date)}` : 'Sin fecha'}
                            </div>
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
                    type="button"
                    onClick={openTaskAdd}
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
            </div>

            {/* ── Col 2: Círculo activo ────────────────────────────────── */}
            <div>
              <SectionTitle>Círculo activo</SectionTitle>
              <Card style={{ padding: '40px 24px' }}>
                {contacts.length > 0 ? (
                  <div className="flex flex-col w-full">
                    {contacts.map((p, i) => {
                      const initials = (p.initials ?? getInitials(p.name)).slice(0, 2)
                      const badge = ROLE_BADGES[p.role ?? ''] ?? null
                      return (
                        <div key={p.id} className="flex items-center cursor-pointer rounded-md"
                          onClick={() => openMemberView(p)}
                          style={{
                            gap: 10, padding: '8px 6px', fontSize: '0.7rem',
                            borderBottom: i < contacts.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                            margin: '0 -6px',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(61,199,166,0.07)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                        >
                          <div className="rounded-full flex items-center justify-center flex-shrink-0 text-white"
                            style={{ width: 32, height: 32, fontSize: '0.7rem', fontWeight: 700, background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)' }}>
                            {initials}
                          </div>
                          <span className="flex-1 font-extrabold text-[#1A1A2E] truncate" style={{ fontSize: 13 }}>
                            {p.name}
                          </span>
                          {badge && (
                            <span className="inline-flex items-center font-bold uppercase whitespace-nowrap"
                              style={{
                                background: badge.bg, color: badge.color, borderRadius: 9999,
                                padding: '3px 11px', fontSize: '0.7rem', letterSpacing: '0.05em',
                              }}>
                              {badge.label}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-[#5a7478] text-center" style={{ fontSize: '0.875rem' }}>
                    Sin personas asignadas a esta crisis
                  </p>
                )}
                <div style={{ borderTop: '1px solid rgba(10,126,140,0.12)', marginTop: 12, width: '100%' }}>
                  <button
                    type="button"
                    onClick={openMemberAdd}
                    className="flex items-center gap-3 w-full bg-transparent border-0 text-left cursor-pointer"
                    style={{ padding: '12px 0' }}>
                    <div className="rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ width: 40, height: 40, background: 'rgba(61,199,166,0.08)', border: '1.5px dashed rgba(61,199,166,0.5)' }}>
                      <IconAddPerson />
                    </div>
                    <span className="font-bold text-[#0A7E8C]" style={{ fontSize: '0.875rem' }}>Agregar persona</span>
                  </button>
                </div>
              </Card>
            </div>

            {/* ── Col 3: Documentos ──────────────────────────────────────── */}
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
                  <button type="button"
                    onClick={openDocAdd}
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

            {/* ── Full row: Historia ─────────────────────────────────────── */}
            <div className="crisis-grid-full">
              <SectionTitle>Historia</SectionTitle>
              <Card>
                {history.length > 0 ? (
                  <div className="flex flex-col">
                    {history.map((h, i) => {
                      const isLast = i === history.length - 1
                      return (
                        <div key={h.id} className="flex"
                          style={{ gap: 16, paddingBottom: 28, position: 'relative' }}>
                          {!isLast && (
                            <div style={{
                              position: 'absolute', left: 15, top: 34, bottom: 0,
                              width: 2, background: 'rgba(10,126,140,0.12)',
                            }} />
                          )}
                          <div className="rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ width: 32, height: 32, background: '#FFFFFF', border: '2px solid #0A7E8C', position: 'relative', zIndex: 1 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#0A7E8C' }} />
                          </div>
                          <div className="flex-1" style={{ paddingTop: 4 }}>
                            <div style={{ fontSize: '0.7rem', color: '#5a7478', marginBottom: 3 }}>
                              {fmtLongDate(h.occurred_at)}
                            </div>
                            <div className="font-bold text-[#1A1A2E]" style={{ fontSize: '0.875rem', marginBottom: 3 }}>
                              {h.title}
                            </div>
                            {h.description && (
                              <div style={{ fontSize: '0.875rem', color: '#5a7478', lineHeight: 1.5 }}>
                                {h.description}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-[#5a7478] text-center" style={{ fontSize: '0.875rem', padding: '24px 0' }}>
                    Sin eventos en la historia todavía
                  </p>
                )}
              </Card>
            </div>

          </div>

          {/* ── Loading skeleton ─────────────────────────────────────── */}
          {loading && !crisis && (
            <div>
              {/* Header skeleton */}
              <div className="mb-10">
                <SkeletonText width="55%" style={{ height: 32, marginBottom: 16 }} />
                <div className="flex items-center gap-3">
                  <SkeletonBase width={52} height={22} style={{ borderRadius: 9999 }} />
                  <SkeletonText width={180} />
                </div>
              </div>

              {/* Context card skeleton */}
              <div className="mb-10">
                <SkeletonCard>
                  <div className="flex flex-col gap-3">
                    <SkeletonText width="90%" />
                    <SkeletonText width="80%" />
                    <SkeletonText width="60%" />
                  </div>
                </SkeletonCard>
              </div>

              {/* 3-col grid skeleton */}
              <div className="crisis-grid grid items-start" style={{ gap: 24, gridTemplateColumns: '1fr' }}>
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

                {/* Circle col */}
                <SkeletonCard>
                  <SkeletonText width="40%" style={{ marginBottom: 16 }} />
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 py-3"
                      style={{ borderBottom: i < 3 ? '1px solid rgba(10,126,140,0.08)' : 'none' }}>
                      <SkeletonAvatar size={32} />
                      <SkeletonText width="60%" />
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

                {/* History row */}
                <SkeletonCard className="crisis-grid-full">
                  <SkeletonText width="30%" style={{ marginBottom: 16 }} />
                  <div className="flex gap-6">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="flex items-start gap-2 flex-1">
                        <SkeletonAvatar size={10} />
                        <div className="flex-1 flex flex-col gap-1.5">
                          <SkeletonText width="80%" />
                          <SkeletonText width="55%" />
                        </div>
                      </div>
                    ))}
                  </div>
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
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.72)',
              zIndex: 300,
            }}
          />

          {/* Modal */}
          <div
            style={{
              position: 'fixed',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 301,
              width: 'min(92vw, 860px)',
              maxHeight: '90vh',
              background: '#fff',
              borderRadius: '1.25rem',
              boxShadow: '0 24px 80px rgba(0,0,0,0.30)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Modal header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid rgba(10,126,140,0.12)',
              flexShrink: 0,
            }}>
              <span style={{
                fontSize: '0.875rem', fontWeight: 700,
                color: '#1A1A2E', maxWidth: 'calc(100% - 40px)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
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

            {/* Preview area */}
            <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
              {docModalUrl ? (
                (() => {
                  const mime = ssDoc.file_mime_type ?? ''
                  if (mime.startsWith('image/')) {
                    return (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={docModalUrl}
                        alt={ssDoc.name}
                        style={{
                          display: 'block', maxWidth: '100%', maxHeight: '70vh',
                          margin: 'auto', objectFit: 'contain', padding: 16,
                        }}
                      />
                    )
                  }
                  if (mime === 'application/pdf' || mime === '') {
                    return (
                      <iframe
                        src={docModalUrl}
                        title={ssDoc.name}
                        style={{ width: '100%', height: '70vh', border: 'none', display: 'block' }}
                      />
                    )
                  }
                  // Unsupported MIME — show fallback
                  return (
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', height: 220, gap: 12,
                    }}>
                      <span style={{ fontSize: '2.5rem' }}>📄</span>
                      <p style={{ fontSize: '0.875rem', color: '#5a7478', textAlign: 'center', padding: '0 24px' }}>
                        No se puede previsualizar este tipo de archivo.<br />
                        Usá el botón de descarga para abrirlo.
                      </p>
                    </div>
                  )
                })()
              ) : (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: 200, color: '#5a7478', fontSize: '0.875rem',
                }}>
                  Cargando…
                </div>
              )}
            </div>

            {/* Modal footer */}
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
                  border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: '0.875rem',
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
