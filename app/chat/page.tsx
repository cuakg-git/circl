'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────────

type Message = {
  id:   string
  role: 'user' | 'agent'
  text: string
  time: string
}

type Crisis = {
  id:   string
  name: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function nowTime() {
  return new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function uid() {
  return Math.random().toString(36).slice(2)
}

// ── TypingIndicator ────────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex flex-col" style={{ alignSelf: 'flex-start', maxWidth: '68%' }}>
      <span
        className="text-[0.7rem] font-bold mb-1 px-1"
        style={{ color: '#0A7E8C' }}
      >
        Agente Mhiru
      </span>
      <div
        className="flex items-center gap-1 px-[17px] py-3"
        style={{
          background:             '#0A7E8C',
          borderRadius:           18,
          borderBottomLeftRadius: 4,
        }}
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
    <svg
      width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    >
      <line x1="22" y1="2"  x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const router = useRouter()

  const [userId,    setUserId]    = useState<string | null>(null)
  const [crisis,    setCrisis]    = useState<Crisis | null>(null)
  const [messages,  setMessages]  = useState<Message[]>([])
  const [input,     setInput]     = useState('')
  const [agentBusy, setAgentBusy] = useState(false)

  const threadRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Auth + crisis ──────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) { router.replace('/login'); return }

      setUserId(user.id)

      const { data: crisisData } = await supabase
        .from('crises')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('status', 'activa')
        .maybeSingle()

      if (crisisData) setCrisis(crisisData)

      // Initial agent greeting
      setMessages([{
        id:   uid(),
        role: 'agent',
        text: crisisData
          ? `Hola. Estoy al tanto de lo que está pasando con ${crisisData.name}. ¿En qué te puedo ayudar?`
          : 'Hola. ¿En qué te puedo ayudar hoy?',
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

  // ── Send ───────────────────────────────────────────────────────────────────

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || agentBusy || !userId) return

    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    setMessages((prev) => [...prev, { id: uid(), role: 'user', text, time: nowTime() }])
    setAgentBusy(true)

    try {
      const res = await fetch(process.env.NEXT_PUBLIC_AGENT_ENDPOINT!, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ user_id: userId, message: text }),
      })

      const json = await res.json()
      const reply: string =
        json.reply ?? json.response ?? json.message ?? json.text ?? 'No pude obtener una respuesta.'

      setMessages((prev) => [
        ...prev,
        { id: uid(), role: 'agent', text: reply, time: nowTime() },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id:   uid(),
          role: 'agent',
          text: 'Hubo un error al conectar con el agente. Intentá de nuevo en un momento.',
          time: nowTime(),
        },
      ])
    } finally {
      setAgentBusy(false)
    }
  }, [input, agentBusy, userId])

  // ── Input handlers ─────────────────────────────────────────────────────────

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  // Preview text for the left sidebar conversation item
  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null

  // ── Render ─────────────────────────────────────────────────────────────────

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
        .chat-bg { animation: heroBgDrift 30s ease-in-out infinite; }

        @keyframes typingDot {
          0%, 60%, 100% { transform: translateY(0);    opacity: 0.5; }
          30%            { transform: translateY(-4px); opacity: 1;   }
        }

        /* Thin scrollbar for the message thread */
        .chat-thread::-webkit-scrollbar       { width: 4px; }
        .chat-thread::-webkit-scrollbar-track { background: transparent; }
        .chat-thread::-webkit-scrollbar-thumb { background: rgba(10,126,140,0.15); border-radius: 2px; }
      `}</style>

      {/* Root — full viewport, no overflow */}
      <div className="chat-bg flex" style={{ height: '100vh', overflow: 'hidden' }}>
        <Sidebar />

        {/*
          Main wrapper:
          - desktop: offset by sidebar (240px)
          - mobile: full width, height reduced by bottom-nav height (~60px)
        */}
        <main
          className="flex flex-1 overflow-hidden md:ml-[240px]"
          style={{ height: '100%' }}
        >
          <div
            className="flex flex-1 overflow-hidden"
            style={{ height: '100%' }}
          >

            {/* ── Left conversation sidebar (hidden on mobile ≤640px) ─────── */}
            <div
              className="hidden sm:flex flex-col flex-shrink-0 overflow-hidden bg-white"
              style={{ width: 270, borderRight: '1px solid rgba(10,126,140,0.12)' }}
            >
              {/* Header */}
              <div
                className="flex-shrink-0"
                style={{
                  padding:      '20px 20px 16px',
                  borderBottom: '1px solid rgba(10,126,140,0.12)',
                  fontWeight:   800,
                  fontSize:     '1.125rem',
                  color:        '#0A7E8C',
                }}
              >
                Conversaciones
              </div>

              {/* Active crisis item */}
              {crisis ? (
                <div
                  style={{
                    padding:      '14px 20px',
                    borderBottom: '1px solid rgba(10,126,140,0.12)',
                    background:   'rgba(10,126,140,0.07)',
                    cursor:       'default',
                  }}
                >
                  <div
                    className="flex justify-between items-center"
                    style={{ marginBottom: 3 }}
                  >
                    <span className="text-[0.875rem] font-bold text-[#1A1A2E] truncate">
                      {crisis.name}
                    </span>
                    {lastMsg && (
                      <span
                        className="text-[0.7rem] text-[#5a7478] whitespace-nowrap flex-shrink-0"
                        style={{ marginLeft: 8 }}
                      >
                        {lastMsg.time}
                      </span>
                    )}
                  </div>
                  <div
                    className="text-[0.7rem] text-[#5a7478] overflow-hidden whitespace-nowrap"
                    style={{ textOverflow: 'ellipsis', maxWidth: 220 }}
                  >
                    {lastMsg?.text ?? '…'}
                  </div>
                </div>
              ) : (
                <div className="p-5 text-center text-[0.7rem] text-[#5a7478]">
                  Sin conversaciones activas
                </div>
              )}
            </div>

            {/* ── Main chat area ────────────────────────────────────────────── */}
            <div
              className="flex flex-1 flex-col overflow-hidden"
              style={{ background: '#FAF8F5' }}
            >

              {/* Chat header */}
              <div
                className="flex-shrink-0 flex items-center gap-3 bg-white"
                style={{
                  padding:      '16px 24px',
                  borderBottom: '1px solid rgba(10,126,140,0.12)',
                }}
              >
                {/* Agent avatar */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs text-white select-none"
                  style={{ background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)' }}
                >
                  AC
                </div>

                <div>
                  <h4
                    className="font-bold text-[#1A1A2E]"
                    style={{ fontSize: '1rem', letterSpacing: '-0.01em' }}
                  >
                    Agente Mhiru
                  </h4>
                  <p className="text-[0.7rem] text-[#5a7478] mt-px">
                    {crisis ? `${crisis.name} · en línea` : 'en línea'}
                  </p>
                </div>
              </div>

              {/* Message thread */}
              <div
                ref={threadRef}
                className="chat-thread flex-1 overflow-y-auto flex flex-col gap-[14px]"
                style={{ padding: 24 }}
              >
                {messages.map((msg) => (
                  <div
                    key={msg.id}
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
                      {msg.role === 'agent' ? 'Agente Mhiru' : 'Vos'}
                    </span>

                    {/* Bubble */}
                    <div
                      style={{
                        padding:                '12px 17px',
                        borderRadius:           18,
                        borderBottomLeftRadius:  msg.role === 'agent' ? 4  : 18,
                        borderBottomRightRadius: msg.role === 'user'  ? 4  : 18,
                        background:             msg.role === 'agent' ? '#0A7E8C' : '#FFFFFF',
                        color:                  msg.role === 'agent' ? '#FFFFFF' : '#1A1A2E',
                        border:                 msg.role === 'user'
                          ? '1.5px solid rgba(10,126,140,0.30)'
                          : 'none',
                        fontSize:   '0.875rem',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                        wordBreak:  'break-word',
                      }}
                    >
                      {msg.text}
                    </div>

                    {/* Timestamp */}
                    <span
                      style={{
                        fontSize:  '0.65rem',
                        color:     '#5a7478',
                        marginTop:  4,
                        padding:   '0 5px',
                        alignSelf: msg.role === 'agent' ? 'flex-start' : 'flex-end',
                      }}
                    >
                      {msg.time}
                    </span>
                  </div>
                ))}

                {/* Typing indicator */}
                {agentBusy && <TypingIndicator />}
              </div>

              {/* Input bar */}
              <div
                className="flex-shrink-0 flex items-end gap-[10px] bg-white"
                style={{
                  padding:   '14px 20px',
                  borderTop: '1px solid rgba(10,126,140,0.12)',
                }}
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
                  onClick={send}
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
          </div>
        </main>
      </div>
    </>
  )
}
