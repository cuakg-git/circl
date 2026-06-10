'use client'

import { use, useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import ContextStripDrawer from '@/components/ContextStripDrawer'

// ── Types ──────────────────────────────────────────────────────────────────────

type Task = {
  id:                  string
  title:               string
  description:         string | null
  status:              string
  due_date:            string | null
  assigned_contact_id: string | null
  assigned_to_user:    boolean | null
  context:             string | null
  created_at:          string
}

type Contact = {
  id:       string
  name:     string
  initials: string | null
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
  title:       string | null
  description: string | null
  created_at:  string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  estudio_medico: 'Estudio médico',
  receta:         'Receta',
  informe:        'Informe',
  otros:          'Otros',
}

const DOC_TYPE_OPTIONS = Object.entries(DOC_TYPE_LABELS)

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
  const date = d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
  const time = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  return `${date.charAt(0).toUpperCase() + date.slice(1)} · ${time}`
}

const EVENT_LABELS: Record<string, string> = {
  tarea_creada:        'Tarea creada',
  estado_cambiado:     'Estado actualizado',
  asignacion_cambiada: 'Asignación cambiada',
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

// ── Page ───────────────────────────────────────────────────────────────────────

export default function TareaDetailSharedPage({
  params,
}: {
  params: Promise<{ id: string; tareaId: string }>
}) {
  const { id: sharedCaseId, tareaId } = use(params)
  const router = useRouter()
  const taskId = tareaId

  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [task,     setTask]     = useState<Task | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [history,  setHistory]  = useState<HistoryEvent[]>([])
  const [userId,          setUserId]          = useState<string | null>(null)
  const [error,           setError]           = useState<string | null>(null)
  const [sharedCaseName,  setSharedCaseName]  = useState<string>('')

  // Edición inline
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleVal,     setTitleVal]     = useState('')
  const [editingDesc,  setEditingDesc]  = useState(false)
  const [descVal,      setDescVal]      = useState('')
  const [editingDate,  setEditingDate]  = useState(false)
  const [dateVal,      setDateVal]      = useState('')

  // Dropdown asignado
  const [assigneeVal, setAssigneeVal] = useState('')
  const [assigneeDropdown, setAssigneeDropdown] = useState<{
    open: boolean; anchorRect: DOMRect | null
  }>({ open: false, anchorRect: null })

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Modal de notificación de asignación
  const [notifyModal, setNotifyModal] = useState<{
    open:          boolean
    contactId:     string | null
    contactName:   string
    contactEmail:  string | null
    emailInput:    string
    sending:       boolean
    sent:          boolean
    error:         string | null
    draftLoading:  boolean
    draftBody:     string | null
    draftSubject:  string | null
    editingBody:   boolean
    bodyInput:     string
  }>({
    open: false, contactId: null, contactName: '',
    contactEmail: null, emailInput: '', sending: false,
    sent: false, error: null,
    draftLoading: false, draftBody: null, draftSubject: null,
    editingBody: false, bodyInput: '',
  })

  // Documentos asociados
  const [taskDocs,         setTaskDocs]         = useState<TaskDoc[]>([])
  const [allDocs,          setAllDocs]          = useState<Doc[]>([])
  const [docPickerOpen,    setDocPickerOpen]    = useState(false)
  const [docLinkLoading,   setDocLinkLoading]   = useState(false)
  const [docUnlinkLoading, setDocUnlinkLoading] = useState<string | null>(null)

  // Upload de documento nuevo
  const [docUploadOpen,  setDocUploadOpen]  = useState(false)
  const [uploadName,     setUploadName]     = useState('')
  const [uploadType,     setUploadType]     = useState('estudio_medico')
  const [uploadFile,     setUploadFile]     = useState<File | null>(null)
  const [uploadLoading,  setUploadLoading]  = useState(false)
  const [isDragging,     setIsDragging]     = useState(false)
  const fileInputRef   = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

  // Contexto y sugerencias
  const [taskContext,       setTaskContext]       = useState<string | null>(null)
  const [suggestedAssignee, setSuggestedAssignee] = useState<{
    name: string; reason: string
  } | null>(null)

  // Minichat (estado simplificado para drawer)
  const [chatLoading, setChatLoading] = useState(false)

  // ── Load ──────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) { router.replace('/login'); return }
      setUserId(user.id)

      const { data: sharedCaseData } = await supabase
        .from('shared_cases')
        .select('name')
        .eq('id', sharedCaseId)
        .maybeSingle()
      if (sharedCaseData) setSharedCaseName(sharedCaseData.name)

      const [taskRes, contactsRes, historyRes, taskDocsRes, allDocsRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('id, title, description, status, due_date, assigned_contact_id, assigned_to_user, context, created_at')
          .eq('id', taskId)
          .eq('shared_case_id', sharedCaseId)
          .maybeSingle(),
        supabase
          .from('contacts')
          .select('id, name, initials')
          .eq('user_id', user.id)
          .order('sort_order', { ascending: true, nullsFirst: false }),
        supabase
          .from('shared_case_history')
          .select('id, event_type, title, description, created_at')
          .eq('shared_case_id', sharedCaseId)
          .order('created_at', { ascending: false }),
        supabase
          .from('task_documents')
          .select('id, document_id, doc:documents(id, name, type, created_at, storage_path, original_filename, file_mime_type)')
          .eq('task_id', taskId)
          .order('created_at', { ascending: false }),
        supabase
          .from('documents')
          .select('id, name, type, created_at, storage_path, original_filename, file_mime_type')
          .eq('shared_case_id', sharedCaseId)
          .order('created_at', { ascending: false }),
      ])

      if (!taskRes.data) { router.replace(`/case/shared/${sharedCaseId}`); return }

      const t = taskRes.data as Task
      setTask(t)
      setTaskContext(t.context ?? null)

      setTitleVal(t.title)
      setDescVal(t.description ?? '')
      setDateVal(t.due_date ?? '')

      if (t.assigned_to_user) setAssigneeVal('yo')
      else if (t.assigned_contact_id) setAssigneeVal(`c:${t.assigned_contact_id}`)
      else setAssigneeVal('')

      setContacts((contactsRes.data ?? []) as Contact[])
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
          })
          .catch(e => console.error('[tarea-shared-detail] suggestions error:', e))
      } else {
        fetch('/api/task-context', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ task_id: taskRes.data.id, user_id: user.id }),
        })
          .then(r => r.json())
          .then(json => {
            if (json.context)            setTaskContext(json.context)
            if (json.suggested_assignee) setSuggestedAssignee(json.suggested_assignee)
          })
          .catch(e => console.error('[tarea-shared-detail] init context error:', e))
      }
    }
    load()
  }, [router, taskId, sharedCaseId])

  // ── Helpers ───────────────────────────────────────────────────────────────────

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
      setTaskDocs(data.map((row: any) => ({
        id:          row.id,
        document_id: row.document_id,
        doc:         Array.isArray(row.doc) ? row.doc[0] : row.doc,
      })) as TaskDoc[])
    }
  }

  async function reloadHistory() {
    const { data } = await supabase
      .from('shared_case_history')
      .select('id, event_type, title, description, created_at')
      .eq('shared_case_id', sharedCaseId)
      .order('created_at', { ascending: false })
    if (data) setHistory(data as HistoryEvent[])
  }

  async function logEvent(eventType: string, description: string) {
    if (!userId) return
    await supabase.from('shared_case_history').insert({
      shared_case_id: sharedCaseId,
      title:          EVENT_LABELS[eventType] ?? eventType,
      description,
      event_type:     eventType,
      created_by:     userId,
    })
    await reloadHistory()
  }

  async function logSharedHistory(description: string, taskId?: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('shared_case_history').insert({
      shared_case_id: sharedCaseId,
      title:          'Tarea actualizada',
      description,
      event_type:     'actualizacion_general',
      created_by:     user.id,
      task_id:        taskId ?? null,
      occurred_at:    new Date().toISOString(),
    })
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
    if (!uploadFile || !uploadName.trim() || uploadLoading) return
    setUploadLoading(true)
    setError(null)

    const timestamp = Date.now()
    const safeName  = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path      = `shared/${sharedCaseId}/${timestamp}_${safeName}`

    const { error: uploadErr } = await supabase.storage
      .from('docs')
      .upload(path, uploadFile)

    if (uploadErr) {
      setUploadLoading(false)
      setError(`Error al subir el archivo: ${uploadErr.message}`)
      return
    }

    const { data: newDoc, error: dbErr } = await supabase
      .from('documents')
      .insert({
        shared_case_id:         sharedCaseId,
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

    const { error: linkErr } = await supabase
      .from('task_documents')
      .insert({ task_id: taskId, document_id: newDoc.id })

    if (linkErr) {
      setUploadLoading(false)
      setError(linkErr.message)
      return
    }

    await reloadTaskDocs()

    const { data: freshDocs } = await supabase
      .from('documents')
      .select('id, name, type, created_at, storage_path, original_filename, file_mime_type')
      .eq('shared_case_id', sharedCaseId)
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

  // ── callTaskContext ───────────────────────────────────────────────────────────

  async function callTaskContext(userMessage?: string) {
    if (!userId) return
    setChatLoading(true)
    setSuggestedAssignee(null)

    try {
      const res = await fetch('/api/task-context', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          task_id:      taskId,
          user_id:      userId,
          user_message: userMessage ?? null,
          chat_history: userMessage
            ? [{ role: 'user' as const, content: userMessage }]
            : [],
        }),
      })
      const json = await res.json()

      // Actualizar contexto
      if (json.context) setTaskContext(json.context)

      // Sugerencias
      if (json.suggested_assignee) setSuggestedAssignee(json.suggested_assignee)

      // Aplicar field_updates automáticamente
      if (json.field_updates && Object.keys(json.field_updates).length > 0) {
        const fu = json.field_updates

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

        if (fu.assigned_to_user === true) {
          setAssigneeVal('yo')
        } else if (fu.assigned_contact_name) {
          const match = contacts.find(c =>
            c.name.toLowerCase() === fu.assigned_contact_name.toLowerCase()
          )
          if (match) setAssigneeVal(`c:${match.id}`)
        }

        if (fu.due_date !== undefined) setDateVal(fu.due_date ?? '')

        await reloadHistory()
      }

    } catch (e) {
      console.error('[tarea-shared-detail] task-context error:', e)
    } finally {
      setChatLoading(false)
    }
  }

  async function handleSendNovedad(message: string) {
    if (!message.trim() || chatLoading) return
    await callTaskContext(message.trim())
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
    await logSharedHistory(`"${titleVal.trim()}" — título actualizado`, taskId)
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
      await logSharedHistory(`"${task?.title}" — descripción actualizada`, taskId)
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
    await logSharedHistory(`"${task?.title}" — fecha: ${dateVal || 'sin fecha'}`, taskId)
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
    await logSharedHistory(`"${task?.title}" — asignada a ${assigneeName}`, taskId)
    callTaskContext()

    if (val.startsWith('c:')) {
      const contactId = val.slice(2)
      const c = contacts.find(c => c.id === contactId)
      if (c) {
        const { data: contactData } = await supabase
          .from('contacts')
          .select('email')
          .eq('id', contactId)
          .maybeSingle()
        setNotifyModal({
          open:         true,
          contactId,
          contactName:  c.name,
          contactEmail: contactData?.email ?? null,
          emailInput:   contactData?.email ?? '',
          sending:      false,
          sent:         false,
          error:        null,
          draftLoading: true,
          draftBody:    null,
          draftSubject: null,
          editingBody:  false,
          bodyInput:    '',
        })

        fetch('/api/notification-draft', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            contact_id:        contactId,
            notification_type: 'task_assigned',
            owner_name:        (await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', userId!)
              .maybeSingle()
            ).data?.full_name ?? 'Tu contacto',
            payload: {
              task_title:       task?.title,
              task_description: task?.description ?? null,
            },
          }),
        })
          .then(r => r.json())
          .then(json => {
            setNotifyModal(prev => ({
              ...prev,
              draftLoading: false,
              draftBody:    json.body   ?? null,
              draftSubject: json.subject ?? null,
              bodyInput:    json.body   ?? '',
              error:        json.error  ?? null,
            }))
          })
          .catch(() => {
            setNotifyModal(prev => ({
              ...prev,
              draftLoading: false,
              error: 'No se pudo generar el mensaje. Podés escribirlo manualmente.',
            }))
          })
      }
    }
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
    await logSharedHistory(newStatus === 'completada' ? `"${task?.title}" completada` : `"${task?.title}" reabierta`, taskId)
  }

  async function handleSendNotification() {
    const email = notifyModal.contactEmail ?? notifyModal.emailInput.trim()
    if (!email) {
      setNotifyModal(prev => ({ ...prev, error: 'Ingresá un email válido' }))
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNotifyModal(prev => ({ ...prev, error: 'El email no es válido' }))
      return
    }

    setNotifyModal(prev => ({ ...prev, sending: true, error: null }))

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId!)
      .maybeSingle()
    const ownerName = profile?.full_name ?? 'Tu contacto'

    const finalBody = notifyModal.bodyInput.trim() || notifyModal.draftBody || ''

    const res = await fetch('/api/notify-assignee', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        task_id:          taskId,
        contact_id:       notifyModal.contactId,
        contact_email:    email,
        owner_name:       ownerName,
        task_title:       task?.title,
        task_description: task?.description,
        custom_body:      finalBody,
        custom_subject:   notifyModal.draftSubject ?? undefined,
      }),
    })

    const json = await res.json()

    if (!res.ok || json.error) {
      setNotifyModal(prev => ({
        ...prev, sending: false,
        error: json.error ?? 'No se pudo enviar el mail. Intentá de nuevo.',
      }))
      return
    }

    setNotifyModal(prev => ({ ...prev, sending: false, sent: true }))
  }

  async function handleDelete() {
    setDeleteLoading(true)
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    setDeleteLoading(false)
    if (error) { setError(error.message); return }
    router.replace('/case/shared/' + sharedCaseId)
  }

  // ── Computed ──────────────────────────────────────────────────────────────────

  const isDone = task?.status === 'completada'

  function getAssigneeDisplay() {
    if (!assigneeVal) return null
    if (assigneeVal === 'yo') return {
      label: 'Yo', initials: 'Yo',
      bg: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
    }
    if (assigneeVal.startsWith('c:')) {
      const c = contacts.find(c => `c:${c.id}` === assigneeVal)
      if (c) return {
        label:    c.name,
        initials: (c.initials ?? initialsFrom(c.name)).slice(0, 2),
        bg:       'linear-gradient(135deg, #f4ab66, #E8913A)',
      }
    }
    return null
  }

  const assigneeDisplay = getAssigneeDisplay()

  // ── Render ────────────────────────────────────────────────────────────────────

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
        .tarea-shared-detail-bg { animation: heroBgDrift 30s ease-in-out infinite; }
        @keyframes shimmer {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>

      {/* ── Modal notificación de asignación ── */}
      {notifyModal.open && (
        <>
          <div
            onClick={() => !notifyModal.sending && setNotifyModal(prev => ({ ...prev, open: false }))}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.40)',
              zIndex: 600,
            }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 601,
            width: 'min(92vw, 420px)',
            background: '#FFFFFF',
            borderRadius: '1.5rem',
            boxShadow: '0 24px 80px rgba(0,0,0,0.20)',
            padding: '28px 28px 24px',
          }}>
            {notifyModal.sent ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'rgba(46,205,167,0.15)',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', margin: '0 auto 16px',
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24"
                    fill="none" stroke="#2ECDA7" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <p style={{
                  fontSize: '1rem', fontWeight: 800,
                  color: '#1A1A2E', marginBottom: 8,
                }}>
                  Notificación enviada
                </p>
                <p style={{
                  fontSize: '0.875rem', color: '#5a7478',
                  lineHeight: 1.6, marginBottom: 24,
                }}>
                  Le avisamos a {notifyModal.contactName} que tiene
                  una nueva tarea asignada.
                </p>
                <button
                  type="button"
                  onClick={() => setNotifyModal(prev => ({ ...prev, open: false }))}
                  style={{
                    width: '100%', padding: '12px',
                    background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                    color: 'white', border: 'none', borderRadius: 9999,
                    fontWeight: 700, fontSize: '0.875rem',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Listo
                </button>
              </div>
            ) : (
              <>
                <div style={{
                  display: 'flex', alignItems: 'flex-start',
                  justifyContent: 'space-between', marginBottom: 16,
                }}>
                  <div>
                    <p style={{
                      fontSize: '1rem', fontWeight: 800,
                      color: '#1A1A2E', margin: '0 0 4px',
                    }}>
                      ¿Notificar a {notifyModal.contactName}?
                    </p>
                    <p style={{
                      fontSize: '0.8125rem', color: '#5a7478',
                      margin: 0, lineHeight: 1.5,
                    }}>
                      {notifyModal.contactEmail
                        ? `Se enviará a ${notifyModal.contactEmail}`
                        : 'No tenemos su email todavía. Ingresalo para notificarlo.'
                      }
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotifyModal(prev => ({ ...prev, open: false }))}
                    disabled={notifyModal.sending}
                    style={{
                      background: 'none', border: 'none',
                      cursor: 'pointer', color: '#5a7478',
                      fontSize: '1.2rem', lineHeight: 1,
                      padding: '0 0 0 12px', flexShrink: 0,
                    }}
                  >
                    ✕
                  </button>
                </div>

                {!notifyModal.contactEmail && (
                  <div style={{ marginBottom: 16 }}>
                    <input
                      type="email"
                      placeholder="email@ejemplo.com"
                      value={notifyModal.emailInput}
                      onChange={(e) => setNotifyModal(prev => ({
                        ...prev, emailInput: e.target.value, error: null,
                      }))}
                      autoFocus
                      style={{
                        width: '100%', padding: '10px 14px',
                        border: '1.5px solid rgba(10,126,140,0.20)',
                        borderRadius: '0.75rem', fontSize: '0.875rem',
                        outline: 'none', color: '#1A1A2E',
                        fontFamily: 'inherit', background: '#FAF8F5',
                        boxSizing: 'border-box',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#0A7E8C' }}
                      onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(10,126,140,0.20)' }}
                    />
                  </div>
                )}

                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', marginBottom: 8,
                  }}>
                    <p style={{
                      fontSize: '0.7rem', fontWeight: 700,
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                      color: '#5a7478', margin: 0,
                    }}>
                      Mensaje
                    </p>
                    {!notifyModal.draftLoading && notifyModal.draftBody && !notifyModal.editingBody && (
                      <button
                        type="button"
                        onClick={() => setNotifyModal(prev => ({
                          ...prev, editingBody: true,
                          bodyInput: prev.draftBody ?? '',
                        }))}
                        style={{
                          background: 'none', border: 'none',
                          cursor: 'pointer', color: '#0A7E8C',
                          fontSize: '0.75rem', fontWeight: 600,
                          fontFamily: 'inherit', padding: 0,
                          textDecoration: 'underline',
                          textUnderlineOffset: 3,
                        }}
                      >
                        Editar
                      </button>
                    )}
                    {notifyModal.editingBody && (
                      <button
                        type="button"
                        onClick={() => setNotifyModal(prev => ({
                          ...prev, editingBody: false,
                          bodyInput: prev.draftBody ?? '',
                        }))}
                        style={{
                          background: 'none', border: 'none',
                          cursor: 'pointer', color: '#5a7478',
                          fontSize: '0.75rem', fontFamily: 'inherit',
                          padding: 0,
                        }}
                      >
                        Cancelar
                      </button>
                    )}
                  </div>

                  {notifyModal.draftLoading && (
                    <div style={{
                      padding: '14px 16px',
                      background: 'rgba(10,126,140,0.04)',
                      borderRadius: '0.75rem',
                      border: '1px solid rgba(10,126,140,0.10)',
                    }}>
                      {[85, 100, 70, 90, 55].map((w, i) => (
                        <div key={i} style={{
                          height: 10, borderRadius: 6,
                          marginBottom: i < 4 ? 10 : 0,
                          width: `${w}%`,
                          background: 'linear-gradient(90deg, rgba(10,126,140,0.08) 25%, rgba(10,126,140,0.16) 50%, rgba(10,126,140,0.08) 75%)',
                          backgroundSize: '200% 100%',
                          animation: 'shimmer 1.4s infinite',
                        }} />
                      ))}
                    </div>
                  )}

                  {!notifyModal.draftLoading && notifyModal.draftBody && !notifyModal.editingBody && (
                    <div style={{
                      padding: '14px 16px',
                      background: 'rgba(10,126,140,0.04)',
                      borderRadius: '0.75rem',
                      border: '1px solid rgba(10,126,140,0.10)',
                      fontSize: '0.875rem', color: '#1A1A2E',
                      lineHeight: 1.65, whiteSpace: 'pre-wrap',
                    }}>
                      {notifyModal.draftBody}
                    </div>
                  )}

                  {notifyModal.editingBody && (
                    <textarea
                      value={notifyModal.bodyInput}
                      onChange={(e) => setNotifyModal(prev => ({
                        ...prev, bodyInput: e.target.value,
                      }))}
                      rows={6}
                      autoFocus
                      style={{
                        width: '100%', padding: '14px 16px',
                        border: '1.5px solid #0A7E8C',
                        borderRadius: '0.75rem', fontSize: '0.875rem',
                        outline: 'none', color: '#1A1A2E',
                        fontFamily: 'inherit', lineHeight: 1.65,
                        resize: 'vertical', background: '#FAF8F5',
                        boxSizing: 'border-box',
                      }}
                    />
                  )}
                </div>

                {notifyModal.error && (
                  <p style={{
                    fontSize: '0.8125rem', color: '#ba1a1a',
                    fontWeight: 600, marginBottom: 12,
                    padding: '8px 12px',
                    background: 'rgba(186,26,26,0.07)',
                    borderRadius: '0.5rem',
                  }}>
                    {notifyModal.error}
                  </p>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setNotifyModal(prev => ({ ...prev, open: false }))}
                    disabled={notifyModal.sending}
                    style={{
                      flex: 1, padding: '11px 0',
                      background: 'rgba(10,126,140,0.07)',
                      color: '#0A7E8C', border: 'none',
                      borderRadius: 9999, fontWeight: 700,
                      fontSize: '0.875rem', cursor: 'pointer',
                      fontFamily: 'inherit',
                      opacity: notifyModal.sending ? 0.5 : 1,
                    }}
                  >
                    Ahora no
                  </button>
                  <button
                    type="button"
                    onClick={handleSendNotification}
                    disabled={
                      notifyModal.sending ||
                      notifyModal.draftLoading ||
                      (!notifyModal.contactEmail && !notifyModal.emailInput.trim())
                    }
                    style={{
                      flex: 1, padding: '11px 0',
                      background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                      color: 'white', border: 'none',
                      borderRadius: 9999, fontWeight: 700,
                      fontSize: '0.875rem',
                      cursor: (
                        notifyModal.sending ||
                        notifyModal.draftLoading ||
                        (!notifyModal.contactEmail && !notifyModal.emailInput.trim())
                      ) ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                      opacity: (
                        notifyModal.sending ||
                        notifyModal.draftLoading ||
                        (!notifyModal.contactEmail && !notifyModal.emailInput.trim())
                      ) ? 0.6 : 1,
                      transition: 'filter 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (!notifyModal.sending && !notifyModal.draftLoading)
                        e.currentTarget.style.filter = 'brightness(1.08)'
                    }}
                    onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)' }}
                  >
                    {notifyModal.sending ? 'Enviando…' : 'Notificar'}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Dropdown asignado */}
      {assigneeDropdown.open && (
        <AssigneeDropdownPortal
          contacts={contacts}
          selectedValue={assigneeVal}
          anchorRect={assigneeDropdown.anchorRect}
          onSelect={handleAssigneeChange}
          onClose={() => setAssigneeDropdown({ open: false, anchorRect: null })}
        />
      )}

      <div className="tarea-shared-detail-bg flex min-h-screen">
        <Sidebar />

        <main className="flex-1 ml-0 md:ml-[240px] min-h-screen px-5 py-8 pb-28 md:px-10 md:py-10 md:pb-10">

          {/* Breadcrumb */}
          <nav style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Link href={`/case/shared/${sharedCaseId}`} style={{
              fontSize: '0.8125rem', color: '#0A7E8C', fontWeight: 600,
              textDecoration: 'none',
            }}>
              {sharedCaseName || 'Tema compartido'}
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

                {/* Lo que sé */}
                <div style={{ marginTop: 20 }}>
                  <ContextStripDrawer
                    contextText={taskContext}
                    onSendNovedad={handleSendNovedad}
                    isSendingNovedad={chatLoading}
                    drawerTitle="Lo que sé sobre esta tarea"
                    emptyStateLabel="Mhiru todavía no tiene contexto sobre esta tarea."
                  />
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
                      {assigneeVal ? 'Cambiar' : 'Asignar'}
                    </button>
                  </div>
                </div>

                {/* Sugerencia de asignado */}
                {suggestedAssignee && !assigneeVal && (
                  <div style={{
                    padding: '10px 20px 14px',
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
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{
                                fontSize: '0.875rem', fontWeight: 600,
                                color: '#1A1A2E', margin: 0,
                                whiteSpace: 'nowrap', overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}>{d.name}</p>
                              <p style={{ fontSize: '0.7rem', color: '#5a7478', margin: 0 }}>
                                {[DOC_TYPE_LABELS[d.type ?? ''], fmtShortDate(d.created_at)].filter(Boolean).join(' · ')}
                              </p>
                            </div>
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

                  {/* Botones agregar */}
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
                            {h.title ?? EVENT_LABELS[h.event_type] ?? h.event_type}
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
                            {fmtDateTime(h.created_at)}
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
