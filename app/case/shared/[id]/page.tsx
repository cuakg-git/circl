'use client'

import { use, useEffect, useState, useCallback, useRef } from 'react'
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

type SharedCase = {
  id:          string
  name:        string
  status:      string
  description: string | null
  ai_summary:  string | null
  created_by:  string
  created_at:  string
}

type SharedMember = {
  id:               string
  user_id:          string | null
  email:            string
  status:           string
  joined_at:        string | null
  personal_context: string | null
  profile:          { full_name: string; avatar_url: string | null } | null
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
  id:       string
  name:     string
  initials: string | null
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

type Thread = {
  id:         string
  author_id:  string
  content:    string
  created_at: string
  updated_at: string
  author:     { full_name: string; avatar_url: string | null } | null
}

type ThreadWithMeta = Thread & {
  reply_count:   number
  last_reply_at: string | null
}

type Reply = {
  id:         string
  thread_id:  string
  author_id:  string
  content:    string
  created_at: string
  updated_at: string
  author:     { full_name: string; avatar_url: string | null } | null
}

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

function linkifyText(text: string): React.ReactNode[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#0A7E8C', textDecoration: 'underline' }}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function formatRelativeTime(iso: string): string {
  const now    = Date.now()
  const then   = new Date(iso).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1)  return 'recién'
  if (diffMin < 60) return `hace ${diffMin}m`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24)   return `hace ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7)    return `hace ${diffD}d`
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric', month: 'short',
  }).replace('.', '')
}

// ── DOC type labels ────────────────────────────────────────────────────────────

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

function IconInvitePerson() {
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

function IconSend() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
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

function Card({
  children, style, variant = 'elevated',
}: {
  children: React.ReactNode
  style?: React.CSSProperties
  variant?: 'elevated' | 'outlined'
}) {
  const baseStyle: React.CSSProperties = variant === 'outlined'
    ? {
        background: '#FFFFFF',
        border: '0.5px solid rgba(10,126,140,0.08)',
        borderRadius: '1rem',
        padding: 20,
      }
    : {
        background: '#FFFFFF',
        borderRadius: '1.5rem',
        boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
        padding: 24,
      }
  return (
    <div style={{ ...baseStyle, ...style }}>
      {children}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function SharedCaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router  = useRouter()

  // ── Data state ───────────────────────────────────────────────────────────────
  const [sharedCase,    setSharedCase]    = useState<SharedCase | null>(null)
  const [tasks,         setTasks]         = useState<Task[]>([])
  const [docs,          setDocs]          = useState<Doc[]>([])
  const [members,       setMembers]       = useState<SharedMember[]>([])
  const [pendingMembers, setPendingMembers] = useState<{ id: string; email: string; status: string }[]>([])
  const [history,       setHistory]       = useState<HistoryEvent[]>([])
  const [contacts,      setContacts]      = useState<Contact[]>([])
  const [myMember,      setMyMember]      = useState<SharedMember | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [taskDocCounts, setTaskDocCounts] = useState<Map<string, number>>(new Map())

  // ── Personal context state ───────────────────────────────────────────────────
  const [personalCtx, setPersonalCtx] = useState('')
  const [aiSummary,   setAiSummary]   = useState('')
  const [ctxSaving,   setCtxSaving]   = useState(false)
  const [ctxSaved,    setCtxSaved]    = useState(false)
  const [ctxEditing,  setCtxEditing]  = useState(false)

  // ── Chat state ───────────────────────────────────────────────────────────────
  const [chatOpen,    setChatOpen]    = useState(true)
  const [chatMsgs,    setChatMsgs]    = useState<{ id: number; from: 'mhiru' | 'user'; text: string }[]>([])
  const [chatInput,   setChatInput]   = useState('')
  const [isTyping,    setIsTyping]    = useState(false)
  const chatMsgId  = useRef(0)
  const chatLogRef = useRef<HTMLDivElement>(null)

  const [chatQuestion,    setChatQuestion]    = useState<string | null>(null)
  const [chatSuggestions, setChatSuggestions] = useState<string[]>([])
  const [chatDone,        setChatDone]        = useState(false)

  const [ctxOpen, setCtxOpen] = useState(true)

  // ── Close/reopen case ────────────────────────────────────────────────────────
  const [closeModalOpen, setCloseModalOpen] = useState(false)
  const [closingLoading, setClosingLoading] = useState(false)
  const [closeError,     setCloseError]     = useState<string | null>(null)

  // ── Remove pending modal ─────────────────────────────────────────────────────
  const [removePendingId,  setRemovePendingId]  = useState<string | null>(null)
  const [removingPending,  setRemovingPending]  = useState(false)

  // ── Threads ───────────────────────────────────────────────────────────────────
  const [threads,          setThreads]          = useState<ThreadWithMeta[]>([])
  const [threadsLoading,   setThreadsLoading]   = useState(false)
  const [newThreadContent, setNewThreadContent] = useState('')
  const [threadSubmitting, setThreadSubmitting] = useState(false)
  const [threadError,      setThreadError]      = useState<string | null>(null)

  const [editingThreadId, setEditingThreadId] = useState<string | null>(null)
  const [editingDraft,    setEditingDraft]    = useState('')
  const [editingSaving,   setEditingSaving]   = useState(false)

  const [openMenuId,   setOpenMenuId]   = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'thread' | 'reply'; id: string } | null>(null)
  const [deleting,     setDeleting]     = useState(false)

  const [historySheetOpen,   setHistorySheetOpen]   = useState(false)
  const [doneTasksSheetOpen, setDoneTasksSheetOpen] = useState(false)

  // ── Thread sidesheet ─────────────────────────────────────────────────────────
  const [threadSheetOpen,    setThreadSheetOpen]    = useState(false)
  const [currentThread,      setCurrentThread]      = useState<ThreadWithMeta | null>(null)
  const [replies,            setReplies]            = useState<Reply[]>([])
  const [repliesLoading,     setRepliesLoading]     = useState(false)
  const [replyInput,         setReplyInput]         = useState('')
  const [replySubmitting,    setReplySubmitting]    = useState(false)
  const [replyError,         setReplyError]         = useState<string | null>(null)

  const [editingReplyId,     setEditingReplyId]     = useState<string | null>(null)
  const [editingReplyDraft,  setEditingReplyDraft]  = useState('')
  const [editingReplySaving, setEditingReplySaving] = useState(false)

  const [openReplyMenuId, setOpenReplyMenuId] = useState<string | null>(null)

  const repliesEndRef = useRef<HTMLDivElement>(null)

  const [headerMenuOpen,  setHeaderMenuOpen]  = useState(false)
  const headerMenuRef  = useRef<HTMLDivElement>(null)
  const [membersMenuOpen, setMembersMenuOpen] = useState(false)
  const membersMenuRef = useRef<HTMLDivElement>(null)

  // ── Sidesheet (invite) ───────────────────────────────────────────────────────
  const [ssOpen,        setSsOpen]        = useState(false)
  const [inviteEmail,   setInviteEmail]   = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError,   setInviteError]   = useState<string | null>(null)
  const [inviteToast,   setInviteToast]   = useState(false)

  // ── Load data ────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) { router.replace('/login'); return }

      const [caseRes, tasksRes, docsRes, membersRes, pendingRes, historyRes, contactsRes] =
        await Promise.all([
          supabase
            .from('shared_cases')
            .select('id, name, status, description, ai_summary, created_by, created_at')
            .eq('id', id)
            .maybeSingle(),

          supabase
            .from('tasks')
            .select('id, title, status, due_date, assigned_contact_id, assigned_to_user')
            .eq('shared_case_id', id)
            .order('due_date', { ascending: true, nullsFirst: false }),

          supabase
            .from('documents')
            .select('id, name, type, created_at, storage_path, original_filename, file_size_bytes, file_mime_type, uploaded_by_user, uploaded_by_contact_id')
            .eq('shared_case_id', id)
            .order('created_at', { ascending: false }),

          supabase
            .from('shared_case_members')
            .select(`id, user_id, email, status, joined_at, personal_context, profile:profiles!shared_case_members_user_id_fkey(full_name, avatar_url)`)
            .eq('shared_case_id', id)
            .eq('status', 'active'),

          supabase
            .from('shared_case_members')
            .select('id, email, status')
            .eq('shared_case_id', id)
            .eq('status', 'pending'),

          supabase
            .from('shared_case_history')
            .select('id, title, description, occurred_at, task_id, document_id')
            .eq('shared_case_id', id)
            .order('occurred_at', { ascending: false }),

          supabase
            .from('contacts')
            .select('id, name, initials')
            .eq('user_id', user.id),
        ])

      console.log('caseRes:', caseRes.data, caseRes.error)
      console.log('membersRes:', membersRes.data, membersRes.error)

      if (caseRes.error || !caseRes.data) { router.replace('/case'); return }
      setSharedCase(caseRes.data)

      const membersData = (membersRes.data ?? []) as unknown as SharedMember[]
      const myMemberData = membersData.find((m: any) => m.user_id === user.id) ?? null
      if (!myMemberData) { router.replace('/case'); return }

      setMembers(membersData)
      setMyMember(myMemberData)
      setPersonalCtx(myMemberData.personal_context ?? '')
      setAiSummary(caseRes.data.ai_summary ?? '')

      setTasks((tasksRes.data ?? []) as Task[])
      setDocs((docsRes.data ?? []) as Doc[])
      setPendingMembers((pendingRes.data ?? []) as { id: string; email: string; status: string }[])
      setHistory((historyRes.data ?? []) as HistoryEvent[])
      setContacts((contactsRes.data ?? []) as Contact[])

      // Conteo de documentos por tarea
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

  // ── Reload helpers ───────────────────────────────────────────────────────────

  const reloadTasks = useCallback(async () => {
    const { data } = await supabase
      .from('tasks')
      .select('id, title, status, due_date, assigned_contact_id, assigned_to_user')
      .eq('shared_case_id', id)
      .eq('status', 'pendiente')
      .order('due_date', { ascending: true, nullsFirst: false })
    if (data) setTasks(data as Task[])
  }, [id])

  const reloadHistory = useCallback(async () => {
    const { data } = await supabase
      .from('shared_case_history')
      .select('id, title, description, occurred_at, task_id, document_id')
      .eq('shared_case_id', id)
      .order('occurred_at', { ascending: false })
    if (data) setHistory(data as HistoryEvent[])
  }, [id])

  const reloadDocs = useCallback(async () => {
    const { data } = await supabase
      .from('documents')
      .select('id, name, type, created_at, storage_path, original_filename, file_size_bytes, file_mime_type, uploaded_by_user, uploaded_by_contact_id')
      .eq('shared_case_id', id)
      .order('created_at', { ascending: false })
    if (data) setDocs(data as Doc[])
  }, [id])

  const logHistory = useCallback(async (title: string, description: string | null, eventType: string) => {
    const { error } = await supabase.from('shared_case_history').insert({
      shared_case_id: id,
      title,
      description,
      event_type:     eventType,
      occurred_at:    new Date().toISOString(),
    })
    if (error) { console.error('Error logging history:', error.message); return }
    await reloadHistory()
  }, [id, reloadHistory])

  // ── Personal context ─────────────────────────────────────────────────────────

  async function handleSavePersonalContext() {
    if (!myMember || ctxSaving) return
    setCtxSaving(true)
    const { error } = await supabase
      .from('shared_case_members')
      .update({ personal_context: personalCtx })
      .eq('id', myMember.id)
    setCtxSaving(false)
    if (!error) {
      setCtxSaved(true)
      setCtxEditing(false)
      setTimeout(() => setCtxSaved(false), 2000)
    }
  }

  // ── Chat helpers ───────────────────────────────────────────────────────────

  async function handleOpenChat() {
    setChatOpen(true)
    setChatMsgs([])
    setChatDone(false)
    setChatQuestion(null)
    setChatSuggestions([])
    setIsTyping(true)

    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = session?.access_token ?? ''

    try {
      const res = await fetch('/api/case/generate-context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          shared_case_id: id,
          member_id: myMember?.id,
          mode: 'chat_init',
        }),
      })
      const data = await res.json()
      setChatQuestion(data.question ?? '¿Hay novedades sobre este tema?')
      setChatSuggestions(data.suggestions ?? [])
    } catch {
      setChatQuestion('¿Hay novedades sobre este tema?')
      setChatSuggestions(['Hubo novedades', 'Todo sigue igual', 'Quiero actualizar el contexto'])
    }

    setIsTyping(false)
  }

  const handleChatSubmit = useCallback(async (message: string) => {
    const text = message.trim()
    if (!text || isTyping || chatDone || !myMember) return

    // Add user message immediately
    const updatedMsgs = [...chatMsgs, { id: ++chatMsgId.current, from: 'user' as const, text }]
    setChatMsgs(updatedMsgs)
    setChatQuestion(null)
    setChatSuggestions([])
    setChatInput('')
    setIsTyping(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token ?? ''

      // Build conversation history from current messages
      const conversationHistory = updatedMsgs.map(msg => ({
        from: msg.from,
        text: msg.text,
      }))

      const res = await fetch('/api/case/generate-context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          shared_case_id: id,
          member_id: myMember.id,
          mode: 'chat_update',
          user_message: text,
          conversation_history: conversationHistory,
        }),
      })

      const data = await res.json()
      setIsTyping(false)

      if (data.reply) {
        setChatMsgs(prev => [...prev, {
          id: ++chatMsgId.current,
          from: 'mhiru',
          text: data.reply,
        }])
      }

      if (data.summary) {
        setAiSummary(data.summary)
      }
    } catch (error) {
      console.error('Chat error:', error)
      setIsTyping(false)
    }
  }, [chatMsgs, isTyping, chatDone, id, myMember])

  // ── Invite submit ────────────────────────────────────────────────────────────

  async function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim() || inviteLoading) return
    setInviteLoading(true)
    setInviteError(null)

    const { data: { session } } = await supabase.auth.getSession()
    const accessToken = session?.access_token ?? ''

    const res = await fetch('/api/shared-case/invite', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        shared_case_id: id,
        email:          inviteEmail.trim(),
      }),
    })
    const resData = await res.json()
    setInviteLoading(false)

    if (res.ok) {
      setPendingMembers(prev => [...prev, {
        id:     resData.member_id,
        email:  inviteEmail.trim(),
        status: 'pending',
      }])
      setSsOpen(false)
      setInviteEmail('')
      setInviteToast(true)
      setTimeout(() => setInviteToast(false), 3000)
      return
    }

    if (res.status === 409) {
      setInviteError('Este email ya fue invitado')
    } else {
      setInviteError(resData.error ?? 'Ocurrió un error. Intentá de nuevo.')
    }
  }

  // ── Remove pending invite ────────────────────────────────────────────────────

  async function handleRemovePending(memberId: string) {
    setRemovingPending(true)

    // Primero borrar la invitación (FK apunta a member_id)
    await supabase
      .from('shared_case_invitations')
      .delete()
      .eq('member_id', memberId)

    // Después borrar el miembro
    const { error } = await supabase
      .from('shared_case_members')
      .delete()
      .eq('id', memberId)

    if (!error) {
      setPendingMembers(prev => prev.filter(m => m.id !== memberId))
    }

    setRemovingPending(false)
    setRemovePendingId(null)
  }

  // ── Auto-scroll chat ─────────────────────────────────────────────────────────

  useEffect(() => {
    const el = chatLogRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chatMsgs, isTyping])

  // ── Click outside header menu ────────────────────────────────────────────────

  useEffect(() => {
    if (!headerMenuOpen) return
    function onClickOutside(e: MouseEvent) {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setHeaderMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [headerMenuOpen])

  useEffect(() => {
    if (!membersMenuOpen) return
    function onClickOutside(e: MouseEvent) {
      if (membersMenuRef.current && !membersMenuRef.current.contains(e.target as Node)) {
        setMembersMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [membersMenuOpen])

  // ── Auto-scroll replies ───────────────────────────────────────────────────────

  useEffect(() => {
    if (threadSheetOpen && repliesEndRef.current) {
      repliesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [replies, threadSheetOpen])

  // ── Initialize chat on mount ───────────────────────────────────────────────────

  useEffect(() => {
    if (sharedCase && myMember && !loading) {
      handleOpenChat()
    }
  }, [sharedCase, myMember, loading])

  // ── Close / reopen case ───────────────────────────────────────────────────────

  async function handleCloseCase() {
    if (!id || closingLoading) return
    setClosingLoading(true)
    setCloseError(null)
    const { error } = await supabase
      .from('shared_cases')
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
      .from('shared_cases')
      .update({ status: 'activa' })
      .eq('id', id)
    setClosingLoading(false)
    if (error) {
      setCloseError('No se pudo reabrir el tema. Intentá de nuevo.')
      return
    }
    setSharedCase(prev => prev ? { ...prev, status: 'activa' } : null)
  }

  // ── Threads ───────────────────────────────────────────────────────────────────

  const loadThreads = useCallback(async () => {
    if (!sharedCase) return
    setThreadsLoading(true)

    // 1. Traer threads sin el JOIN a profiles
    const { data: threadsData, error: threadsErr } = await supabase
      .from('shared_case_threads')
      .select('id, author_id, content, created_at, updated_at')
      .eq('shared_case_id', sharedCase.id)
      .order('created_at', { ascending: false })

    if (threadsErr || !threadsData) {
      console.error('loadThreads error:', threadsErr?.message, threadsErr?.code, threadsErr)
      setThreadsLoading(false)
      return
    }

    // 2. Traer profiles de los autores únicos
    const authorIds = Array.from(new Set(threadsData.map((t: any) => t.author_id)))
    let profilesMap = new Map<string, { full_name: string; avatar_url: string | null }>()

    if (authorIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', authorIds)

      if (profilesData) {
        for (const p of profilesData as any[]) {
          profilesMap.set(p.id, { full_name: p.full_name, avatar_url: p.avatar_url })
        }
      }
    }

    // 3. Contar replies y última fecha por thread
    const threadIds = threadsData.map((t: any) => t.id)
    let replyMeta = new Map<string, { count: number; last: string | null }>()

    if (threadIds.length > 0) {
      const { data: repliesData } = await supabase
        .from('shared_case_thread_replies')
        .select('thread_id, created_at')
        .in('thread_id', threadIds)
        .order('created_at', { ascending: false })

      if (repliesData) {
        for (const r of repliesData) {
          const m = replyMeta.get(r.thread_id) ?? { count: 0, last: null }
          m.count += 1
          if (!m.last || r.created_at > m.last) m.last = r.created_at
          replyMeta.set(r.thread_id, m)
        }
      }
    }

    // 4. Combinar todo
    const withMeta: ThreadWithMeta[] = threadsData.map((t: any) => ({
      id:            t.id,
      author_id:     t.author_id,
      content:       t.content,
      created_at:    t.created_at,
      updated_at:    t.updated_at,
      author:        profilesMap.get(t.author_id) ?? null,
      reply_count:   replyMeta.get(t.id)?.count ?? 0,
      last_reply_at: replyMeta.get(t.id)?.last ?? null,
    }))

    setThreads(withMeta)
    setThreadsLoading(false)
  }, [sharedCase])

  useEffect(() => {
    if (sharedCase && myMember) {
      loadThreads()
    }
  }, [sharedCase, myMember, loadThreads])

  async function handleCreateThread() {
    const content = newThreadContent.trim()
    if (!content || threadSubmitting || !sharedCase || !myMember) return
    if (content.length > 2000) {
      setThreadError('El comentario no puede superar los 2000 caracteres.')
      return
    }
    setThreadSubmitting(true)
    setThreadError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setThreadSubmitting(false)
      setThreadError('Sesión expirada. Recargá la página.')
      return
    }

    const { error } = await supabase
      .from('shared_case_threads')
      .insert({ shared_case_id: sharedCase.id, author_id: user.id, content })

    setThreadSubmitting(false)
    if (error) {
      setThreadError(error.message ?? 'No se pudo publicar el comentario.')
      return
    }
    setNewThreadContent('')
    await loadThreads()
  }

  function handleStartEditThread(t: Thread) {
    setEditingThreadId(t.id)
    setEditingDraft(t.content)
    setOpenMenuId(null)
  }

  function handleCancelEdit() {
    setEditingThreadId(null)
    setEditingDraft('')
  }

  async function handleSaveEditThread() {
    const content = editingDraft.trim()
    if (!content || !editingThreadId || editingSaving) return
    if (content.length > 2000) {
      setThreadError('El comentario no puede superar los 2000 caracteres.')
      return
    }
    setEditingSaving(true)
    const { error } = await supabase
      .from('shared_case_threads')
      .update({ content })
      .eq('id', editingThreadId)
    setEditingSaving(false)
    if (error) {
      setThreadError(error.message ?? 'No se pudo guardar el cambio.')
      return
    }
    setEditingThreadId(null)
    setEditingDraft('')
    await loadThreads()
  }

  async function loadReplies(threadId: string) {
    setRepliesLoading(true)

    const { data: repliesData, error: repliesErr } = await supabase
      .from('shared_case_thread_replies')
      .select('id, thread_id, author_id, content, created_at, updated_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })

    if (repliesErr || !repliesData) {
      console.error('loadReplies error:', repliesErr?.message, repliesErr)
      setReplies([])
      setRepliesLoading(false)
      return
    }

    const authorIds = Array.from(new Set(repliesData.map((r: any) => r.author_id)))
    let profilesMap = new Map<string, { full_name: string; avatar_url: string | null }>()

    if (authorIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', authorIds)

      if (profilesData) {
        for (const p of profilesData as any[]) {
          profilesMap.set(p.id, { full_name: p.full_name, avatar_url: p.avatar_url })
        }
      }
    }

    const withProfiles: Reply[] = repliesData.map((r: any) => ({
      id:         r.id,
      thread_id:  r.thread_id,
      author_id:  r.author_id,
      content:    r.content,
      created_at: r.created_at,
      updated_at: r.updated_at,
      author:     profilesMap.get(r.author_id) ?? null,
    }))

    setReplies(withProfiles)
    setRepliesLoading(false)
  }

  function handleOpenThread(t: ThreadWithMeta) {
    setCurrentThread(t)
    setThreadSheetOpen(true)
    setReplyInput('')
    setReplyError(null)
    setEditingReplyId(null)
    setEditingReplyDraft('')
    loadReplies(t.id)
  }

  function handleCloseThreadSheet() {
    setThreadSheetOpen(false)
    setCurrentThread(null)
    setReplies([])
    setReplyInput('')
    setReplyError(null)
    setEditingReplyId(null)
    setEditingReplyDraft('')
    setOpenReplyMenuId(null)
  }

  async function handleCreateReply() {
    const content = replyInput.trim()
    if (!content || replySubmitting || !currentThread) return
    if (content.length > 2000) {
      setReplyError('La respuesta no puede superar los 2000 caracteres.')
      return
    }
    setReplySubmitting(true)
    setReplyError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setReplySubmitting(false)
      setReplyError('Sesión expirada. Recargá la página.')
      return
    }

    const { error } = await supabase
      .from('shared_case_thread_replies')
      .insert({ thread_id: currentThread.id, author_id: user.id, content })

    setReplySubmitting(false)
    if (error) {
      setReplyError(error.message ?? 'No se pudo publicar la respuesta.')
      return
    }
    setReplyInput('')
    await loadReplies(currentThread.id)
    await loadThreads()
  }

  function handleStartEditReply(r: Reply) {
    setEditingReplyId(r.id)
    setEditingReplyDraft(r.content)
    setOpenReplyMenuId(null)
  }

  function handleCancelEditReply() {
    setEditingReplyId(null)
    setEditingReplyDraft('')
  }

  async function handleSaveEditReply() {
    const content = editingReplyDraft.trim()
    if (!content || !editingReplyId || editingReplySaving || !currentThread) return
    if (content.length > 2000) {
      setReplyError('La respuesta no puede superar los 2000 caracteres.')
      return
    }
    setEditingReplySaving(true)
    const { error } = await supabase
      .from('shared_case_thread_replies')
      .update({ content })
      .eq('id', editingReplyId)
    setEditingReplySaving(false)
    if (error) {
      setReplyError(error.message ?? 'No se pudo guardar el cambio.')
      return
    }
    setEditingReplyId(null)
    setEditingReplyDraft('')
    await loadReplies(currentThread.id)
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget || deleting) return
    setDeleting(true)

    const tabla = deleteTarget.type === 'thread'
      ? 'shared_case_threads'
      : 'shared_case_thread_replies'

    const { error } = await supabase
      .from(tabla)
      .delete()
      .eq('id', deleteTarget.id)

    setDeleting(false)
    if (error) {
      if (deleteTarget.type === 'thread') {
        setThreadError(error.message ?? 'No se pudo borrar.')
      } else {
        setReplyError(error.message ?? 'No se pudo borrar.')
      }
      return
    }
    setDeleteTarget(null)

    if (deleteTarget.type === 'thread') {
      if (threadSheetOpen && currentThread?.id === deleteTarget.id) {
        handleCloseThreadSheet()
      }
      await loadThreads()
    } else {
      if (currentThread) await loadReplies(currentThread.id)
      await loadThreads()
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────────

  const contactById = new Map(contacts.map((c) => [c.id, c]))

  // ── Render ─────────────────────────────────────────────────────────────────────

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
        .shared-bg { animation: heroBgDrift 30s ease-in-out infinite; }
        @media (max-width: 768px) {
          .tema-layout {
            display: flex !important;
            flex-direction: column !important;
          }
          .col-left, .col-right {
            display: contents !important;
          }
          .order-1 { order: 1 !important; }
          .order-2 { order: 2 !important; }
          .order-3 { order: 3 !important; }
          .order-4 { order: 4 !important; }
          .header-main-row { flex-direction: column !important; align-items: stretch !important; }
          .header-actions { margin-top: 16px !important; justify-content: flex-start !important; }
        }
        @keyframes typingDot {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40%            { transform: scale(1);   opacity: 1;   }
        }
      `}</style>

      {/* ══════════════════════════════════════════════════════════════════════
          SIDESHEET — INVITE
      ══════════════════════════════════════════════════════════════════════ */}

      {/* Overlay */}
      <div
        onClick={() => setSsOpen(false)}
        style={{
          position:      'fixed',
          inset:         0,
          background:    'rgba(0,0,0,0.22)',
          zIndex:        200,
          opacity:       ssOpen ? 1 : 0,
          pointerEvents: ssOpen ? 'auto' : 'none',
          transition:    'opacity 0.3s',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position:      'fixed',
          top:           0,
          right:         0,
          width:         420,
          maxWidth:      '100vw',
          height:        '100vh',
          background:    '#f0f4f8',
          zIndex:        201,
          transform:     ssOpen ? 'translateX(0)' : 'translateX(100%)',
          transition:    'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
          overflowY:     'auto',
          display:       'flex',
          flexDirection: 'column',
          boxShadow:     '-6px 0 32px rgba(0,0,0,0.10)',
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
            Invitar persona
          </span>
          <button
            onClick={() => setSsOpen(false)}
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

        {/* Invite form */}
        <form onSubmit={handleInviteSubmit} style={{ padding: '0 24px 40px', flex: 1 }}>
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
              <IconInvitePerson />
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#1A1A2E' }}>
              Invitar persona
            </div>
          </div>

          {inviteError && (
            <p style={{
              fontSize: '0.7rem', color: '#ba1a1a', fontWeight: 600,
              marginBottom: 16, padding: '10px 14px',
              background: 'rgba(186,26,26,0.06)', borderRadius: '0.6rem',
            }}>
              {inviteError}
            </p>
          )}

          <div style={{ marginBottom: 28 }}>
            <label style={{
              fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: '#5a7478',
              display: 'block', marginBottom: 8,
            }}>
              Email
            </label>
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              style={{
                width: '100%', boxSizing: 'border-box',
                border: '1.5px solid rgba(10,126,140,0.12)',
                borderRadius: '0.75rem', padding: '12px 16px',
                fontSize: '0.875rem', color: '#1A1A2E',
                outline: 'none', fontFamily: 'inherit', background: '#FAF8F5',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={inviteLoading || !inviteEmail.trim()}
            style={{
              width: '100%',
              background: inviteLoading || !inviteEmail.trim()
                ? 'rgba(10,126,140,0.35)'
                : 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
              color: '#ffffff',
              border: 'none', borderRadius: 9999,
              padding: '13px', fontSize: '0.9375rem', fontWeight: 700,
              cursor: inviteLoading || !inviteEmail.trim() ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', transition: 'opacity 0.15s',
            }}
          >
            {inviteLoading ? 'Enviando…' : 'Enviar invitación'}
          </button>
        </form>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TOAST
      ══════════════════════════════════════════════════════════════════════ */}
      {inviteToast && (
        <div style={{
          position:    'fixed',
          bottom:      32,
          left:        '50%',
          transform:   'translateX(-50%)',
          background:  '#1A1A2E',
          color:       '#ffffff',
          padding:     '12px 24px',
          borderRadius: 9999,
          fontSize:    '0.875rem',
          fontWeight:  600,
          zIndex:      300,
          boxShadow:   '0 8px 32px rgba(0,0,0,0.20)',
          whiteSpace:  'nowrap',
        }}>
          Invitación enviada ✓
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL — QUITAR INVITACIÓN PENDIENTE
      ══════════════════════════════════════════════════════════════════════ */}
      {removePendingId && (
        <>
          {/* Overlay */}
          <div
            onClick={() => setRemovePendingId(null)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.32)',
              zIndex: 400,
            }}
          />
          {/* Modal */}
          <div style={{
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: '#ffffff',
            borderRadius: '1.5rem',
            padding: '32px',
            width: '100%', maxWidth: 380,
            zIndex: 401,
            boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          }}>
            <h3 style={{
              fontSize: '1.125rem', fontWeight: 800,
              color: '#1A1A2E', marginBottom: 12,
              letterSpacing: '-0.02em',
            }}>
              ¿Quitar esta invitación?
            </h3>
            <p style={{
              fontSize: '0.875rem', color: '#5a7478',
              lineHeight: 1.6, marginBottom: 24,
            }}>
              Se cancelará la invitación y el usuario no podrá
              unirse con este link. Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setRemovePendingId(null)}
                style={{
                  background: 'none',
                  border: '1.5px solid rgba(10,126,140,0.20)',
                  borderRadius: 9999, padding: '8px 20px',
                  fontSize: '0.875rem', fontWeight: 600,
                  color: '#5a7478', cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleRemovePending(removePendingId)}
                disabled={removingPending}
                style={{
                  background: removingPending
                    ? 'rgba(186,26,26,0.35)'
                    : 'rgba(186,26,26,0.9)',
                  border: 'none', borderRadius: 9999,
                  padding: '8px 20px',
                  fontSize: '0.875rem', fontWeight: 700,
                  color: 'white',
                  cursor: removingPending ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {removingPending ? 'Quitando…' : 'Quitar invitación'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MAIN PAGE
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="shared-bg flex min-h-screen">
        <Sidebar />

        <main className="flex-1 ml-0 md:ml-[240px] min-h-screen px-5 py-8 pb-28 md:px-10 md:py-10 md:pb-10">
          <SkeletonStyles />

          {/* ── Loading skeleton ──────────────────────────────────────── */}
          {loading && (
            <div>
              <div style={{ marginBottom: 8 }}>
                <SkeletonText width={120} style={{ marginBottom: 16 }} />
              </div>
              <div style={{ marginBottom: 40 }}>
                <SkeletonText width="40%" style={{ height: 36, marginBottom: 10 }} />
                <SkeletonText width="60%" style={{ marginBottom: 6 }} />
                <SkeletonText width="30%" />
              </div>
              <SkeletonCard style={{ marginBottom: 24 }}>
                <SkeletonText width="20%" style={{ marginBottom: 10 }} />
                <SkeletonText width="90%" style={{ marginBottom: 6 }} />
                <SkeletonText width="75%" />
              </SkeletonCard>
              <div className="shared-grid grid items-start" style={{ gap: 24, gridTemplateColumns: '1fr', marginBottom: 24 }}>
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

          {/* ── Content ───────────────────────────────────────────────── */}
          {!loading && sharedCase && (
            <>
              {/* ── Header rediseñado ──────────────────────────────── */}
              {sharedCase && (
                <div style={{ marginBottom: 32 }}>
                  {/* Breadcrumb */}
                  <Link
                    href="/case"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: '0.8125rem', color: '#5a7478',
                      textDecoration: 'none', fontWeight: 600,
                      marginBottom: 12,
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#0A7E8C' }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#5a7478' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                    Temas
                  </Link>

                  <div className="header-main-row" style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 16,
                  }}>
                    {/* Columna izquierda: título + meta */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h1 style={{
                        fontSize: '2rem', fontWeight: 800,
                        color: '#1A1A2E', letterSpacing: '-0.03em',
                        lineHeight: 1.15, margin: 0, marginBottom: 6,
                      }}>
                        {sharedCase.name}
                      </h1>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}>
                        <span style={{ fontSize: '0.875rem', color: '#5a7478' }}>
                          {(() => {
                            const activeMembers = members.filter((m: any) => m.status === 'active').length
                            const activeTasks   = tasks.filter((t: any) => t.status === 'pendiente').length
                            const personasTxt   = `${activeMembers} ${activeMembers === 1 ? 'persona' : 'personas'}`
                            const tareasTxt     = `${activeTasks} ${activeTasks === 1 ? 'tarea activa' : 'tareas activas'}`
                            const fechaTxt      = `creado ${fmtShortDate(sharedCase.created_at)}`
                            return `${personasTxt} · ${tareasTxt} · ${fechaTxt}`
                          })()}
                        </span>

                        {sharedCase.status === 'resuelta' && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center',
                            fontSize: '0.7rem', fontWeight: 700,
                            letterSpacing: '0.06em', textTransform: 'uppercase',
                            color: '#5a7478',
                            background: 'rgba(90,116,120,0.14)',
                            padding: '3px 10px', borderRadius: 9999,
                          }}>
                            Cerrado
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Acciones a la derecha */}
                    <div className="header-actions" style={{
                      display: 'flex',
                      gap: 8,
                      flexShrink: 0,
                      alignItems: 'center',
                    }}>
                      {/* ── Avatar stack + dropdown ─────────────── */}
                      <div ref={membersMenuRef} style={{ position: 'relative' }}>
                        {(() => {
                          const activeOnly = members.filter((m: any) => m.status === 'active')
                          const visibleAvatars = activeOnly.slice(0, 3)
                          const extraCount = activeOnly.length - visibleAvatars.length

                          return (
                            <button
                              type="button"
                              onClick={() => setMembersMenuOpen(prev => !prev)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                background: membersMenuOpen ? 'rgba(10,126,140,0.14)' : 'rgba(10,126,140,0.07)',
                                border: 'none',
                                borderRadius: 9999,
                                padding: '4px 12px 4px 6px',
                                cursor: 'pointer', fontFamily: 'inherit',
                                transition: 'background 0.15s',
                                height: 34,
                              }}
                              onMouseEnter={(e) => {
                                if (!membersMenuOpen) e.currentTarget.style.background = 'rgba(10,126,140,0.14)'
                              }}
                              onMouseLeave={(e) => {
                                if (!membersMenuOpen) e.currentTarget.style.background = 'rgba(10,126,140,0.07)'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                {visibleAvatars.map((m: any, i: number) => {
                                  const displayName = (m.profile as any)?.full_name || m.email
                                  const initials    = getInitials(displayName).slice(0, 2)
                                  const avatarUrl   = (m.profile as any)?.avatar_url ?? null
                                  return (
                                    <div
                                      key={m.id}
                                      style={{
                                        width: 28, height: 28, borderRadius: '50%',
                                        marginLeft: i > 0 ? -8 : 0,
                                        border: '2px solid white',
                                        overflow: 'hidden',
                                        background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white', fontSize: '0.65rem', fontWeight: 700,
                                        flexShrink: 0,
                                        zIndex: visibleAvatars.length - i,
                                      }}
                                    >
                                      {avatarUrl ? (
                                        <img src={avatarUrl} alt={displayName}
                                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                      ) : (
                                        initials
                                      )}
                                    </div>
                                  )
                                })}
                                {extraCount > 0 && (
                                  <div style={{
                                    width: 28, height: 28, borderRadius: '50%',
                                    marginLeft: -8,
                                    border: '2px solid white',
                                    background: '#5a7478',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'white', fontSize: '0.65rem', fontWeight: 700,
                                    flexShrink: 0,
                                    zIndex: 0,
                                  }}>
                                    +{extraCount}
                                  </div>
                                )}
                              </div>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                stroke="#5a7478" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                style={{
                                  transition: 'transform 0.2s',
                                  transform: membersMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                }}>
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </button>
                          )
                        })()}

                        {/* Dropdown */}
                        {membersMenuOpen && (
                          <div style={{
                            position: 'absolute', top: '100%', right: 0,
                            background: 'white',
                            borderRadius: '0.85rem',
                            boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
                            border: '1px solid rgba(10,126,140,0.08)',
                            zIndex: 50, marginTop: 6,
                            minWidth: 280, maxWidth: 320,
                            overflow: 'hidden',
                          }}>
                            {/* Active members */}
                            {members.filter((m: any) => m.status === 'active').map((m: any, i: number, arr: any[]) => {
                              const isCreator   = m.user_id === sharedCase!.created_by
                              const displayName = (m.profile as any)?.full_name || m.email
                              const initials    = getInitials(displayName).slice(0, 2)
                              const avatarUrl   = (m.profile as any)?.avatar_url ?? null

                              return (
                                <div key={m.id} style={{
                                  display: 'flex', alignItems: 'center',
                                  gap: 10, padding: '10px 14px',
                                  borderBottom: i < arr.length - 1 || pendingMembers.length > 0 ? '1px solid rgba(10,126,140,0.06)' : 'none',
                                }}>
                                  {avatarUrl ? (
                                    <img src={avatarUrl} alt={displayName}
                                      style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                                    />
                                  ) : (
                                    <div style={{
                                      width: 28, height: 28, borderRadius: '50%',
                                      background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      color: 'white', fontSize: '0.65rem', fontWeight: 700,
                                      flexShrink: 0,
                                    }}>
                                      {initials}
                                    </div>
                                  )}
                                  <div style={{
                                    flex: 1, minWidth: 0,
                                    fontSize: '0.875rem', fontWeight: 600, color: '#1A1A2E',
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                  }}>
                                    {displayName}
                                  </div>
                                  {isCreator && (
                                    <span style={{
                                      fontSize: '0.6rem', fontWeight: 700,
                                      letterSpacing: '0.05em', textTransform: 'uppercase',
                                      background: 'rgba(10,126,140,0.08)', color: '#0A7E8C',
                                      borderRadius: 9999, padding: '2px 8px', flexShrink: 0,
                                    }}>
                                      Creador
                                    </span>
                                  )}
                                </div>
                              )
                            })}

                            {/* Pending members */}
                            {pendingMembers.map((pm: any, i: number) => (
                              <div key={pm.id} style={{
                                display: 'flex', alignItems: 'center',
                                gap: 10, padding: '10px 14px',
                                borderBottom: i < pendingMembers.length - 1 ? '1px solid rgba(10,126,140,0.06)' : 'none',
                              }}>
                                <div style={{
                                  width: 28, height: 28, borderRadius: '50%',
                                  background: 'rgba(232,145,58,0.12)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  flexShrink: 0,
                                }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                                    stroke="#E8913A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"/>
                                    <polyline points="12 6 12 12 16 14"/>
                                  </svg>
                                </div>
                                <div style={{
                                  flex: 1, minWidth: 0,
                                  fontSize: '0.875rem', fontWeight: 500, color: '#5a7478',
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                  {pm.email}
                                </div>
                                <span style={{
                                  fontSize: '0.6rem', fontWeight: 700,
                                  letterSpacing: '0.05em', textTransform: 'uppercase',
                                  background: 'rgba(232,145,58,0.12)', color: '#E8913A',
                                  borderRadius: 9999, padding: '2px 8px', flexShrink: 0,
                                }}>
                                  Pendiente
                                </span>
                              </div>
                            ))}

                            {/* Invitar */}
                            <button
                              type="button"
                              onClick={() => {
                                setMembersMenuOpen(false)
                                setInviteError(null)
                                setInviteEmail('')
                                setSsOpen(true)
                              }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                width: '100%', padding: '11px 14px',
                                background: 'rgba(10,126,140,0.04)',
                                border: 'none',
                                borderTop: '1px solid rgba(10,126,140,0.08)',
                                cursor: 'pointer',
                                fontSize: '0.875rem', fontWeight: 700,
                                color: '#0A7E8C', fontFamily: 'inherit',
                                transition: 'background 0.15s',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(10,126,140,0.08)' }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(10,126,140,0.04)' }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                              </svg>
                              Invitar persona
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Botón Invitar */}
                      <button
                        type="button"
                        onClick={() => {
                          setInviteError(null)
                          setInviteEmail('')
                          setSsOpen(true)
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          background: 'rgba(10,126,140,0.07)',
                          color: '#0A7E8C',
                          border: 'none',
                          borderRadius: 9999,
                          padding: '7px 14px',
                          fontSize: '0.8125rem', fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'inherit',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(10,126,140,0.14)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(10,126,140,0.07)' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24"
                          fill="none" stroke="currentColor"
                          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <line x1="19" y1="8" x2="19" y2="14" />
                          <line x1="22" y1="11" x2="16" y2="11" />
                        </svg>
                        Invitar
                      </button>

                      {/* Menú ⋯ */}
                      <div ref={headerMenuRef} style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={() => setHeaderMenuOpen(prev => !prev)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 34, height: 34,
                            background: headerMenuOpen ? 'rgba(10,126,140,0.14)' : 'rgba(10,126,140,0.07)',
                            color: '#5a7478',
                            border: 'none',
                            borderRadius: 9999,
                            cursor: 'pointer', fontFamily: 'inherit',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => {
                            if (!headerMenuOpen) e.currentTarget.style.background = 'rgba(10,126,140,0.14)'
                          }}
                          onMouseLeave={(e) => {
                            if (!headerMenuOpen) e.currentTarget.style.background = 'rgba(10,126,140,0.07)'
                          }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="1" />
                            <circle cx="19" cy="12" r="1" />
                            <circle cx="5" cy="12" r="1" />
                          </svg>
                        </button>

                        {headerMenuOpen && (
                          <div style={{
                            position: 'absolute', top: '100%', right: 0,
                            background: 'white',
                            borderRadius: '0.85rem',
                            boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
                            border: '1px solid rgba(10,126,140,0.08)',
                            zIndex: 50, marginTop: 6,
                            minWidth: 240, overflow: 'hidden',
                          }}>
                            {/* Cerrar / Reabrir tema */}
                            {sharedCase.status === 'activa' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setHeaderMenuOpen(false)
                                  setCloseModalOpen(true)
                                }}
                                style={{
                                  display: 'block', width: '100%',
                                  padding: '11px 18px', background: 'none',
                                  border: 'none', cursor: 'pointer',
                                  textAlign: 'left', fontSize: '0.875rem',
                                  color: '#ba1a1a', fontWeight: 600,
                                  fontFamily: 'inherit',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(186,26,26,0.06)' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                              >
                                Cerrar tema
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setHeaderMenuOpen(false)
                                  handleReopenCase()
                                }}
                                disabled={closingLoading}
                                style={{
                                  display: 'block', width: '100%',
                                  padding: '11px 18px', background: 'none',
                                  border: 'none', cursor: closingLoading ? 'not-allowed' : 'pointer',
                                  textAlign: 'left', fontSize: '0.875rem',
                                  color: '#0A7E8C', fontWeight: 600,
                                  fontFamily: 'inherit',
                                  opacity: closingLoading ? 0.6 : 1,
                                }}
                                onMouseEnter={e => { if (!closingLoading) e.currentTarget.style.background = 'rgba(10,126,140,0.06)' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                              >
                                {closingLoading ? 'Reabriendo…' : 'Reabrir tema'}
                              </button>
                            )}

                            <div style={{ height: 1, background: 'rgba(10,126,140,0.08)', margin: '4px 0' }} />

                            {/* Editar nombre y descripción — disabled */}
                            <div
                              title="Próximamente"
                              style={{
                                padding: '11px 18px',
                                fontSize: '0.875rem',
                                color: '#a0adb1',
                                cursor: 'not-allowed',
                                display: 'flex', alignItems: 'center',
                                justifyContent: 'space-between', gap: 8,
                              }}
                            >
                              <span>Editar nombre y descripción</span>
                              <span style={{
                                fontSize: '0.6rem', fontWeight: 700,
                                letterSpacing: '0.06em', textTransform: 'uppercase',
                                color: '#a0adb1',
                                background: 'rgba(160,173,177,0.12)',
                                padding: '2px 7px', borderRadius: 9999,
                              }}>
                                Pronto
                              </span>
                            </div>

                            {/* Abandonar tema — disabled */}
                            <div
                              title="Próximamente"
                              style={{
                                padding: '11px 18px',
                                fontSize: '0.875rem',
                                color: '#a0adb1',
                                cursor: 'not-allowed',
                                display: 'flex', alignItems: 'center',
                                justifyContent: 'space-between', gap: 8,
                              }}
                            >
                              <span>Abandonar tema</span>
                              <span style={{
                                fontSize: '0.6rem', fontWeight: 700,
                                letterSpacing: '0.06em', textTransform: 'uppercase',
                                color: '#a0adb1',
                                background: 'rgba(160,173,177,0.12)',
                                padding: '2px 7px', borderRadius: 9999,
                              }}>
                                Pronto
                              </span>
                            </div>

                            <div style={{ height: 1, background: 'rgba(10,126,140,0.08)', margin: '4px 0' }} />

                            {/* Borrar tema — disabled */}
                            <div
                              title="Próximamente"
                              style={{
                                padding: '11px 18px',
                                fontSize: '0.875rem',
                                color: '#a0adb1',
                                cursor: 'not-allowed',
                                display: 'flex', alignItems: 'center',
                                justifyContent: 'space-between', gap: 8,
                              }}
                            >
                              <span>Borrar tema</span>
                              <span style={{
                                fontSize: '0.6rem', fontWeight: 700,
                                letterSpacing: '0.06em', textTransform: 'uppercase',
                                color: '#a0adb1',
                                background: 'rgba(160,173,177,0.12)',
                                padding: '2px 7px', borderRadius: 9999,
                              }}>
                                Pronto
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
 

              {/* ── Lo que sé ────────────────────────────────────────── */}
              {myMember && (
                <div style={{ marginBottom: 32 }}>
                  <ContextStripDrawer
                    contextText={aiSummary || null}
                    onSendNovedad={(text) => handleChatSubmit(text)}
                    isSendingNovedad={isTyping}
                  />
                </div>
              )}

              {/* ── Nueva disposición ─────────────────────────────────── */}
              <div className="tema-layout" style={{
                display: 'grid',
                gridTemplateColumns: '3fr 2fr',
                gap: 24,
                alignItems: 'start',
                marginBottom: 32,
              }}>

                {/* ── Columna izquierda — Tareas + Documentos ───────── */}
                <div className="col-left" style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>

                  {/* ── Tareas ─────────────────────────────────────────── */}
                  <div className="order-1" style={{width: '100%'}}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 16,
                      gap: 12,
                    }}>
                      <p className="font-bold uppercase text-[#5a7478]"
                        style={{
                          fontSize: '0.875rem',
                          letterSpacing: '0.1em',
                          margin: 0,
                        }}>
                        Tareas
                        {(() => {
                          const activeCount = tasks.filter(t => t.status === 'pendiente').length
                          return activeCount > 0 ? (
                            <span style={{
                              marginLeft: 8,
                              color: '#5a7478',
                              fontWeight: 700,
                              fontSize: '0.8125rem',
                              letterSpacing: '0.05em',
                            }}>
                              · {activeCount}
                            </span>
                          ) : null
                        })()}
                      </p>

                      {tasks.filter(t => t.status === 'completada').length > 0 && (
                        <button
                          type="button"
                          onClick={() => setDoneTasksSheetOpen(true)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: '#0A7E8C',
                            fontFamily: 'inherit',
                            letterSpacing: '0.02em',
                            textTransform: 'uppercase',
                            padding: '4px 0',
                            transition: 'color 0.15s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#065e6a' }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = '#0A7E8C' }}
                        >
                          Ver finalizadas
                        </button>
                      )}
                    </div>
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
                            return (
                              <div
                                key={t.id}
                                className="flex items-center cursor-pointer rounded-md"
                                onClick={() => router.push(`/case/shared/${id}/tarea/${t.id}`)}
                                style={{
                                  gap: 14, padding: '13px 6px',
                                  borderBottom: i < arr.length - 1 ? '1px solid rgba(10,126,140,0.12)' : 'none',
                                  margin: '0 -6px', transition: 'background 0.15s',
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(61,199,166,0.07)' }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                              >
                                <div className="flex-1 min-w-0">
                                  <div style={{ fontSize: '0.875rem', color: '#1A1A2E', fontWeight: 600 }}>
                                    {t.title}
                                  </div>
                                  <div style={{ fontSize: '0.7rem', color: '#5a7478', marginTop: 2 }}>
                                    {t.due_date ? `Vence el ${fmtLongDate(t.due_date)}` : 'Sin fecha'}
                                  </div>
                                </div>
                                {(taskDocCounts.get(t.id) ?? 0) > 0 && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                                      stroke="#5a7478" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                      <polyline points="14 2 14 8 20 8" />
                                    </svg>
                                    {(taskDocCounts.get(t.id) ?? 0) > 1 && (
                                      <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#5a7478' }}>
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
                          onClick={() => router.push(`/case/shared/${id}/tarea/nueva`)}
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

                  {/* ── Documentos ─────────────────────────────────────── */}
                  <div className="order-3" style={{width: '100%'}}>
                    <p className="font-bold uppercase"
                      style={{
                        fontSize: '0.75rem',
                        letterSpacing: '0.1em',
                        color: '#5a7478',
                        marginBottom: 12,
                      }}>
                      Documentos
                    </p>
                    <Card variant="outlined">
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
                                onClick={() => router.push(`/case/shared/${id}/documento/${d.id}`)}
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
                        <button type="button" onClick={() => router.push(`/case/shared/${id}/documento/nuevo`)}
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

                  {/* ── Historia (L3 — ghost) ─────────────────────────── */}
                  <div className="order-4" style={{width: '100%'}}>
                    <p className="font-bold uppercase"
                      style={{
                        fontSize: '0.75rem',
                        letterSpacing: '0.1em',
                        color: '#5a7478', 
                        marginBottom: 12,
                      }}>
                      Historia
                    </p>
                    <div style={{
                      border: '0.5px solid rgba(10,126,140,0.08)',
                      padding: '16px 14px', 
                      borderRadius: '1rem',
                    }}> 
                      {history.length === 0 ? (
                        <p style={{
                          fontSize: '0.8125rem',
                          color: 'rgba(90,116,120,0.7)',
                          fontStyle: 'italic',
                          margin: 0,
                        }}>
                          Sin historial todavía.
                        </p>
                      ) : (
                        <>
                          {history.slice(0, 5).map((h) => (
                            <div key={h.id} style={{
                              padding: '6px 0',
                            }}>
                              <div className="font-semibold text-[#1A1A2E]"
                                style={{ fontSize: '0.8125rem', marginBottom: 2 }}>
                                {h.title}
                              </div>
                              {h.description && (
                                <div style={{
                                  fontSize: '0.75rem',
                                  color: 'rgba(90,116,120,0.85)',
                                  marginBottom: 2,
                                }}>
                                  {h.task_id ? (
                                    <span>
                                      {h.description.replace(/"([^"]+)"/, '').trim()}{' '}
                                      <span
                                        onClick={() => router.push(`/case/shared/${id}/tarea/${h.task_id}`)}
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
                                        onClick={() => router.push(`/case/shared/${id}/documento/${h.document_id}`)}
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
                              <div style={{
                                fontSize: '0.625rem',
                                color: 'rgba(90,116,120,0.7)',
                              }}>
                                {fmtLongDate(h.occurred_at)}
                              </div>
                            </div>
                          ))}

                          {history.length > 5 && (
                            <button
                              type="button"
                              onClick={() => setHistorySheetOpen(true)}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '0.625rem',
                                fontWeight: 700,
                                color: 'rgba(90,116,120,0.7)',
                                fontFamily: 'inherit',
                                letterSpacing: '0.05em',
                                textTransform: 'uppercase',
                                padding: '8px 0 0',
                                transition: 'color 0.15s',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = '#0A7E8C' }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(90,116,120,0.7)' }}
                            >
                              Ver más
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                </div>

                {/* ── Columna derecha — Conversaciones ──────────── */}
                <div className="col-right" style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>

                  {/* ── Conversaciones ─────────────────────────────── */}
                  <div className="order-2" style={{width: '100%'}}>
                    <SectionTitle>Conversaciones</SectionTitle>
                <Card style={{ padding: 0 }}>
                  {threadError && (
                    <div style={{
                      margin: 16, padding: '10px 14px',
                      borderRadius: '0.75rem',
                      background: 'rgba(186,26,26,0.07)',
                      border: '1px solid rgba(186,26,26,0.18)',
                      fontSize: '0.8125rem', color: '#ba1a1a', fontWeight: 600,
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', gap: 8,
                    }}>
                      <span>{threadError}</span>
                      <button
                        onClick={() => setThreadError(null)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: '#ba1a1a', fontSize: '1rem', lineHeight: 1, flexShrink: 0,
                        }}
                      >✕</button>
                    </div>
                  )}

                  {threadsLoading ? (
                    <p style={{
                      fontSize: '0.875rem', color: '#5a7478',
                      textAlign: 'center', padding: '32px 0', margin: 0,
                    }}>
                      Cargando…
                    </p>
                  ) : threads.length === 0 ? (
                    <p style={{
                      fontSize: '0.875rem', color: '#5a7478',
                      fontStyle: 'italic',
                      textAlign: 'center', padding: '32px 24px', margin: 0,
                    }}>
                      Sin comentarios todavía. Empezá la conversación.
                    </p>
                  ) : (
                    <div>
                      {threads.map((t, i) => {
                        const isOwn       = t.author_id === myMember?.user_id
                        const displayName = t.author?.full_name ?? 'Usuario'
                        const initials    = getInitials(displayName).slice(0, 2)
                        const avatarUrl   = t.author?.avatar_url ?? null
                        const wasEdited   = t.updated_at !== t.created_at
                        const isEditing   = editingThreadId === t.id

                        return (
                          <div key={t.id}
                            onClick={() => { if (!isEditing) handleOpenThread(t) }}
                            style={{
                              padding: '16px 20px',
                              borderBottom: i < threads.length - 1 ? '1px solid rgba(10,126,140,0.08)' : 'none',
                              cursor: isEditing ? 'default' : 'pointer',
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={(e) => { if (!isEditing) e.currentTarget.style.background = 'rgba(61,199,166,0.04)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                          >
                            {/* Header del hilo */}
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              marginBottom: 8,
                            }}>
                              {avatarUrl ? (
                                <img src={avatarUrl} alt={displayName}
                                  style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                                />
                              ) : (
                                <div style={{
                                  width: 32, height: 32, borderRadius: '50%',
                                  background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: 'white', fontSize: '0.7rem', fontWeight: 700,
                                  flexShrink: 0,
                                }}>
                                  {initials}
                                </div>
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1A1A2E' }}>
                                  {displayName}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#5a7478' }}>
                                  {formatRelativeTime(t.created_at)}
                                  {wasEdited && <span style={{ marginLeft: 6, fontStyle: 'italic' }}>(editado)</span>}
                                </div>
                              </div>
                              {isOwn && !isEditing && (
                                <div style={{ position: 'relative', flexShrink: 0 }}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setOpenMenuId(openMenuId === t.id ? null : t.id)
                                    }}
                                    style={{
                                      background: 'none', border: 'none',
                                      cursor: 'pointer', padding: 4, color: '#5a7478',
                                      display: 'flex', alignItems: 'center',
                                      borderRadius: '0.4rem',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)' }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                                  >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <circle cx="12" cy="12" r="1" />
                                      <circle cx="12" cy="5"  r="1" />
                                      <circle cx="12" cy="19" r="1" />
                                    </svg>
                                  </button>
                                  {openMenuId === t.id && (
                                    <>
                                      <div
                                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(null) }}
                                        style={{ position: 'fixed', inset: 0, zIndex: 100 }}
                                      />
                                      <div style={{
                                        position: 'absolute', top: '100%', right: 0,
                                        background: 'white',
                                        borderRadius: '0.75rem',
                                        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                                        border: '1px solid rgba(10,126,140,0.08)',
                                        zIndex: 101, marginTop: 4,
                                        minWidth: 140, overflow: 'hidden',
                                      }}>
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); handleStartEditThread(t) }}
                                          style={{
                                            display: 'block', width: '100%',
                                            padding: '10px 16px', background: 'none',
                                            border: 'none', cursor: 'pointer',
                                            textAlign: 'left', fontSize: '0.875rem',
                                            color: '#1A1A2E', fontFamily: 'inherit',
                                          }}
                                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(10,126,140,0.06)' }}
                                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                                        >
                                          Editar
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setOpenMenuId(null)
                                            setDeleteTarget({ type: 'thread', id: t.id })
                                          }}
                                          style={{
                                            display: 'block', width: '100%',
                                            padding: '10px 16px', background: 'none',
                                            border: 'none', cursor: 'pointer',
                                            textAlign: 'left', fontSize: '0.875rem',
                                            color: '#ba1a1a', fontFamily: 'inherit',
                                          }}
                                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(186,26,26,0.06)' }}
                                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                                        >
                                          Borrar
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Contenido del hilo */}
                            {isEditing ? (
                              <div style={{ marginLeft: 42 }}>
                                <textarea
                                  value={editingDraft}
                                  onChange={(e) => setEditingDraft(e.target.value)}
                                  rows={3}
                                  maxLength={2000}
                                  style={{
                                    width: '100%', boxSizing: 'border-box',
                                    border: '1.5px solid rgba(10,126,140,0.18)',
                                    borderRadius: '0.75rem', padding: '10px 12px',
                                    fontSize: '0.875rem', color: '#1A1A2E',
                                    fontFamily: 'inherit', outline: 'none',
                                    background: '#FAF8F5', lineHeight: 1.5,
                                    resize: 'vertical', minHeight: 70,
                                  }}
                                />
                                <div style={{
                                  display: 'flex', gap: 8, marginTop: 8,
                                  justifyContent: 'flex-end',
                                }}>
                                  <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    disabled={editingSaving}
                                    style={{
                                      background: 'transparent', color: '#5a7478',
                                      border: '1.5px solid rgba(90,116,120,0.3)',
                                      borderRadius: 9999, padding: '6px 16px',
                                      fontSize: '0.8125rem', fontWeight: 600,
                                      cursor: editingSaving ? 'not-allowed' : 'pointer',
                                      fontFamily: 'inherit',
                                    }}
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleSaveEditThread}
                                    disabled={editingSaving || !editingDraft.trim()}
                                    style={{
                                      background: editingSaving || !editingDraft.trim()
                                        ? 'rgba(10,126,140,0.35)'
                                        : 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                                      color: 'white', border: 'none',
                                      borderRadius: 9999, padding: '7px 18px',
                                      fontSize: '0.8125rem', fontWeight: 700,
                                      cursor: editingSaving || !editingDraft.trim() ? 'not-allowed' : 'pointer',
                                      fontFamily: 'inherit',
                                    }}
                                  >
                                    {editingSaving ? 'Guardando…' : 'Guardar'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ marginLeft: 42 }}>
                                <p style={{
                                  fontSize: '0.9375rem', color: '#1A1A2E',
                                  lineHeight: 1.55, margin: 0,
                                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                }}>
                                  {linkifyText(t.content)}
                                </p>

                                {t.reply_count > 0 && (
                                  <div style={{
                                    display: 'inline-flex', alignItems: 'center',
                                    gap: 6, marginTop: 10,
                                    padding: '5px 12px',
                                    borderRadius: 9999,
                                    background: 'rgba(10,126,140,0.06)',
                                    color: '#0A7E8C',
                                    fontSize: '0.75rem', fontWeight: 700,
                                  }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                    </svg>
                                    <span>
                                      {t.reply_count} {t.reply_count === 1 ? 'respuesta' : 'respuestas'}
                                      {t.last_reply_at && ` · última ${formatRelativeTime(t.last_reply_at)}`}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Input inline — crear hilo nuevo */}
                  <div style={{
                    borderTop: threads.length > 0 || threadsLoading ? '1px solid rgba(10,126,140,0.12)' : 'none',
                    padding: '14px 20px',
                  }}>
                    <textarea
                      value={newThreadContent}
                      onChange={(e) => setNewThreadContent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault()
                          handleCreateThread()
                        }
                      }}
                      placeholder="Escribí un comentario para empezar una conversación…"
                      rows={2}
                      maxLength={2000}
                      disabled={threadSubmitting}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        border: '1.5px solid rgba(10,126,140,0.12)',
                        borderRadius: '0.75rem', padding: '10px 14px',
                        fontSize: '0.875rem', color: '#1A1A2E',
                        fontFamily: 'inherit', outline: 'none',
                        background: '#FAF8F5', lineHeight: 1.5,
                        resize: 'vertical', minHeight: 56,
                        display: 'block', marginBottom: 10,
                      }}
                    />
                    <div style={{
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', gap: 12,
                    }}>
                      <span style={{ fontSize: '0.7rem', color: '#5a7478' }}>
                        {newThreadContent.length}/2000 · Cmd/Ctrl + Enter para enviar
                      </span>
                      <button
                        type="button"
                        onClick={handleCreateThread}
                        disabled={threadSubmitting || !newThreadContent.trim()}
                        style={{
                          background: threadSubmitting || !newThreadContent.trim()
                            ? 'rgba(10,126,140,0.35)'
                            : 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                          color: 'white', border: 'none',
                          borderRadius: 9999, padding: '8px 20px',
                          fontSize: '0.875rem', fontWeight: 700,
                          cursor: threadSubmitting || !newThreadContent.trim() ? 'not-allowed' : 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        {threadSubmitting ? 'Publicando…' : 'Publicar'}
                      </button>
                    </div>
                  </div>
                </Card>
                  </div>

                </div>

              </div>

            </>
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
              Lo voy a marcar como resuelto para todos los miembros.
              No va a aparecer más en el listado, pero cualquier
              miembro puede reabrirlo cuando quiera.
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

      {/* ── Modal: borrar comentario ─────────────────────── */}
      {deleteTarget && (
        <>
          <div
            onClick={() => !deleting && setDeleteTarget(null)}
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
              {deleteTarget.type === 'thread'
                ? '¿Borrar este comentario?'
                : '¿Borrar esta respuesta?'}
            </p>
            <p style={{
              fontSize: '0.875rem', color: '#5a7478',
              lineHeight: 1.6, marginBottom: 24,
            }}>
              {deleteTarget.type === 'thread'
                ? 'Se va a borrar el comentario y todas sus respuestas. Esta acción no se puede deshacer.'
                : 'Se va a borrar la respuesta. Esta acción no se puede deshacer.'}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                style={{
                  flex: 1, padding: '11px 0',
                  background: 'rgba(10,126,140,0.07)',
                  color: '#0A7E8C', border: 'none', borderRadius: 9999,
                  fontWeight: 700, fontSize: '0.875rem',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: deleting ? 0.5 : 1,
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                style={{
                  flex: 1, padding: '11px 0',
                  background: deleting
                    ? 'rgba(186,26,26,0.06)' : 'rgba(186,26,26,0.10)',
                  color: '#ba1a1a', border: 'none', borderRadius: 9999,
                  fontWeight: 700, fontSize: '0.875rem',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  opacity: deleting ? 0.6 : 1,
                  fontFamily: 'inherit',
                }}
              >
                {deleting ? 'Borrando…' : 'Borrar'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════
          SIDESHEET — HILO DE CONVERSACIÓN
      ══════════════════════════════════════════════════════════════ */}

      {/* Overlay */}
      <div
        onClick={handleCloseThreadSheet}
        style={{
          position:      'fixed',
          inset:         0,
          background:    'rgba(0,0,0,0.22)',
          zIndex:        500,
          opacity:       threadSheetOpen ? 1 : 0,
          pointerEvents: threadSheetOpen ? 'auto' : 'none',
          transition:    'opacity 0.3s',
        }}
      />

      {/* Panel */}
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
          transform:     threadSheetOpen ? 'translateX(0)' : 'translateX(100%)',
          transition:    'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
          display:       'flex',
          flexDirection: 'column',
          boxShadow:     '-6px 0 32px rgba(0,0,0,0.10)',
        }}
      >
        {/* Top bar */}
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
            Conversación
          </span>
          <button
            onClick={handleCloseThreadSheet}
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

        {/* Scrollable body: thread raíz + replies */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {currentThread && (() => {
            const t = currentThread
            const isOwn = t.author_id === myMember?.user_id
            const displayName = t.author?.full_name ?? 'Usuario'
            const initials = getInitials(displayName).slice(0, 2)
            const avatarUrl = t.author?.avatar_url ?? null
            const wasEdited = t.updated_at !== t.created_at

            return (
              <div style={{
                background: '#FFFFFF', borderRadius: '1rem',
                padding: '16px 18px', marginBottom: 20,
                border: '1px solid rgba(10,126,140,0.10)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName}
                      style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                    }}>
                      {initials}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1A1A2E' }}>
                      {displayName}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#5a7478' }}>
                      {formatRelativeTime(t.created_at)}
                      {wasEdited && <span style={{ marginLeft: 6, fontStyle: 'italic' }}>(editado)</span>}
                    </div>
                  </div>
                  {isOwn && editingThreadId !== t.id && (
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenuId(openMenuId === t.id ? null : t.id)
                        }}
                        style={{
                          background: 'none', border: 'none',
                          cursor: 'pointer', padding: 4, color: '#5a7478',
                          borderRadius: '0.4rem',
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="1" />
                          <circle cx="12" cy="5"  r="1" />
                          <circle cx="12" cy="19" r="1" />
                        </svg>
                      </button>
                      {openMenuId === t.id && (
                        <>
                          <div
                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(null) }}
                            style={{ position: 'fixed', inset: 0, zIndex: 510 }}
                          />
                          <div style={{
                            position: 'absolute', top: '100%', right: 0,
                            background: 'white', borderRadius: '0.75rem',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                            border: '1px solid rgba(10,126,140,0.08)',
                            zIndex: 511, marginTop: 4,
                            minWidth: 140, overflow: 'hidden',
                          }}>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleStartEditThread(t) }}
                              style={{
                                display: 'block', width: '100%',
                                padding: '10px 16px', background: 'none',
                                border: 'none', cursor: 'pointer',
                                textAlign: 'left', fontSize: '0.875rem',
                                color: '#1A1A2E', fontFamily: 'inherit',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(10,126,140,0.06)' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setOpenMenuId(null)
                                setDeleteTarget({ type: 'thread', id: t.id })
                              }}
                              style={{
                                display: 'block', width: '100%',
                                padding: '10px 16px', background: 'none',
                                border: 'none', cursor: 'pointer',
                                textAlign: 'left', fontSize: '0.875rem',
                                color: '#ba1a1a', fontFamily: 'inherit',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(186,26,26,0.06)' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                            >
                              Borrar
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {editingThreadId === t.id ? (
                  <div>
                    <textarea
                      value={editingDraft}
                      onChange={(e) => setEditingDraft(e.target.value)}
                      rows={3} maxLength={2000}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        border: '1.5px solid rgba(10,126,140,0.18)',
                        borderRadius: '0.75rem', padding: '10px 12px',
                        fontSize: '0.875rem', color: '#1A1A2E',
                        fontFamily: 'inherit', outline: 'none',
                        background: '#FAF8F5', lineHeight: 1.5,
                        resize: 'vertical', minHeight: 70,
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                      <button type="button" onClick={handleCancelEdit} disabled={editingSaving}
                        style={{
                          background: 'transparent', color: '#5a7478',
                          border: '1.5px solid rgba(90,116,120,0.3)',
                          borderRadius: 9999, padding: '6px 16px',
                          fontSize: '0.8125rem', fontWeight: 600,
                          cursor: editingSaving ? 'not-allowed' : 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >Cancelar</button>
                      <button type="button" onClick={handleSaveEditThread}
                        disabled={editingSaving || !editingDraft.trim()}
                        style={{
                          background: editingSaving || !editingDraft.trim()
                            ? 'rgba(10,126,140,0.35)' : 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                          color: 'white', border: 'none',
                          borderRadius: 9999, padding: '7px 18px',
                          fontSize: '0.8125rem', fontWeight: 700,
                          cursor: editingSaving || !editingDraft.trim() ? 'not-allowed' : 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >{editingSaving ? 'Guardando…' : 'Guardar'}</button>
                    </div>
                  </div>
                ) : (
                  <p style={{
                    fontSize: '0.9375rem', color: '#1A1A2E',
                    lineHeight: 1.55, margin: 0,
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    {linkifyText(t.content)}
                  </p>
                )}
              </div>
            )
          })()}

          {replyError && (
            <div style={{
              marginBottom: 12, padding: '10px 14px',
              borderRadius: '0.75rem',
              background: 'rgba(186,26,26,0.07)',
              border: '1px solid rgba(186,26,26,0.18)',
              fontSize: '0.8125rem', color: '#ba1a1a', fontWeight: 600,
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', gap: 8,
            }}>
              <span>{replyError}</span>
              <button
                onClick={() => setReplyError(null)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#ba1a1a', fontSize: '1rem', lineHeight: 1, flexShrink: 0,
                }}
              >✕</button>
            </div>
          )}

          {repliesLoading ? (
            <p style={{
              fontSize: '0.8125rem', color: '#5a7478',
              textAlign: 'center', padding: '16px 0', margin: 0,
            }}>
              Cargando respuestas…
            </p>
          ) : replies.length === 0 ? (
            <p style={{
              fontSize: '0.8125rem', color: '#5a7478',
              fontStyle: 'italic', textAlign: 'center',
              padding: '16px 0', margin: 0,
            }}>
              Todavía no hay respuestas.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {replies.map((r) => {
                const isOwn = r.author_id === myMember?.user_id
                const displayName = r.author?.full_name ?? 'Usuario'
                const initials = getInitials(displayName).slice(0, 2)
                const avatarUrl = r.author?.avatar_url ?? null
                const wasEdited = r.updated_at !== r.created_at
                const isEditing = editingReplyId === r.id

                return (
                  <div key={r.id} style={{
                    background: '#FFFFFF', borderRadius: '0.85rem',
                    padding: '12px 14px',
                    border: '1px solid rgba(10,126,140,0.06)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={displayName}
                          style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                        />
                      ) : (
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', fontSize: '0.65rem', fontWeight: 700, flexShrink: 0,
                        }}>
                          {initials}
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1A1A2E' }}>
                          {displayName}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#5a7478' }}>
                          {formatRelativeTime(r.created_at)}
                          {wasEdited && <span style={{ marginLeft: 6, fontStyle: 'italic' }}>(editado)</span>}
                        </div>
                      </div>
                      {isOwn && !isEditing && (
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenReplyMenuId(openReplyMenuId === r.id ? null : r.id)
                            }}
                            style={{
                              background: 'none', border: 'none',
                              cursor: 'pointer', padding: 4, color: '#5a7478',
                              borderRadius: '0.4rem',
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="1" />
                              <circle cx="12" cy="5"  r="1" />
                              <circle cx="12" cy="19" r="1" />
                            </svg>
                          </button>
                          {openReplyMenuId === r.id && (
                            <>
                              <div
                                onClick={(e) => { e.stopPropagation(); setOpenReplyMenuId(null) }}
                                style={{ position: 'fixed', inset: 0, zIndex: 510 }}
                              />
                              <div style={{
                                position: 'absolute', top: '100%', right: 0,
                                background: 'white', borderRadius: '0.75rem',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                                border: '1px solid rgba(10,126,140,0.08)',
                                zIndex: 511, marginTop: 4,
                                minWidth: 140, overflow: 'hidden',
                              }}>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleStartEditReply(r) }}
                                  style={{
                                    display: 'block', width: '100%',
                                    padding: '10px 16px', background: 'none',
                                    border: 'none', cursor: 'pointer',
                                    textAlign: 'left', fontSize: '0.875rem',
                                    color: '#1A1A2E', fontFamily: 'inherit',
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(10,126,140,0.06)' }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setOpenReplyMenuId(null)
                                    setDeleteTarget({ type: 'reply', id: r.id })
                                  }}
                                  style={{
                                    display: 'block', width: '100%',
                                    padding: '10px 16px', background: 'none',
                                    border: 'none', cursor: 'pointer',
                                    textAlign: 'left', fontSize: '0.875rem',
                                    color: '#ba1a1a', fontFamily: 'inherit',
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(186,26,26,0.06)' }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                                >
                                  Borrar
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <div>
                        <textarea
                          value={editingReplyDraft}
                          onChange={(e) => setEditingReplyDraft(e.target.value)}
                          rows={3} maxLength={2000}
                          style={{
                            width: '100%', boxSizing: 'border-box',
                            border: '1.5px solid rgba(10,126,140,0.18)',
                            borderRadius: '0.6rem', padding: '8px 10px',
                            fontSize: '0.8125rem', color: '#1A1A2E',
                            fontFamily: 'inherit', outline: 'none',
                            background: '#FAF8F5', lineHeight: 1.5,
                            resize: 'vertical', minHeight: 60,
                          }}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 6, justifyContent: 'flex-end' }}>
                          <button type="button" onClick={handleCancelEditReply}
                            disabled={editingReplySaving}
                            style={{
                              background: 'transparent', color: '#5a7478',
                              border: '1.5px solid rgba(90,116,120,0.3)',
                              borderRadius: 9999, padding: '5px 14px',
                              fontSize: '0.75rem', fontWeight: 600,
                              cursor: editingReplySaving ? 'not-allowed' : 'pointer',
                              fontFamily: 'inherit',
                            }}
                          >Cancelar</button>
                          <button type="button" onClick={handleSaveEditReply}
                            disabled={editingReplySaving || !editingReplyDraft.trim()}
                            style={{
                              background: editingReplySaving || !editingReplyDraft.trim()
                                ? 'rgba(10,126,140,0.35)' : 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                              color: 'white', border: 'none',
                              borderRadius: 9999, padding: '6px 16px',
                              fontSize: '0.75rem', fontWeight: 700,
                              cursor: editingReplySaving || !editingReplyDraft.trim() ? 'not-allowed' : 'pointer',
                              fontFamily: 'inherit',
                            }}
                          >{editingReplySaving ? 'Guardando…' : 'Guardar'}</button>
                        </div>
                      </div>
                    ) : (
                      <p style={{
                        fontSize: '0.875rem', color: '#1A1A2E',
                        lineHeight: 1.5, margin: 0,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}>
                        {linkifyText(r.content)}
                      </p>
                    )}
                  </div>
                )
              })}
              <div ref={repliesEndRef} />
            </div>
          )}
        </div>

        {/* Footer: textarea para responder */}
        <div style={{
          borderTop: '1px solid rgba(10,126,140,0.12)',
          padding: '14px 20px', flexShrink: 0,
          background: '#FFFFFF',
        }}>
          <textarea
            value={replyInput}
            onChange={(e) => setReplyInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                handleCreateReply()
              }
            }}
            placeholder="Escribí una respuesta…"
            rows={2} maxLength={2000}
            disabled={replySubmitting}
            style={{
              width: '100%', boxSizing: 'border-box',
              border: '1.5px solid rgba(10,126,140,0.12)',
              borderRadius: '0.75rem', padding: '10px 14px',
              fontSize: '0.875rem', color: '#1A1A2E',
              fontFamily: 'inherit', outline: 'none',
              background: '#FAF8F5', lineHeight: 1.5,
              resize: 'vertical', minHeight: 56,
              display: 'block', marginBottom: 8,
            }}
          />
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 12,
          }}>
            <span style={{ fontSize: '0.65rem', color: '#5a7478' }}>
              {replyInput.length}/2000 · Cmd/Ctrl + Enter
            </span>
            <button
              type="button"
              onClick={handleCreateReply}
              disabled={replySubmitting || !replyInput.trim()}
              style={{
                background: replySubmitting || !replyInput.trim()
                  ? 'rgba(10,126,140,0.35)' : 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                color: 'white', border: 'none',
                borderRadius: 9999, padding: '7px 18px',
                fontSize: '0.8125rem', fontWeight: 700,
                cursor: replySubmitting || !replyInput.trim() ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {replySubmitting ? 'Enviando…' : 'Responder'}
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SIDESHEET — HISTORIA COMPLETA
      ══════════════════════════════════════════════════════════════ */}

      {/* Overlay */}
      <div
        onClick={() => setHistorySheetOpen(false)}
        style={{
          position:      'fixed',
          inset:         0,
          background:    'rgba(0,0,0,0.22)',
          zIndex:        700,
          opacity:       historySheetOpen ? 1 : 0,
          pointerEvents: historySheetOpen ? 'auto' : 'none',
          transition:    'opacity 0.3s',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position:      'fixed',
          top:           0,
          right:         0,
          width:         480,
          maxWidth:      '100vw',
          height:        '100vh',
          background:    '#f0f4f8',
          zIndex:        701,
          transform:     historySheetOpen ? 'translateX(0)' : 'translateX(100%)',
          transition:    'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
          display:       'flex',
          flexDirection: 'column',
          boxShadow:     '-6px 0 32px rgba(0,0,0,0.10)',
        }}
      >
        {/* Top bar */}
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

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {history.map((h, i) => (
            <div key={h.id} style={{
              padding: '16px 24px',
              borderBottom: i < history.length - 1 ? '1px solid rgba(10,126,140,0.08)' : 'none',
            }}>
              <div className="font-semibold text-[#1A1A2E]" style={{ fontSize: '0.875rem', marginBottom: 2 }}>
                {h.title}
              </div>
              {h.description && (
                <div style={{ fontSize: '0.8125rem', color: '#5a7478', marginBottom: 4 }}>
                  {h.task_id ? (
                    <span>
                      {h.description.replace(/"([^"]+)"/, '').trim()}{' '}
                      <span
                        onClick={() => {
                          setHistorySheetOpen(false)
                          router.push(`/case/shared/${id}/tarea/${h.task_id}`)
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
                          router.push(`/case/shared/${id}/documento/${h.document_id}`)
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
          zIndex:        700,
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
          zIndex:        701,
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
                    router.push(`/case/shared/${id}/tarea/${t.id}`)
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
