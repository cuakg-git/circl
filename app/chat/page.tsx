'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────────

type Message = {
  id:           string
  role:         'user' | 'agent'
  text:         string
  time:         string
  action?:      { icon: string; label: string } | null
  suggestions?: string[]
}

type ActiveContext = {
  caseId:   string
  caseName: string
  type:     'case' | 'shared_case'
} | null

type CaseItem = {
  id:   string
  name: string
  type: 'case' | 'shared_case'
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function nowTime() {
  return new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function uid() {
  return Math.random().toString(36).slice(2)
}

// ── detectAction ───────────────────────────────────────────────────────────────

function detectAction(text: string): { icon: string; label: string } | null {
  const t = text.toLowerCase()
  if (/anoté|registré|quedó registrado|lo dejé registrado|quedó anotado/.test(t))
    return { icon: 'check_circle', label: 'Registrado en el historial' }
  if (/tarea|vence|agregué la tarea|anoté la tarea/.test(t))
    return { icon: 'task_alt', label: 'Tarea agregada' }
  if (/asigné|asignada a|lo pasé a/.test(t))
    return { icon: 'assignment_ind', label: 'Tarea asignada' }
  if (/contacto|sumé a|agregué a|lo agregué al círculo/.test(t))
    return { icon: 'group_add', label: 'Contacto agregado al círculo' }
  if (/documento|subiste|cargado/.test(t))
    return { icon: 'description', label: 'Documento registrado' }
  if (/le escribí|le mandé|le avisé|mensaje enviado/.test(t))
    return { icon: 'send', label: 'Mensaje enviado' }
  return null
}

// ── TypingIndicator ────────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex flex-col" style={{ alignSelf: 'flex-start', maxWidth: '68%' }}>
      <span className="text-[0.7rem] font-bold mb-1 px-1" style={{ color: '#0A7E8C' }}>
        Mhiru
      </span>
      <div
        className="flex items-center gap-1 px-[17px] py-3"
        style={{ background: '#0A7E8C', borderRadius: 18, borderBottomLeftRadius: 4 }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block w-[7px] h-[7px] rounded-full bg-white"
            style={{ animation: `typingDot 1.2s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
    </div>
  )
}

// ── SendIcon ───────────────────────────────────────────────────────────────────

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2"  x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

const FALLBACK_CHIPS = ['¿Qué tengo pendiente?', 'Contame más', 'Quiero registrar algo']

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const router = useRouter()

  const [userId,        setUserId]        = useState<string | null>(null)
  const [messages,      setMessages]      = useState<Message[]>([])
  const [caseItems,     setCaseItems]     = useState<CaseItem[]>([])
  const [activeContext, setActiveContext] = useState<ActiveContext>(null)
  const [input,         setInput]         = useState('')
  const [agentBusy,     setAgentBusy]     = useState(false)
  const [panelOpen,     setPanelOpen]     = useState(true)
  const [drawerOpen,    setDrawerOpen]    = useState(false)

  const threadRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Auth + load ────────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) { router.replace('/login'); return }
      setUserId(user.id)

      // ── Load case items for the panel ──────────────────────────────────
      const [ownRes, sharedRes] = await Promise.all([
        supabase
          .from('cases')
          .select('id, name')
          .eq('user_id', user.id)
          .eq('status', 'activa')
          .order('started_at', { ascending: false }),

        supabase
          .from('shared_case_members')
          .select('shared_case_id, shared_cases!inner(id, name)')
          .eq('user_id', user.id)
          .eq('status', 'active'),
      ])

      const ownCases: CaseItem[] = (ownRes.data ?? []).map((c: any) => ({
        id:   c.id,
        name: c.name,
        type: 'case' as const,
      }))

      const sharedCases: CaseItem[] = (sharedRes.data ?? []).map((row: any) => ({
        id:   row.shared_cases.id,
        name: row.shared_cases.name,
        type: 'shared_case' as const,
      }))

      setCaseItems([...ownCases, ...sharedCases])

      // ── Load general conversation messages ────────────────────────────
      const { data: convData } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', user.id)
        .is('case_id', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (convData) {
        const { data: messagesData } = await supabase
          .from('messages')
          .select('id, sender, content, sent_at')
          .eq('conversation_id', convData.id)
          .order('sent_at', { ascending: false })
          .limit(50)

        if (messagesData && messagesData.length > 0) {
          setMessages(
            messagesData.reverse().map((m: any) => ({
              id:     uid(),
              role:   m.sender === 'usuario' ? 'user' : 'agent',
              text:   m.content,
              time:   new Date(m.sent_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
              action: m.sender === 'agente' ? detectAction(m.content) : null,
            } as Message))
          )
          return
        }
      }

      // No previous messages — initial greeting
      setMessages([{
        id:   uid(),
        role: 'agent',
        text: 'Hola. ¿En qué te puedo ayudar hoy?',
        time: nowTime(),
      }])
    }

    init()
  }, [router])

  // ── Auto-scroll ────────────────────────────────────────────────────────────

  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, agentBusy])

  // ── Select context (inject context message) ────────────────────────────────

  const selectContext = useCallback(async (item: CaseItem) => {
    if (!userId) return
    setDrawerOpen(false)
    setActiveContext({ caseId: item.id, caseName: item.name, type: item.type })
    setAgentBusy(true)

    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          user_id: userId,
          case_id: item.id,
          message: `El usuario seleccionó el tema "${item.name}". Generá un resumen breve de este tema en primera persona dirigido al usuario: qué está pasando, quiénes están involucrados y qué tareas tiene pendientes. Terminá invitando al usuario a preguntar o pedir ayuda con algo concreto. Tono cálido, directo, sin títulos ni listas formateadas.`,
        }),
      })

      const json  = await res.json()
      const reply: string = json.reply ?? json.response ?? json.message ?? json.text ?? 'No pude obtener el resumen del tema.'
      const suggestions: string[] = Array.isArray(json.suggestions) ? json.suggestions : FALLBACK_CHIPS

      setMessages(prev => [...prev, {
        id:          uid(),
        role:        'agent',
        text:        reply,
        time:        nowTime(),
        action:      detectAction(reply),
        suggestions,
      }])
    } catch {
      setMessages(prev => [...prev, {
        id:   uid(),
        role: 'agent',
        text: 'Hubo un error al cargar el tema. Intentá de nuevo.',
        time: nowTime(),
      }])
    } finally {
      setAgentBusy(false)
    }
  }, [userId])

  // ── Clear context ──────────────────────────────────────────────────────────

  function selectGeneral() {
    setActiveContext(null)
    setDrawerOpen(false)
  }

  // ── Send ───────────────────────────────────────────────────────────────────

  const send = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text || agentBusy || !userId) return

    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const userMsg: Message = { id: uid(), role: 'user', text, time: nowTime() }
    setMessages(prev => [...prev, userMsg])
    setAgentBusy(true)

    try {
      const body: Record<string, unknown> = { user_id: userId, message: text }
      if (activeContext?.caseId) body.case_id = activeContext.caseId

      const res   = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })

      const json  = await res.json()
      const reply: string = json.reply ?? json.response ?? json.message ?? json.text ?? 'No pude obtener una respuesta.'
      const suggestions: string[] = Array.isArray(json.suggestions) ? json.suggestions : FALLBACK_CHIPS

      setMessages(prev => [...prev, {
        id:          uid(),
        role:        'agent',
        text:        reply,
        time:        nowTime(),
        action:      detectAction(reply),
        suggestions,
      }])
    } catch {
      setMessages(prev => [...prev, {
        id:   uid(),
        role: 'agent',
        text: 'Hubo un error al conectar con el agente. Intentá de nuevo en un momento.',
        time: nowTime(),
      }])
    } finally {
      setAgentBusy(false)
    }
  }, [input, agentBusy, userId, activeContext])

  // ── Input handlers ─────────────────────────────────────────────────────────

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  function onInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  // ── Panel content (shared desktop + mobile) ────────────────────────────────

  const isGeneralActive = activeContext === null

  function PanelContent() {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0 16px' }}>
        {/* Chat general item */}
        <button
          type="button"
          onClick={selectGeneral}
          style={{
            width:      '100%',
            textAlign:  'left',
            background: isGeneralActive ? 'rgba(10,126,140,0.08)' : 'transparent',
            border:     'none',
            cursor:     'pointer',
            padding:    '10px 16px',
            fontFamily: 'inherit',
          }}
        >
          <span style={{
            fontSize:   '0.8rem',
            fontWeight: 600,
            color:      isGeneralActive ? '#0A7E8C' : '#1A1A2E',
          }}>
            Chat general
          </span>
        </button>

        {/* ¿De qué querés hablar? section */}
        {caseItems.length > 0 && (
          <>
            <p style={{
              fontSize:      '0.7rem',
              fontWeight:    700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color:         '#5a7478',
              padding:       '0 16px',
              margin:        '16px 0 6px',
            }}>
              ¿De qué querés hablar?
            </p>
            {caseItems.map(item => {
              const isActive = activeContext?.caseId === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectContext(item)}
                  style={{
                    width:         '100%',
                    textAlign:     'left',
                    background:    isActive ? 'rgba(10,126,140,0.08)' : 'transparent',
                    border:        'none',
                    cursor:        'pointer',
                    padding:       '10px 16px',
                    display:       'flex',
                    alignItems:    'center',
                    justifyContent: 'space-between',
                    gap:           6,
                    fontFamily:    'inherit',
                  }}
                >
                  <span style={{
                    fontSize:     '0.8rem',
                    fontWeight:   600,
                    color:        isActive ? '#0A7E8C' : '#1A1A2E',
                    flex:         1,
                    minWidth:     0,
                    overflow:     'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace:   'nowrap',
                  }}>
                    {item.name}
                  </span>
                  {item.type === 'case' ? (
                    <span style={{
                      background:   'rgba(10,126,140,0.10)',
                      color:        '#0A7E8C',
                      borderRadius: 9999,
                      padding:      '3px 10px',
                      fontSize:     '0.7rem',
                      fontWeight:   700,
                      flexShrink:   0,
                    }}>
                      Propio
                    </span>
                  ) : (
                    <span style={{
                      background:   'rgba(232,145,58,0.12)',
                      color:        '#c97420',
                      borderRadius: 9999,
                      padding:      '3px 10px',
                      fontSize:     '0.7rem',
                      fontWeight:   700,
                      flexShrink:   0,
                    }}>
                      Compartido
                    </span>
                  )}
                </button>
              )
            })}
          </>
        )}
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20,400,0,0');

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
        .chat-bg { animation: heroBgDrift 30s ease-in-out infinite; }

        @keyframes typingDot {
          0%, 60%, 100% { transform: translateY(0);    opacity: 0.5; }
          30%            { transform: translateY(-4px); opacity: 1;   }
        }

        .chat-thread::-webkit-scrollbar       { width: 4px; }
        .chat-thread::-webkit-scrollbar-track { background: transparent; }
        .chat-thread::-webkit-scrollbar-thumb { background: rgba(10,126,140,0.15); border-radius: 2px; }
      `}</style>

      {/* Root — full viewport */}
      <div className="chat-bg flex" style={{ height: '100vh', overflow: 'hidden' }}>
        <Sidebar />

        {/* Mobile drawer overlay */}
        {drawerOpen && (
          <div
            onClick={() => setDrawerOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.22)', zIndex: 100 }}
          />
        )}

        {/* Mobile drawer */}
        <div
          className="md:hidden"
          style={{
            position:      'fixed',
            top:           0,
            left:          0,
            width:         280,
            height:        '100vh',
            background:    '#FFFFFF',
            zIndex:        101,
            transform:     drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition:    'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
            display:       'flex',
            flexDirection: 'column',
            borderRight:   '1px solid rgba(10,126,140,0.12)',
          }}
        >
          {/* Drawer header */}
          <div style={{
            padding:        '20px 20px 16px',
            borderBottom:   '1px solid rgba(10,126,140,0.08)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'flex-end',
            flexShrink:     0,
          }}>
            <button
              onClick={() => setDrawerOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5a7478', padding: 4 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <PanelContent />
        </div>

        {/* Main wrapper: offset by sidebar on desktop */}
        <main className="flex flex-1 overflow-hidden md:ml-[240px]" style={{ height: '100%' }}>

          {/* ── Desktop context panel ──────────────────────────────────── */}
          <div
            className="hidden md:flex"
            style={{
              width:         panelOpen ? 260 : 0,
              minWidth:      panelOpen ? 260 : 0,
              overflow:      'hidden',
              transition:    'width 0.25s ease, min-width 0.25s ease',
              flexDirection: 'column',
              background:    '#FFFFFF',
              borderRight:   '1px solid rgba(10,126,140,0.12)',
              flexShrink:    0,
            }}
          >
            <PanelContent />
          </div>

          {/* ── Chat area ───────────────────────────────────────────────── */}
          <div
            className="flex flex-1 flex-col overflow-hidden pb-16 md:pb-0"
            style={{ background: '#FAF8F5' }}
          >

            {/* Chat header */}
            <div
              className="flex-shrink-0 flex items-center gap-3 bg-white"
              style={{ padding: '16px 20px', borderBottom: '1px solid rgba(10,126,140,0.12)' }}
            >
              {/* Desktop: panel toggle (chevron) */}
              <button
                type="button"
                onClick={() => setPanelOpen(p => !p)}
                className="hidden md:flex items-center justify-center flex-shrink-0"
                style={{
                  width: 32, height: 32, background: 'none',
                  border: '1px solid rgba(10,126,140,0.15)', borderRadius: '0.5rem',
                  cursor: 'pointer', color: '#5a7478',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {panelOpen
                    ? <polyline points="15 18 9 12 15 6" />
                    : <polyline points="9 18 15 12 9 6" />
                  }
                </svg>
              </button>

              {/* Mobile: hamburger */}
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="flex md:hidden items-center justify-center flex-shrink-0"
                style={{
                  width: 32, height: 32, background: 'none',
                  border: '1px solid rgba(10,126,140,0.15)', borderRadius: '0.5rem',
                  cursor: 'pointer', color: '#5a7478',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6"  x2="21" y2="6"  />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>

              {/* Title */}
              <div>
                <h4 className="font-bold text-[#1A1A2E]"
                  style={{ fontSize: '1rem', letterSpacing: '-0.01em' }}>
                  {activeContext ? activeContext.caseName : 'Hablar con Mhiru'}
                </h4>
                {activeContext && (
                  <p className="text-[0.7rem] text-[#5a7478] mt-px">Tema activo</p>
                )}
              </div>
            </div>

            {/* Message thread */}
            <div
              ref={threadRef}
              className="chat-thread flex-1 overflow-y-auto flex flex-col gap-[14px]"
              style={{ padding: 24 }}
            >
              {(() => {
                const lastAgentIndex = messages.reduce(
                  (last, msg, i) => (msg.role === 'agent' ? i : last),
                  -1
                )
                return messages.map((msg, idx) => {
                  const showSuggestions =
                    msg.role === 'agent' &&
                    idx === lastAgentIndex &&
                    !agentBusy &&
                    (msg.suggestions?.length ?? 0) > 0

                  return (
                    <div key={msg.id}>
                      <div
                        className="flex flex-col"
                        style={{
                          maxWidth:  '68%',
                          alignSelf: msg.role === 'agent' ? 'flex-start' : 'flex-end',
                        }}
                      >
                        {/* Sender label */}
                        <span
                          className="text-[0.7rem] font-bold mb-1 px-1"
                          style={{
                            color:     msg.role === 'agent' ? '#0A7E8C' : '#5a7478',
                            textAlign: msg.role === 'agent' ? 'left'    : 'right',
                          }}
                        >
                          {msg.role === 'agent' ? 'Mhiru' : 'Vos'}
                        </span>

                        {/* Bubble */}
                        <div style={{
                          padding:                '12px 17px',
                          borderRadius:           18,
                          borderBottomLeftRadius:  msg.role === 'agent' ? 4  : 18,
                          borderBottomRightRadius: msg.role === 'user'  ? 4  : 18,
                          background:             msg.role === 'agent' ? '#0A7E8C' : '#FFFFFF',
                          color:                  msg.role === 'agent' ? '#FFFFFF' : '#1A1A2E',
                          border:                 msg.role === 'user'
                            ? '1.5px solid rgba(10,126,140,0.30)'
                            : 'none',
                          fontSize: '0.875rem', lineHeight: 1.6,
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        }}>
                          {msg.text}
                        </div>

                        {/* Timestamp */}
                        <span style={{
                          fontSize: '0.65rem', color: '#5a7478',
                          marginTop: 4, padding: '0 5px',
                          alignSelf: msg.role === 'agent' ? 'flex-start' : 'flex-end',
                        }}>
                          {msg.time}
                        </span>

                        {/* Action feedback */}
                        {msg.role === 'agent' && msg.action && (
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            fontSize: '0.65rem', color: '#5a7478',
                            marginTop: 2, paddingLeft: 5, alignSelf: 'flex-start',
                          }}>
                            <span className="material-symbols-outlined"
                              style={{ fontSize: 14, color: '#5a7478', lineHeight: 1 }}>
                              {msg.action.icon}
                            </span>
                            {msg.action.label}
                          </div>
                        )}
                      </div>

                      {/* Quick reply chips — only on the last agent message */}
                      {showSuggestions && (
                        <div style={{
                          display:   'flex',
                          flexWrap:  'wrap',
                          gap:       8,
                          marginTop: 8,
                          alignSelf: 'flex-start',
                        }}>
                          {(msg.suggestions ?? []).map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => send(s)}
                              style={{
                                background:   '#FFFFFF',
                                border:       '1.5px solid rgba(10,126,140,0.25)',
                                borderRadius: 9999,
                                padding:      '6px 14px',
                                fontSize:     '0.75rem',
                                fontWeight:   600,
                                color:        '#0A7E8C',
                                cursor:       'pointer',
                                fontFamily:   'inherit',
                                transition:   'background 0.15s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(10,126,140,0.05)' }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF' }}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              })()}

              {/* Typing indicator */}
              {agentBusy && <TypingIndicator />}
            </div>

            {/* Input bar */}
            <div
              className="flex-shrink-0 flex items-end gap-[10px] bg-white"
              style={{ padding: '14px 20px', borderTop: '1px solid rgba(10,126,140,0.12)' }}
            >
              <textarea
                ref={textareaRef}
                className="flex-1 outline-none resize-none text-[#1A1A2E]"
                style={{
                  background:   '#FAF8F5',
                  border:       '1.5px solid rgba(10,126,140,0.12)',
                  borderRadius: '1.5rem',
                  padding:      '11px 16px',
                  fontSize:     '0.875rem',
                  lineHeight:   1.5,
                  minHeight:    44,
                  maxHeight:    120,
                  transition:   'border-color 0.2s',
                }}
                placeholder="Escribí un mensaje…"
                rows={1}
                value={input}
                onChange={onInputChange}
                onKeyDown={onKeyDown}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#0A7E8C' }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(10,126,140,0.12)' }}
                disabled={agentBusy}
              />

              <button
                type="button"
                onClick={() => send()}
                disabled={agentBusy || !input.trim()}
                className="flex-shrink-0 flex items-center justify-center rounded-full text-white transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                style={{
                  width:      44,
                  height:     44,
                  background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                  boxShadow:  '0 4px 16px rgba(10,126,140,0.25)',
                  flexShrink: 0,
                }}
              >
                <SendIcon />
              </button>
            </div>

          </div>
        </main>
      </div>
    </>
  )
}
