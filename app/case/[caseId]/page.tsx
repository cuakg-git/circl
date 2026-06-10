'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import {
  SkeletonStyles, SkeletonText, SkeletonAvatar,
  SkeletonCard, SkeletonBase,
} from '@/components/Skeleton'
import ContextStripDrawer from '@/components/ContextStripDrawer'

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
  label_id:            string | null
}

type TaskDocCount = {
  task_id: string
  count:   number
}

type Topic = {
  id:      string
  name:    string
  color:   string | null
  case_id: string
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
  id:           string
  title:        string
  description:  string | null
  occurred_at:  string
  task_id?:     string | null
  document_id?: string | null
}

// Sidesheet modes
type SSMode = 'member-view' | 'member-add' | null

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
  nucleo:        'Es parte de mi núcleo',
  segundo_nivel: 'Segundo nivel de cercanía',
  tercer_nivel:  'Tercer nivel de cercanía',
  prestador:     'Es un proveedor de servicios o un profesional',
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

export default function GestionPage() {
  const [id, setId] = useState<string | null>(null)
  const router  = useRouter()

  // ── Page data state ──────────────────────────────────────────────────────────
  const [crisis,      setCrisis]      = useState<Crisis | null>(null)
  const [tasks,       setTasks]       = useState<Task[]>([])
  const [contacts,    setContacts]    = useState<Contact[]>([])
  const [allContacts, setAllContacts] = useState<Contact[]>([])
  const [docs,        setDocs]        = useState<Doc[]>([])
  const [history,     setHistory]     = useState<HistoryEvent[]>([])
  const [loading,     setLoading]     = useState(true)

  const [labels, setLabels] = useState<Topic[]>([])
  const [taskDocCounts, setTaskDocCounts] = useState<Map<string, number>>(new Map())

  // ── Contexto ─────────────────────────────────────────────────────────────────
  const [aiSummary, setAiSummary] = useState('')
  const [isTyping,  setIsTyping]  = useState(false)

  // ── Participantes ─────────────────────────────────────────────────────────────
  const [caseContacts, setCaseContacts] = useState<{
    id: string; name: string; role: string;
    proximity: string; initials: string | null
  }[]>([])

  // ── Close/reopen case ────────────────────────────────────────────────────────
  const [closeModalOpen, setCloseModalOpen] = useState(false)
  const [closingLoading, setClosingLoading] = useState(false)
  const [closeError,     setCloseError]     = useState<string | null>(null)

  // ── Sidesheet historia ─────────────────────────────────────────────────────
  const [historySheetOpen,   setHistorySheetOpen]   = useState(false)
  const [doneTasksSheetOpen, setDoneTasksSheetOpen] = useState(false)

  // ── Sidesheet state ──────────────────────────────────────────────────────────
  const [ssMode,    setSsMode]    = useState<SSMode>(null)
  const [ssLoading, setSsLoading] = useState(false)
  const [ssError,   setSsError]   = useState<string | null>(null)

  // Member sidesheet state
  const [ssMember,    setSsMember]    = useState<Contact | null>(null)
  const [mvRole,      setMvRole]      = useState('')
  const [mvProximity, setMvProximity] = useState('')
  const [availableContacts, setAvailableContacts] = useState<Contact[]>([])
  const [availableLoading,  setAvailableLoading]  = useState(false)

  // ── Load data ────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) { router.replace('/login'); return }

      const { data: activeCrisis, error: activeCrisisError } = await supabase
        .from('cases')
        .select('id')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (activeCrisisError || !activeCrisis) {
        setLoading(false)
        return
      }

      setId(activeCrisis.id)
      const currentId = activeCrisis.id

      const [crisisRes, tasksRes, contactsRes, docsRes, historyRes, labelsRes, allContactsRes, caseContactsRes] = await Promise.all([
        supabase
          .from('cases')
          .select('id, name, status, category, started_at, ai_summary')
          .eq('id', currentId).eq('user_id', user.id).maybeSingle(),
        supabase
          .from('tasks')
          .select('id, title, status, due_date, assigned_contact_id, assigned_to_user, label_id')
          .eq('case_id', currentId).order('due_date', { ascending: true, nullsFirst: false }),
        supabase
          .from('case_contacts')
          .select('contact:contacts(id, name, role, proximity, initials, phone, email, relationship)')
          .eq('case_id', currentId),
        supabase
          .from('documents')
          .select('id, name, type, created_at, storage_path, original_filename, file_size_bytes, file_mime_type, uploaded_by_user, uploaded_by_contact_id')
          .eq('case_id', currentId).order('created_at', { ascending: false }),
        supabase
          .from('case_history')
          .select('id, title, description, occurred_at, task_id, document_id')
          .eq('case_id', currentId).order('occurred_at', { ascending: false }),
        supabase
          .from('labels')
          .select('id, name, color, case_id')
          .eq('case_id', currentId)
          .order('created_at', { ascending: true }),
        supabase
          .from('contacts')
          .select('id, name, role, proximity, initials, phone, email, relationship')
          .eq('user_id', user.id)
          .in('proximity', ['nucleo', 'segundo_nivel', 'tercer_nivel'])
          .order('sort_order', { ascending: true, nullsFirst: false }),
        supabase
          .from('case_contacts')
          .select('contact:contacts(id, name, role, proximity, initials)')
          .eq('case_id', currentId),
      ])

      if (crisisRes.error) console.error('Error crisis:', crisisRes.error)
      if (!crisisRes.data) { router.replace('/case'); return }
      setCrisis(crisisRes.data)
      setAiSummary(crisisRes.data.ai_summary ?? '')

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

      setLabels((labelsRes.data ?? []) as Topic[])
      setAllContacts((allContactsRes.data ?? []) as Contact[])
      setCaseContacts((caseContactsRes.data ?? []).map((cc: any) => cc.contact).filter(Boolean))

      // Cargar conteo de documentos por tarea
      const taskIds = (tasksRes.data ?? []).map((t: any) => t.id)
      if (taskIds.length > 0) {
        const { data: tdData } = await supabase
          .from('task_documents')
          .select('task_id')
          .in('task_id', taskIds)
        if (tdData) {
          const countMap = new Map<string, number>()
          for (const row of tdData) {
            countMap.set(row.task_id, (countMap.get(row.task_id) ?? 0) + 1)
          }
          setTaskDocCounts(countMap)
        }
      }

      setLoading(false)
    }
    load()
  }, [id, router])

  // ── Task reload ───────────────────────────────────────────────────────────────

  const reloadTasks = useCallback(async () => {
    const { data } = await supabase
      .from('tasks')
      .select('id, title, status, due_date, assigned_contact_id, assigned_to_user, label_id')
      .eq('case_id', id)
      .eq('status', 'pendiente')
      .order('due_date', { ascending: true, nullsFirst: false })
    if (data) setTasks(data as Task[])
  }, [id])

  const reloadContacts = useCallback(async () => {
    const { data } = await supabase
      .from('case_contacts')
      .select('contact:contacts(id, name, role, proximity, initials, phone, email, relationship)')
      .eq('case_id', id)
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
      .from('case_history')
      .select('id, title, description, occurred_at')
      .eq('case_id', id)
      .order('occurred_at', { ascending: false })
    if (data) setHistory(data as HistoryEvent[])
  }, [id])

  const reloadLabels = useCallback(async () => {
    const { data } = await supabase
      .from('labels')
      .select('id, name, color, case_id')
      .eq('case_id', id)
      .order('created_at', { ascending: true })
    if (data) setLabels(data as Topic[])
  }, [id])

  const reloadDocs = useCallback(async () => {
    const { data } = await supabase
      .from('documents')
      .select('id, name, type, created_at, storage_path, original_filename, file_size_bytes, file_mime_type, uploaded_by_user, uploaded_by_contact_id')
      .eq('case_id', id)
      .order('created_at', { ascending: false })
    if (data) setDocs(data as Doc[])
  }, [id])

  const logHistory = useCallback(async (title: string, description: string | null, eventType: string) => {
    const { error } = await supabase.from('case_history').insert({
      case_id:     id,
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

  // ── Context submit (single-shot) ──────────────────────────────────────────

  const handleSendNovedad = useCallback(async (message: string) => {
    const text = message.trim()
    if (!text || isTyping || !id) return

    setIsTyping(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token ?? ''

      const res = await fetch('/api/case/generate-context', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          case_id:               id,
          mode:                  'chat_update',
          user_message:          text,
          conversation_history:  [{ from: 'user', text }],
        }),
      })

      const data = await res.json()

      if (data.summary) {
        setAiSummary(data.summary)
      }
    } catch (error) {
      console.error('Send novedad error:', error)
    } finally {
      setIsTyping(false)
    }
  }, [id, isTyping])

  // ── Sidesheet helpers ─────────────────────────────────────────────────────────

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

    const { data: fetchedContacts, error } = await supabase
      .from('contacts')
      .select('id, name, role, proximity, initials, phone, email, relationship')
      .eq('user_id', user.id)
      .order('name', { ascending: true })

    setAvailableLoading(false)
    if (error) { setSsError(error.message); return }

    const inCrisis = new Set(contacts.map((c) => c.id))
    const available = (fetchedContacts ?? []).filter((c) => !inCrisis.has(c.id)) as Contact[]
    setAvailableContacts(available)
  }

  function closeSheet() {
    setSsMode(null)
    setSsMember(null)
    setSsError(null)
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
    if (!window.confirm(`¿Quitar a ${ssMember.name.split(' ')[0]} de este tema?`)) return
    setSsLoading(true)
    setSsError(null)
    const { error } = await supabase
      .from('case_contacts')
      .delete()
      .eq('case_id', id)
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
      .from('case_contacts')
      .insert({ case_id: id, contact_id: c.id })
    setSsLoading(false)
    if (error) { setSsError(error.message); return }
    await reloadContacts()
    closeSheet()
  }

  // ── Close / reopen case ───────────────────────────────────────────────────────

  async function handleCloseCase() {
    if (!id || closingLoading) return
    setClosingLoading(true)
    setCloseError(null)
    const { error } = await supabase
      .from('cases')
      .update({ status: 'resuelta' })
      .eq('id', id)
    setClosingLoading(false)
    if (error) {
      setCloseError('No se pudo cerrar el tema. Intentá de nuevo.')
      return
    }
    setCloseModalOpen(false)
    router.replace('/case')
  }

  async function handleReopenCase() {
    if (!id || closingLoading) return
    setClosingLoading(true)
    setCloseError(null)
    const { error } = await supabase
      .from('cases')
      .update({ status: 'activa' })
      .eq('id', id)
    setClosingLoading(false)
    if (error) {
      setCloseError('No se pudo reabrir el tema. Intentá de nuevo.')
      return
    }
    setCrisis(prev => prev ? { ...prev, status: 'activa' } : null)
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

        @media (max-width: 768px) {
          .tema-layout { grid-template-columns: 1fr !important; }
          .tareas-docs-grid { grid-template-columns: 1fr !important; }
        }

        @keyframes typingDot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-3px); }
        }
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
            {ssMode === 'member-view' ? 'Miembro del círculo'
             : ssMode === 'member-add'  ? 'Agregar al círculo'
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
                      Quitar a {ssMember.name.split(' ')[0]} de este tema
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
                  Todos tus contactos ya están en este tema.<br />
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

      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MAIN PAGE
      ══════════════════════════════════════════════════════════════════════ */}

      <div className="gestion-bg flex min-h-screen">
        <Sidebar />

        <main className="flex-1 ml-0 md:ml-[240px] min-h-screen px-5 py-8 pb-28 md:px-10 md:py-10 md:pb-10">
          <SkeletonStyles />

          {/* ── Banner: tema cerrado ───────────────────────────── */}
          {crisis && crisis.status === 'resuelta' && (
            <div style={{
              marginBottom: 24,
              padding: '12px 16px',
              borderRadius: '0.75rem',
              background: 'rgba(90,116,120,0.08)',
              border: '1px solid rgba(90,116,120,0.18)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24"
                fill="none" stroke="#5a7478" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
              <span style={{
                fontSize: '0.875rem', color: '#5a7478', fontWeight: 600,
              }}>
                Este tema está cerrado. Lo podés reabrir desde Acciones.
              </span>
            </div>
          )}

          {/* Empty state — no active crisis */}
          {!loading && !crisis && (
            <div className="flex justify-center" style={{ marginTop: 80 }}>
              <div style={{ textAlign: 'center', maxWidth: 400 }}>
                <p className="font-bold text-[#1A1A2E]" style={{ fontSize: '1rem', marginBottom: 8 }}>
                  No hay ningún tema activo
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
            <div style={{ marginBottom: 32 }}>
              <h1 className="font-extrabold text-[#1A1A2E]"
                style={{ fontSize: '2rem', letterSpacing: '-0.03em', marginBottom: 4, lineHeight: 1.15 }}>
                {crisis.name}
              </h1> 
            </div>
          )}

          {/* ── Lo que sé ─────────────────────────────────────────────── */}
          {crisis && (
            <div style={{ marginBottom: 32 }}>
              <ContextStripDrawer
                contextText={aiSummary || null}
                onSendNovedad={handleSendNovedad}
                isSendingNovedad={isTyping}
                drawerTitle="Lo que sé"
                emptyStateLabel="Mhiru todavía no tiene contexto de este tema."
              />
            </div>
          )}

          {crisis && (
            <div className="tema-layout" style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 220px) 1fr',
              gap: 24,
              alignItems: 'start',
              marginBottom: 32,
            }}>

              {/* Columna izquierda — Historia */}
              <div>
                <SectionTitle>Historia</SectionTitle>
                <Card style={{ padding: 0 }}>
                  {history.length === 0 ? (
                    <p style={{
                      fontSize: '0.875rem', color: '#5a7478',
                      fontStyle: 'italic', padding: '20px 24px', margin: 0,
                    }}>
                      Sin historial todavía.
                    </p>
                  ) : (
                    <>
                      {history.slice(0, 5).map((h, i, arr) => (
                        <div key={h.id} style={{
                          padding: '14px 20px',
                          borderBottom: i < arr.length - 1
                            ? '1px solid rgba(10,126,140,0.08)' : 'none',
                        }}>
                          <div style={{
                            fontSize: '0.8125rem', fontWeight: 600,
                            color: '#1A1A2E', marginBottom: 2,
                          }}>
                            {h.title}
                          </div>
                          {h.description && (
                            <div style={{
                              fontSize: '0.75rem', color: '#5a7478', marginBottom: 4,
                            }}>
                              {h.task_id ? (
                                <span>
                                  {h.description.replace(/"([^"]+)"/, '').trim()}{' '}
                                  <span
                                    onClick={() => router.push(`/case/${id}/tarea/${h.task_id}`)}
                                    style={{
                                      color: '#0A7E8C',
                                      textDecoration: 'underline',
                                      textUnderlineOffset: 3,
                                      cursor: 'pointer',
                                      fontWeight: 600,
                                    }}
                                  >
                                    {h.description.match(/"([^"]+)"/)?.[1] ?? h.task_id ?? 'ver tarea'}
                                  </span>
                                </span>
                              ) : h.document_id ? (
                                <span>
                                  {h.description.replace(/"([^"]+)"/, '').trim()}{' '}
                                  <span
                                    onClick={() => router.push(`/case/${id}/documento/${h.document_id}`)}
                                    style={{
                                      color: '#0A7E8C',
                                      textDecoration: 'underline',
                                      textUnderlineOffset: 3,
                                      cursor: 'pointer',
                                      fontWeight: 600,
                                    }}
                                  >
                                    {h.description.match(/"([^"]+)"/)?.[1] ?? h.document_id ?? 'ver documento'}
                                  </span>
                                </span>
                              ) : (
                                h.description
                              )}
                            </div>
                          )}
                          <div style={{ fontSize: '0.65rem', color: '#5a7478' }}>
                            {fmtLongDate(h.occurred_at)}
                          </div>
                        </div>
                      ))}

                      {history.length > 5 && (
                        <button
                          type="button"
                          onClick={() => setHistorySheetOpen(true)}
                          style={{
                            width: '100%', textAlign: 'center',
                            padding: '12px 20px',
                            background: 'rgba(10,126,140,0.04)',
                            border: 'none',
                            borderTop: '1px solid rgba(10,126,140,0.08)',
                            cursor: 'pointer',
                            fontSize: '0.75rem', fontWeight: 700,
                            color: '#0A7E8C', fontFamily: 'inherit',
                            letterSpacing: '0.02em',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(10,126,140,0.08)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(10,126,140,0.04)' }}
                        >
                          Ver más
                        </button>
                      )}
                    </>
                  )}
                </Card>
              </div>

              {/* Columna derecha */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                {/* Fila 1: Tareas + Documentos */}
                <div className="tareas-docs-grid" style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 24,
                  alignItems: 'start',
                }}>

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
                            onClick={() => {
                            router.push(`/case/${id}/tarea/${t.id}`)
                          }}
                            style={{
                              gap: 14, padding: '13px 6px',
                              borderBottom: i < arr.length - 1 ? '1px solid rgba(10,126,140,0.12)' : 'none',
                              margin: '0 -6px',
                              transition: 'background 0.15s',
                              overflow: 'hidden',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(61,199,166,0.07)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                          >
                            <div className="flex-1 min-w-0">
                              <div style={{
                                fontSize: '0.875rem',
                                color: isDone ? '#5a7478' : '#1A1A2E',
                                fontWeight: isDone ? 400 : 600,
                              }}>
                                {t.title}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: '#5a7478', marginTop: 2 }}>
                                {t.due_date ? `Vence el ${fmtLongDate(t.due_date)}` : 'Sin fecha'}
                              </div>
                              {t.label_id && (() => {
                                const topic = labels.find(tp => tp.id === t.label_id)
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
                            {/* Ícono de documentos asociados */}
                            {(taskDocCounts.get(t.id) ?? 0) > 0 && (
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: 3,
                                flexShrink: 0,
                              }}>
                                <svg width="13" height="13" viewBox="0 0 24 24"
                                  fill="none" stroke="#5a7478" strokeWidth="1.8"
                                  strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                </svg>
                                {(taskDocCounts.get(t.id) ?? 0) > 1 && (
                                  <span style={{
                                    fontSize: '0.6rem', fontWeight: 700,
                                    color: '#5a7478',
                                  }}>
                                    {taskDocCounts.get(t.id)}
                                  </span>
                                )}
                              </div>
                            )}
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
                      onClick={() => router.push(`/case/${id}/tarea/nueva`)}
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

                  {tasks.filter(t => t.status === 'completada').length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDoneTasksSheetOpen(true)}
                      style={{
                        width: 'calc(100% + 48px)',
                        marginLeft: -24,
                        marginRight: -24,
                        marginBottom: -24,
                        marginTop: 0,
                        textAlign: 'center',
                        padding: '12px 0',
                        background: 'rgba(10,126,140,0.04)',
                        border: 'none',
                        borderTop: '1px solid rgba(10,126,140,0.08)',
                        cursor: 'pointer',
                        fontSize: '0.75rem', fontWeight: 700,
                        color: '#0A7E8C', fontFamily: 'inherit',
                        letterSpacing: '0.02em',
                        transition: 'background 0.15s',
                        borderBottomLeftRadius: '1.5rem',
                        borderBottomRightRadius: '1.5rem',
                        display: 'block',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(10,126,140,0.08)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(10,126,140,0.04)' }}
                    >
                      Ver finalizadas
                    </button>
                  )}
                </Card>
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
                            onClick={() => router.push(`/case/${id}/documento/${d.id}`)}
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
                    <button type="button" onClick={() => router.push(`/case/${id}/documento/nuevo`)}
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

                {/* Fila 2: Participantes */}
                <div>
                  <SectionTitle>Participantes</SectionTitle>
                  <div style={{
                    background: '#FFFFFF', borderRadius: '1.5rem',
                    boxShadow: '0 4px 24px rgba(10,126,140,0.08)', padding: 24,
                  }}>
                {caseContacts.map((c, i) => {
                  const initials = (c.initials ?? c.name.split(/\s+/).filter(Boolean)
                    .slice(0, 2).map(w => w[0]).join('')).toUpperCase().slice(0, 2)
                  return (
                    <div key={c.id} className="flex items-center"
                      style={{
                        gap: 12, padding: '12px 0',
                        borderBottom: i < caseContacts.length - 1
                          ? '1px solid rgba(10,126,140,0.12)' : 'none',
                      }}>
                      <div className="rounded-full flex items-center justify-center flex-shrink-0 text-white"
                        style={{ width: 36, height: 36, fontSize: '0.75rem', fontWeight: 700,
                          background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)' }}>
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[#1A1A2E] truncate"
                          style={{ fontSize: '0.875rem' }}>
                          {c.name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#5a7478', marginTop: 2 }}>
                          {c.role} · {c.proximity}
                        </div>
                      </div>
                    </div>
                  )
                })}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ── Acciones ───────────────────────────────────────── */}
          {crisis && (
            <div style={{ marginBottom: 32 }}>
              <SectionTitle>Acciones</SectionTitle>

              {closeError && (
                <div style={{
                  marginBottom: 12, padding: '10px 16px',
                  borderRadius: '0.75rem',
                  background: 'rgba(186,26,26,0.07)',
                  border: '1px solid rgba(186,26,26,0.18)',
                  fontSize: '0.8125rem', color: '#ba1a1a', fontWeight: 600,
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 8,
                }}>
                  <span>{closeError}</span>
                  <button
                    onClick={() => setCloseError(null)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#ba1a1a', fontSize: '1rem', lineHeight: 1, flexShrink: 0,
                    }}
                  >✕</button>
                </div>
              )}

              <Card style={{ padding: '13px 20px' }}>
                <div style={{
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 12,
                }}>
                  <span style={{ fontSize: '0.875rem', color: '#5a7478', flex: 1 }}>
                    {crisis.status === 'activa'
                      ? 'Cerrar este tema. Lo podés reabrir más adelante.'
                      : 'Este tema está cerrado. Podés reabrirlo si volvió a estar activo.'}
                  </span>
                  {crisis.status === 'activa' ? (
                    <button
                      onClick={() => setCloseModalOpen(true)}
                      style={{
                        background: 'rgba(186,26,26,0.06)', color: '#ba1a1a',
                        border: 'none', borderRadius: '0.6rem',
                        padding: '7px 16px', fontSize: '0.875rem', fontWeight: 700,
                        cursor: 'pointer', transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(186,26,26,0.14)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(186,26,26,0.06)' }}
                    >
                      Cerrar tema
                    </button>
                  ) : (
                    <button
                      onClick={handleReopenCase}
                      disabled={closingLoading}
                      style={{
                        background: 'rgba(10,126,140,0.08)', color: '#0A7E8C',
                        border: 'none', borderRadius: '0.6rem',
                        padding: '7px 16px', fontSize: '0.875rem', fontWeight: 700,
                        cursor: closingLoading ? 'not-allowed' : 'pointer',
                        opacity: closingLoading ? 0.6 : 1,
                        transition: 'background 0.15s',
                      }}
                    >
                      {closingLoading ? 'Reabriendo…' : 'Reabrir tema'}
                    </button>
                  )}
                </div>
              </Card>
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

      {/* ── Modal: cerrar tema ───────────────────────────── */}
      {closeModalOpen && (
        <>
          <div
            onClick={() => !closingLoading && setCloseModalOpen(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.40)', zIndex: 600,
            }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 601, width: 'min(92vw, 420px)',
            background: '#FFFFFF', borderRadius: '1.5rem',
            boxShadow: '0 24px 80px rgba(0,0,0,0.20)',
            padding: '28px',
          }}>
            <p style={{
              fontSize: '1.125rem', fontWeight: 800,
              color: '#1A1A2E', marginBottom: 8,
              letterSpacing: '-0.02em',
            }}>
              ¿Cerrar este tema?
            </p>
            <p style={{
              fontSize: '0.875rem', color: '#5a7478',
              lineHeight: 1.6, marginBottom: 24,
            }}>
              Lo voy a marcar como resuelto. No va a aparecer más
              en tu listado de temas, pero lo podés reabrir cuando
              quieras.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setCloseModalOpen(false)}
                disabled={closingLoading}
                style={{
                  flex: 1, padding: '11px 0',
                  background: 'rgba(10,126,140,0.07)',
                  color: '#0A7E8C', border: 'none', borderRadius: 9999,
                  fontWeight: 700, fontSize: '0.875rem',
                  cursor: closingLoading ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: closingLoading ? 0.5 : 1,
                }}
              >
                Seguir activo
              </button>
              <button
                onClick={handleCloseCase}
                disabled={closingLoading}
                style={{
                  flex: 1, padding: '11px 0',
                  background: closingLoading
                    ? 'rgba(186,26,26,0.06)' : 'rgba(186,26,26,0.10)',
                  color: '#ba1a1a', border: 'none', borderRadius: 9999,
                  fontWeight: 700, fontSize: '0.875rem',
                  cursor: closingLoading ? 'not-allowed' : 'pointer',
                  opacity: closingLoading ? 0.6 : 1,
                  fontFamily: 'inherit',
                  transition: 'background 0.15s',
                }}
              >
                {closingLoading ? 'Cerrando…' : 'Cerrar tema'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════
          SIDESHEET — HISTORIA COMPLETA
      ══════════════════════════════════════════════════════════════ */}

      <div
        onClick={() => setHistorySheetOpen(false)}
        style={{
          position:      'fixed',
          inset:         0,
          background:    'rgba(0,0,0,0.22)',
          zIndex:        500,
          opacity:       historySheetOpen ? 1 : 0,
          pointerEvents: historySheetOpen ? 'auto' : 'none',
          transition:    'opacity 0.3s',
        }}
      />

      <div
        style={{
          position:      'fixed',
          top:           0,
          right:         0,
          width:         480,
          maxWidth:      '100vw',
          height:        '100vh',
          background:    '#f0f4f8',
          zIndex:        501,
          transform:     historySheetOpen ? 'translateX(0)' : 'translateX(100%)',
          transition:    'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
          display:       'flex',
          flexDirection: 'column',
          boxShadow:     '-6px 0 32px rgba(0,0,0,0.10)',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', flexShrink: 0,
          borderBottom: '1px solid rgba(10,126,140,0.08)',
          background: '#FFFFFF',
        }}>
          <span style={{
            fontSize: '0.7rem', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5a7478',
          }}>
            Historia
          </span>
          <button
            onClick={() => setHistorySheetOpen(false)}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#5a7478', fontSize: '1rem',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.11)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)' }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {history.map((h, i) => (
            <div key={h.id} style={{
              padding: '14px 24px',
              borderBottom: i < history.length - 1 ? '1px solid rgba(10,126,140,0.08)' : 'none',
            }}>
              <div style={{
                fontSize: '0.8125rem', fontWeight: 600,
                color: '#1A1A2E', marginBottom: 2,
              }}>
                {h.title}
              </div>
              {h.description && (
                <div style={{
                  fontSize: '0.75rem', color: '#5a7478', marginBottom: 4,
                }}>
                  {h.task_id ? (
                    <span>
                      {h.description.replace(/"([^"]+)"/, '').trim()}{' '}
                      <span
                        onClick={() => {
                          setHistorySheetOpen(false)
                          router.push(`/case/${id}/tarea/${h.task_id}`)
                        }}
                        style={{
                          color: '#0A7E8C',
                          textDecoration: 'underline',
                          textUnderlineOffset: 3,
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        {h.description.match(/"([^"]+)"/)?.[1] ?? h.task_id ?? 'ver tarea'}
                      </span>
                    </span>
                  ) : h.document_id ? (
                    <span>
                      {h.description.replace(/"([^"]+)"/, '').trim()}{' '}
                      <span
                        onClick={() => {
                          setHistorySheetOpen(false)
                          router.push(`/case/${id}/documento/${h.document_id}`)
                        }}
                        style={{
                          color: '#0A7E8C',
                          textDecoration: 'underline',
                          textUnderlineOffset: 3,
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        {h.description.match(/"([^"]+)"/)?.[1] ?? h.document_id ?? 'ver documento'}
                      </span>
                    </span>
                  ) : (
                    h.description
                  )}
                </div>
              )}
              <div style={{ fontSize: '0.65rem', color: '#5a7478' }}>
                {fmtLongDate(h.occurred_at)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SIDESHEET — TAREAS FINALIZADAS
      ══════════════════════════════════════════════════════════════ */}

      <div
        onClick={() => setDoneTasksSheetOpen(false)}
        style={{
          position:      'fixed',
          inset:         0,
          background:    'rgba(0,0,0,0.22)',
          zIndex:        500,
          opacity:       doneTasksSheetOpen ? 1 : 0,
          pointerEvents: doneTasksSheetOpen ? 'auto' : 'none',
          transition:    'opacity 0.3s',
        }}
      />

      <div
        style={{
          position:      'fixed',
          top:           0,
          right:         0,
          width:         480,
          maxWidth:      '100vw',
          height:        '100vh',
          background:    '#f0f4f8',
          zIndex:        501,
          transform:     doneTasksSheetOpen ? 'translateX(0)' : 'translateX(100%)',
          transition:    'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
          display:       'flex',
          flexDirection: 'column',
          boxShadow:     '-6px 0 32px rgba(0,0,0,0.10)',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', flexShrink: 0,
          borderBottom: '1px solid rgba(10,126,140,0.08)',
          background: '#FFFFFF',
        }}>
          <span style={{
            fontSize: '0.7rem', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5a7478',
          }}>
            Tareas finalizadas
          </span>
          <button
            onClick={() => setDoneTasksSheetOpen(false)}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#5a7478', fontSize: '1rem',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.11)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)' }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {(() => {
            const doneTasks = tasks.filter(t => t.status === 'completada')
            if (doneTasks.length === 0) {
              return (
                <p style={{
                  fontSize: '0.875rem', color: '#5a7478',
                  fontStyle: 'italic', padding: '20px 24px', margin: 0,
                }}>
                  Sin tareas finalizadas todavía.
                </p>
              )
            }
            return doneTasks.map((t, i, arr) => {
              const contact = t.assigned_contact_id ? contactById.get(t.assigned_contact_id) : null
              let avInitials = '', avBg = ''
              if (t.assigned_to_user) {
                avInitials = 'Yo'; avBg = 'linear-gradient(135deg, #0A7E8C, #2ECDA7)'
              } else if (contact) {
                avInitials = (contact.initials ?? getInitials(contact.name)).slice(0, 2)
                avBg = 'linear-gradient(135deg, #f4ab66, #E8913A)'
              }
              return (
                <div
                  key={t.id}
                  className="flex items-center cursor-pointer"
                  onClick={() => {
                    setDoneTasksSheetOpen(false)
                    router.push(`/case/${id}/tarea/${t.id}`)
                  }}
                  style={{
                    gap: 14, padding: '14px 24px',
                    borderBottom: i < arr.length - 1 ? '1px solid rgba(10,126,140,0.08)' : 'none',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(61,199,166,0.04)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <div className="flex-1 min-w-0">
                    <div style={{
                      fontSize: '0.875rem',
                      color: '#5a7478',
                      fontWeight: 400,
                      textDecoration: 'line-through',
                      textDecorationColor: 'rgba(90,116,120,0.5)',
                    }}>
                      {t.title}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#5a7478', marginTop: 2 }}>
                      {t.due_date ? `Era para el ${fmtLongDate(t.due_date)}` : 'Sin fecha'}
                    </div>
                  </div>
                  {avInitials && (
                    <div className="rounded-full flex items-center justify-center flex-shrink-0 text-white"
                      style={{ width: 24, height: 24, fontSize: '0.62rem', fontWeight: 700, background: avBg, opacity: 0.65 }}>
                      {avInitials}
                    </div>
                  )}
                </div>
              )
            })
          })()}
        </div>
      </div>
    </>
  )
}
