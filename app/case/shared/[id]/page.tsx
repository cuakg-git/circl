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

  // ── Remove pending modal ─────────────────────────────────────────────────────
  const [removePendingId,  setRemovePendingId]  = useState<string | null>(null)
  const [removingPending,  setRemovingPending]  = useState(false)

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

  // ── Initialize chat on mount ───────────────────────────────────────────────────

  useEffect(() => {
    if (sharedCase && myMember && !loading) {
      handleOpenChat()
    }
  }, [sharedCase, myMember, loading])

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
          .tema-layout { grid-template-columns: 1fr !important; }
          .tareas-docs-grid { grid-template-columns: 1fr !important; }
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
              {/* ── Header ────────────────────────────────────────────── */}
              <div style={{ marginBottom: 32 }}> 
 
                <h1 className="font-extrabold text-[#1A1A2E]"
                  style={{ fontSize: '2rem', letterSpacing: '-0.03em', marginBottom: 6, lineHeight: 1.15 }}>
                  {sharedCase.name}
                </h1>
 
              </div>
 

              {/* ── Lo que sé ────────────────────────────────────────── */}
              {myMember && (
                <div style={{ marginBottom: 32 }}> 
                  <div style={{
                    background: '#FFFFFF',
                    borderRadius: '1.5rem',
                    boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                    marginTop: 20, overflow: 'hidden',
                    textAlign: 'left',
                  }}>
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
                    <Card>
                      {!chatOpen ? (
                        <>
                          {ctxEditing ? (
                            /* ── Edit mode ── */
                            <>
                              <textarea
                                value={personalCtx}
                                onChange={(e) => setPersonalCtx(e.target.value)}
                                placeholder="Agregá tu contexto personal sobre este tema…"
                                rows={4}
                                style={{
                                  width: '100%', boxSizing: 'border-box',
                                  resize: 'vertical', minHeight: 96,
                                  border: '1.5px solid rgba(10,126,140,0.18)',
                                  borderRadius: '0.75rem', padding: '12px',
                                  fontSize: '0.875rem', color: '#1A1A2E',
                                  fontFamily: 'inherit', outline: 'none',
                                  background: '#FAF8F5', lineHeight: 1.6,
                                  display: 'block', marginBottom: 12,
                                }}
                              />
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
                                {ctxSaved && (
                                  <span style={{ fontSize: '0.8125rem', color: '#0a6e5a', fontWeight: 600 }}>
                                    Guardado ✓
                                  </span>
                                )}
                                <button
                                  onClick={() => setCtxEditing(false)}
                                  style={{
                                    background: 'transparent', color: '#5a7478',
                                    border: '1.5px solid rgba(90,116,120,0.3)', borderRadius: 9999,
                                    padding: '7px 18px', fontSize: '0.875rem', fontWeight: 600,
                                    cursor: 'pointer', fontFamily: 'inherit',
                                  }}
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={handleSavePersonalContext}
                                  disabled={ctxSaving}
                                  style={{
                                    background: ctxSaving ? 'rgba(10,126,140,0.35)' : 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                                    color: '#ffffff', border: 'none', borderRadius: 9999,
                                    padding: '8px 20px', fontSize: '0.875rem', fontWeight: 700,
                                    cursor: ctxSaving ? 'not-allowed' : 'pointer',
                                    fontFamily: 'inherit', transition: 'opacity 0.15s',
                                  }}
                                >
                                  {ctxSaving ? 'Guardando…' : 'Guardar'}
                                </button>
                              </div>
                            </>
                          ) : (
                            /* ── View mode ── */
                            <>
                              <p style={{
                                fontSize: '0.9375rem',
                                color: personalCtx ? '#1A1A2E' : '#5a7478',
                                lineHeight: 1.7, whiteSpace: 'pre-wrap',
                                margin: '0 0 16px',
                                fontStyle: personalCtx ? 'normal' : 'italic',
                              }}>
                                {personalCtx || 'Todavía no agregaste contexto personal.'}
                              </p>
                            </>
                          )}
                        </>
                      ) : (
                        /* ── Chat mode ── */
                        <div>
                          {/* Contexto actual como referencia */}
                          {aiSummary && (
                            <p style={{
                              fontSize: '0.875rem', color: '#5a7478',
                              fontStyle: 'italic', lineHeight: 1.65,
                              margin: '0 0 16px', textAlign: 'left',
                            }}>
                              {aiSummary}
                            </p>
                          )}

                          {chatDone ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <p style={{
                                fontSize: '0.8125rem', color: '#5a7478',
                                fontStyle: 'italic', margin: 0, flex: 1, textAlign: 'left',
                              }}>
                                Contexto actualizado. Podés cerrar este chat.
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setChatOpen(false)
                                  setChatDone(false)
                                  setChatMsgs([])
                                }}
                                style={{
                                  padding: '6px 14px', borderRadius: 9999,
                                  border: '1.5px solid rgba(10,126,140,0.25)',
                                  background: 'white', color: '#0A7E8C',
                                  fontSize: '0.8125rem', fontWeight: 600,
                                  cursor: 'pointer', flexShrink: 0,
                                  fontFamily: 'inherit',
                                }}
                              >
                                Cerrar
                              </button>
                            </div>
                          ) : (
                            <>
                              {/* Pregunta actual */}
                              {isTyping ? (
                                <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 16 }}>
                                  {[0, 1, 2].map(i => (
                                    <span key={i} style={{
                                      width: 7, height: 7, borderRadius: '50%',
                                      background: '#0A7E8C', display: 'inline-block',
                                      animation: `typingDot 1.2s ease-in-out ${i * 0.2}s infinite`,
                                    }} />
                                  ))}
                                </div>
                              ) : chatQuestion && (
                                <p style={{
                                  fontSize: '0.875rem', fontWeight: 600,
                                  color: '#1A1A2E', marginBottom: 12, marginTop: 0,
                                  textAlign: 'left',
                                }}>
                                  {chatQuestion}
                                </p>
                              )}

                              {/* Mensajes del chat */}
                              {chatMsgs.length > 0 && (
                                <div
                                  ref={chatLogRef}
                                  style={{
                                    maxHeight: 180, overflowY: 'auto',
                                    display: 'flex', flexDirection: 'column',
                                    gap: 8, marginBottom: 12,
                                  }}
                                >
                                  {chatMsgs.map(msg => (
                                    <div key={msg.id} style={{
                                      display: 'flex',
                                      justifyContent: msg.from === 'user' ? 'flex-end' : 'flex-start',
                                    }}>
                                      <div style={{
                                        maxWidth: '80%', padding: '8px 13px',
                                        borderRadius: msg.from === 'user'
                                          ? '1.2rem 1.2rem 0.3rem 1.2rem'
                                          : '1.2rem 1.2rem 1.2rem 0.3rem',
                                        background: msg.from === 'user'
                                          ? 'linear-gradient(135deg, #0A7E8C, #2ECDA7)'
                                          : 'rgba(10,126,140,0.08)',
                                        color: msg.from === 'user' ? '#fff' : '#1A1A2E',
                                        fontSize: '0.875rem', lineHeight: 1.5,
                                      }}>
                                        {msg.text}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Chips de sugerencias */}
                              {!isTyping && chatSuggestions.length > 0 && (
                                <div style={{
                                  display: 'flex', flexWrap: 'wrap', gap: 8,
                                  marginBottom: 12,
                                }}>
                                  {chatSuggestions.map((s, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => handleChatSubmit(s)}
                                      disabled={isTyping}
                                      style={{
                                        padding: '6px 14px', borderRadius: 9999,
                                        border: '1.5px solid rgba(10,126,140,0.25)',
                                        background: 'white', color: '#0A7E8C',
                                        fontSize: '0.8125rem', fontWeight: 600,
                                        cursor: isTyping ? 'not-allowed' : 'pointer',
                                        opacity: isTyping ? 0.5 : 1,
                                        fontFamily: 'inherit',
                                      }}
                                      onMouseEnter={e => {
                                        if (!isTyping) e.currentTarget.style.background = 'rgba(10,126,140,0.06)'
                                      }}
                                      onMouseLeave={e => {
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
                                  onChange={e => setChatInput(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault()
                                      handleChatSubmit(chatInput)
                                    }
                                  }}
                                  disabled={isTyping || chatDone}
                                  placeholder={chatDone ? 'Contexto actualizado' : 'O escribí tu respuesta…'}
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
                                    opacity: (isTyping || chatDone) ? 0.5 : 1,
                                  }}
                                  onFocus={e => { e.currentTarget.style.borderColor = '#0A7E8C' }}
                                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(10,126,140,0.12)' }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleChatSubmit(chatInput)}
                                  disabled={isTyping || !chatInput.trim() || chatDone}
                                  style={{
                                    width: 42, height: 42, borderRadius: '50%',
                                    border: 'none',
                                    cursor: (isTyping || !chatInput.trim() || chatDone)
                                      ? 'not-allowed' : 'pointer',
                                    background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                                    display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', flexShrink: 0,
                                    opacity: (isTyping || !chatInput.trim() || chatDone) ? 0.4 : 1,
                                  }}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24"
                                    fill="none" stroke="currentColor"
                                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="22" y1="2" x2="11" y2="13" />
                                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                  </svg>
                                </button>
                              </div> 
                            </>
                          )}
                        </div>
                      )}
                    </Card>
                  </div>
                </div>
              )}

              {/* ── Nueva disposición ─────────────────────────────────── */}
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
                      history.map((h, i) => (
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
                          <div style={{ fontSize: '0.65rem', color: '#5a7478' }}>
                            {fmtLongDate(h.occurred_at)}
                          </div>
                        </div>
                      ))
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

                {/* ── Tareas ─────────────────────────────────────────── */}
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
                  <div style={{ marginTop: 12, textAlign: 'right' }}>
                    <Link
                      href={`/case/shared/${id}/finalizadas`}
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

                {/* ── Documentos ─────────────────────────────────────── */}
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
                  </div>

                  {/* Fila 2: Participantes */}
                  <div>
                    <SectionTitle>Participantes</SectionTitle>
                    <Card>
                  {members.map((m, i) => {
                    const isCreator    = m.user_id === sharedCase.created_by
                    const displayName  = (m.profile as any)?.full_name || m.email
                    const initials     = getInitials(displayName).slice(0, 2)
                    const avatarUrl    = (m.profile as any)?.avatar_url ?? null
                    return (
                      <div key={m.id} className="flex items-center"
                        style={{
                          gap: 12, padding: '12px 0',
                          borderBottom: i < members.length - 1 ? '1px solid rgba(10,126,140,0.12)' : 'none',
                        }}>
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={displayName}
                            style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                          />
                        ) : (
                          <div className="rounded-full flex items-center justify-center flex-shrink-0 text-white"
                            style={{
                              width: 36, height: 36, fontSize: '0.75rem', fontWeight: 700,
                              background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                            }}>
                            {initials}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-[#1A1A2E] truncate" style={{ fontSize: '0.875rem' }}>
                            {displayName}
                          </div>
                          {m.joined_at && (
                            <div style={{ fontSize: '0.7rem', color: '#5a7478', marginTop: 2 }}>
                              Se sumó {fmtShortDate(m.joined_at)}
                            </div>
                          )}
                        </div>
                        {isCreator && (
                          <span style={{
                            fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                            background: 'rgba(10,126,140,0.08)', color: '#0A7E8C',
                            borderRadius: 9999, padding: '3px 10px', flexShrink: 0,
                          }}>
                            Creador
                          </span>
                        )}
                      </div>
                    )
                  })}

                  {pendingMembers.map((pm, i) => (
                    <div key={pm.id} style={{
                      display: 'flex', alignItems: 'center',
                      gap: 12, padding: '12px 0',
                      borderBottom: '1px solid rgba(10,126,140,0.12)',
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'rgba(232,145,58,0.12)',
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'center', flexShrink: 0,
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24"
                          fill="none" stroke="#E8913A" strokeWidth="1.8"
                          strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <polyline points="12 6 12 12 16 14"/>
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '0.875rem', fontWeight: 600,
                          color: '#1A1A2E',
                          overflow: 'hidden', textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {pm.email}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 700,
                        letterSpacing: '0.05em', textTransform: 'uppercase',
                        background: 'rgba(232,145,58,0.12)', color: '#E8913A',
                        borderRadius: 9999, padding: '3px 10px', flexShrink: 0,
                      }}>
                        Pendiente
                      </span>
                      <button
                        type="button"
                        onClick={() => setRemovePendingId(pm.id)}
                        style={{
                          background: 'none', border: 'none',
                          cursor: 'pointer', color: '#5a7478',
                          padding: 4, flexShrink: 0,
                          display: 'flex', alignItems: 'center',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#ba1a1a' }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#5a7478' }}
                        title="Quitar invitación"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24"
                          fill="none" stroke="currentColor" strokeWidth="2"
                          strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/>
                          <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  ))}

                  {/* Invite button */}
                  <div style={{ borderTop: members.length > 0 ? '1px solid rgba(10,126,140,0.12)' : 'none', marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => {
                        setInviteError(null)
                        setInviteEmail('')
                        setSsOpen(true)
                      }}
                      className="flex items-center gap-3 w-full bg-transparent border-0 text-left cursor-pointer"
                      style={{ padding: '12px 0' }}
                    >
                      <div className="rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ width: 40, height: 40, background: 'rgba(61,199,166,0.08)', border: '1.5px dashed rgba(61,199,166,0.5)' }}>
                        <IconInvitePerson />
                      </div>
                      <span className="font-bold text-[#0A7E8C]" style={{ fontSize: '0.875rem' }}>
                        Invitar persona
                      </span>
                    </button>
                  </div>
                    </Card>
                  </div>

                </div>
              </div>
            </>
          )}

        </main>
      </div>
    </>
  )
}
