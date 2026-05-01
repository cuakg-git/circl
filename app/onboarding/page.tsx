'use client'

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ── Constants ──────────────────────────────────────────────────────────────────

const AGENT_ENDPOINT = process.env.NEXT_PUBLIC_AGENT_ENDPOINT as string

// Human-readable labels for the role and proximity select values
// (used when building the contacts message for the agent in step 3).
const ROLE_LABELS: Record<string, string> = {
  acompanamiento: 'acompañamiento',
  logistica:      'logístico',
  prestador:      'prestador de servicios',
}

const PROXIMITY_LABELS: Record<string, string> = {
  nucleo:       'núcleo',
  ayuda:        'ayuda o puede ayudar',
  profesional:  'proveedor o profesional',
}

const LINE2_CHARS = Array.from('Estoy para acompañarte.')

const AV_GRADIENTS = [
  'linear-gradient(135deg, #3DC7A6, #0A7E8C)',
  'linear-gradient(135deg, #0A7E8C, #065e6a)',
  'linear-gradient(135deg, #9b7fe8, #6c4fc7)',
  'linear-gradient(135deg, #f4ab66, #E07931)',
]
const INIT_POOL = ['LA', 'CR', 'MR', 'JP', 'PG', 'RM']

// ── Types ──────────────────────────────────────────────────────────────────────

type RingsPhase = 'hidden' | 'growing' | 'pulsing'
type ChatMsg    = { id: number; from: 'circl' | 'user'; text: string }
type Contact    = { id: number; name: string; phone: string; role: string; proximity: string }

// ── Component ──────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()

  // ── Step ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)

  // ── Agent ─────────────────────────────────────────────────────────────────
  const [userId, setUserId] = useState('')

  // ── Splash animation ──────────────────────────────────────────────────────
  const [ringsPhase, setRingsPhase]     = useState<RingsPhase>('hidden')
  const [line1Chars, setLine1Chars]     = useState<string[]>([])
  const [line1Visible, setLine1Visible] = useState(0)
  const [line2Visible, setLine2Visible] = useState(0)
  const [ctaVisible, setCtaVisible]     = useState(false)
  const [skipVisible, setSkipVisible]   = useState(false)

  // ── Form ──────────────────────────────────────────────────────────────────
  const [crisis, setCrisis]       = useState('')
  const [contacts, setContacts]   = useState<Contact[]>([
    { id: 1, name: '', phone: '', role: '', proximity: '' },
  ])
  const nextContactId = useRef(2)

  // ── Chat ──────────────────────────────────────────────────────────────────
  const [chatMsgs, setChatMsgs]   = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [isTyping, setIsTyping]   = useState(false)
  const chatInited                = useRef(false)
  const chatMsgId                 = useRef(0)
  const chatLogRef                = useRef<HTMLDivElement>(null)

  // ── Animation coordination ────────────────────────────────────────────────
  const firstNameRef     = useRef('tú')
  const nameReadyRef     = useRef(false)
  const ringsCompleteRef = useRef(false)
  const twStartedRef     = useRef(false)

  // ── Init: rings + user fetch ──────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false

    function maybeStartTw() {
      if (cancelled) return
      if (nameReadyRef.current && ringsCompleteRef.current && !twStartedRef.current) {
        twStartedRef.current = true
        setTimeout(() => { if (!cancelled) doTypewriter() }, 1000)
      }
    }

    function doTypewriter() {
      const l1 = Array.from(`Hola, ${firstNameRef.current}.`)
      setLine1Chars(l1)
      setLine1Visible(0)
      setLine2Visible(0)

      let i = 0
      const iv1 = setInterval(() => {
        if (cancelled) { clearInterval(iv1); return }
        i++
        setLine1Visible(i)
        if (i >= l1.length) {
          clearInterval(iv1)
          setTimeout(() => {
            if (cancelled) return
            let j = 0
            const iv2 = setInterval(() => {
              if (cancelled) { clearInterval(iv2); return }
              j++
              setLine2Visible(j)
              if (j >= LINE2_CHARS.length) {
                clearInterval(iv2)
                setTimeout(() => {
                  if (cancelled) return
                  setCtaVisible(true)
                  setTimeout(() => { if (!cancelled) setSkipVisible(true) }, 160)
                }, 1000)
              }
            }, 38)
          }, 500)
        }
      }, 38)
    }

    // Fetch user name + id (id is used by the agent calls in steps 2-4)
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return
      const full  = data?.user?.user_metadata?.full_name ?? ''
      const first = full.trim().split(/\s+/)[0] || 'tú'
      firstNameRef.current = first
      nameReadyRef.current = true
      if (data?.user?.id) setUserId(data.user.id)
      maybeStartTw()
    })

    // Start rings grow-in
    const t1 = setTimeout(() => { if (!cancelled) setRingsPhase('growing') }, 80)

    // erGrowIn is 0.9s → switch to pulsing at 80+900 = 980ms
    const t2 = setTimeout(() => {
      if (cancelled) return
      setRingsPhase('pulsing')
      ringsCompleteRef.current = true
      maybeStartTw()
    }, 980)

    return () => {
      cancelled = true
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  // ── Auto-scroll chat ──────────────────────────────────────────────────────

  useEffect(() => {
    const el = chatLogRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chatMsgs, isTyping])

  // ── Agent call ────────────────────────────────────────────────────────────
  // Sends { user_id, message } to the agent endpoint.
  // Returns the reply string on success, or null on error / missing userId.
  // All errors are swallowed so a network failure never breaks the UX.
  const sendToAgent = useCallback(async (message: string): Promise<string | null> => {
    if (!userId) return null
    try {
      const res = await fetch(AGENT_ENDPOINT, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ user_id: userId, message }),
      })
      if (!res.ok) return null
      const data = await res.json() as { reply?: string }
      return data.reply ?? null
    } catch {
      return null
    }
  }, [userId])

  // ── Chat init when entering step 4 ───────────────────────────────────────
  // Waits for both step===4 AND userId to be ready (userId is fetched async).
  // Guards with chatInited.current so it only fires once even if deps change.

  useEffect(() => {
    if (step !== 4 || !userId || chatInited.current) return
    chatInited.current = true
    setChatMsgs([])

    async function initChat() {
      setIsTyping(true)
      const reply = await sendToAgent('Hola, entiendo.')
      setIsTyping(false)
      if (reply) {
        const id = ++chatMsgId.current
        setChatMsgs([{ id, from: 'circl', text: reply }])
      }
    }

    initChat()
  }, [step, userId, sendToAgent])

  // ── Step 2 continue — send crisis text, fire-and-forget ──────────────────
  function handleStep2Next() {
    if (crisis.trim()) {
      const mensaje = `El usuario acaba de describir su situación durante el onboarding. Registrá esto como una nueva crisis activa usando la tool crear_crisis. La descripción es: "${crisis.trim()}"`
      sendToAgent(mensaje)   // intentionally not awaited
    }
    setStep(3)
  }

  // ── Step 3 continue — build contacts message, fire-and-forget ────────────
  function handleStep3Next() {
    const filled = contacts.filter(c => c.name.trim())
    if (filled.length > 0) {
      const contactosTexto = filled.map(c => {
        const rol       = c.role      ? (ROLE_LABELS[c.role]           ?? c.role)      : 'sin rol'
        const cercania  = c.proximity ? (PROXIMITY_LABELS[c.proximity] ?? c.proximity) : 'sin especificar'
        const telefono  = c.phone.trim() || 'no especificado'
        return `${c.name.trim()} (rol: ${rol}, cercanía: ${cercania}, teléfono: ${telefono})`
      }).join(', ')
      const mensaje = `El usuario completó el paso de círculo en el onboarding. Registrá cada persona como contacto usando crear_contacto y vincinalos a la crisis activa. Las personas son: ${contactosTexto}`
      sendToAgent(mensaje)   // intentionally not awaited
    }
    setStep(4)
  }

  // ── Chat send ─────────────────────────────────────────────────────────────
  // Sends the user message to the agent and shows its reply as a Mhiru bubble.
  // Guard on isTyping to prevent sending while a response is in flight.

  const sendChatMessage = useCallback(async () => {
    const text = chatInput.trim()
    if (!text || isTyping) return

    const id = ++chatMsgId.current
    setChatMsgs(prev => [...prev, { id, from: 'user', text }])
    setChatInput('')

    setIsTyping(true)
    const reply = await sendToAgent(text)
    setIsTyping(false)

    if (reply) {
      const replyId = ++chatMsgId.current
      setChatMsgs(prev => [...prev, { id: replyId, from: 'circl', text: reply }])
    }
  }, [chatInput, isTyping, sendToAgent])

  // ── Contact helpers ───────────────────────────────────────────────────────

  function addContact() {
    const id  = nextContactId.current++
    setContacts(prev => [...prev, { id, name: '', phone: '', role: '', proximity: '' }])
  }

  function removeContact(id: number) {
    setContacts(prev => prev.filter(c => c.id !== id))
  }

  function updateContact(id: number, field: keyof Contact, value: string) {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  // ── Stepper helpers ───────────────────────────────────────────────────────

  // steps 2-4 → stepper positions 1-3
  const stepperPos = step - 1

  function stepState(pos: number): 'active' | 'done' | 'idle' {
    if (pos < stepperPos) return 'done'
    if (pos === stepperPos) return 'active'
    return 'idle'
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const ringsClass =
    ringsPhase === 'growing' ? 'rings-visible' :
    ringsPhase === 'pulsing' ? 'rings-pulsing' : ''

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Animation keyframes ─────────────────────────────────────────── */}
      <style>{`
        @keyframes heroGradientDrift {
          0%, 100% {
            background:
              radial-gradient(ellipse at 15% 15%, rgba(61,199,166,0.06) 0%, transparent 55%),
              radial-gradient(ellipse at 85% 10%, rgba(80,220,175,0.14) 0%, transparent 50%),
              radial-gradient(ellipse at 88% 82%, rgba(224,121,49,0.16) 0%, transparent 52%),
              radial-gradient(ellipse at 12% 88%, rgba(158,160,81,0.16) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.30) 0%, transparent 65%),
              #f0f4f8;
          }
          25% {
            background:
              radial-gradient(ellipse at 22% 10%, rgba(61,199,166,0.06) 0%, transparent 55%),
              radial-gradient(ellipse at 90% 20%, rgba(80,220,175,0.14) 0%, transparent 50%),
              radial-gradient(ellipse at 80% 88%, rgba(224,121,49,0.16) 0%, transparent 52%),
              radial-gradient(ellipse at 6%  78%, rgba(158,160,81,0.16) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.30) 0%, transparent 65%),
              #f0f4f8;
          }
          50% {
            background:
              radial-gradient(ellipse at 10% 22%, rgba(61,199,166,0.06) 0%, transparent 55%),
              radial-gradient(ellipse at 78%  8%, rgba(80,220,175,0.14) 0%, transparent 50%),
              radial-gradient(ellipse at 92% 75%, rgba(224,121,49,0.16) 0%, transparent 52%),
              radial-gradient(ellipse at 18% 92%, rgba(158,160,81,0.16) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.30) 0%, transparent 65%),
              #f0f4f8;
          }
          75% {
            background:
              radial-gradient(ellipse at 20% 22%, rgba(61,199,166,0.06) 0%, transparent 55%),
              radial-gradient(ellipse at 82% 18%, rgba(80,220,175,0.14) 0%, transparent 50%),
              radial-gradient(ellipse at 85% 90%, rgba(224,121,49,0.16) 0%, transparent 52%),
              radial-gradient(ellipse at 14% 82%, rgba(158,160,81,0.16) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.30) 0%, transparent 65%),
              #f0f4f8;
          }
        }
        .ob-page { animation: heroGradientDrift 30s ease-in-out infinite; }

        @keyframes erGrowIn {
          0%   { transform: scale(0);    opacity: 0; }
          65%  { transform: scale(1.04); opacity: 1; }
          100% { transform: scale(1);    opacity: 1; }
        }
        @keyframes erPulse {
          0%, 100% { transform: scale(1);    }
          50%      { transform: scale(1.02); }
        }
        @keyframes orbit-cw  { to { transform: translate(-50%, -50%) rotate( 360deg); } }
        @keyframes orbit-ccw { to { transform: translate(-50%, -50%) rotate(-360deg); } }
        @keyframes fadeStep  {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes typingDot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0);    }
          30%           { opacity: 1;   transform: translateY(-3px); }
        }

        /* Rings */
        .welcome-er { transform: scale(0); opacity: 0; }
        .welcome-er.rings-visible {
          animation: erGrowIn 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .welcome-er.rings-pulsing {
          opacity: 1;
          transform: scale(1);
          animation: erPulse 4s ease-in-out infinite;
        }

        /* Orbit layers */
        .er-orbit {
          position: absolute;
          top: 50%; left: 50%;
          border-radius: 50%;
          transform: translate(-50%, -50%);
        }
        .er-orbit-1 { width: 134px; height: 134px; animation: orbit-cw   50s linear infinite; }
        .er-orbit-2 { width: 244px; height: 244px; animation: orbit-ccw  80s linear infinite; }
        .er-orbit-3 { width: 360px; height: 360px; animation: orbit-cw  115s linear infinite; }

        /* Chat typing indicator */
        .ob-typing-dot { animation: typingDot 1.2s ease-in-out infinite; }
        .ob-typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .ob-typing-dot:nth-child(3) { animation-delay: 0.4s; }

        /* Fade-in for chat messages and step panels */
        .ob-chat-msg  { animation: fadeStep 0.3s  ease forwards; }
        .ob-step-panel{ animation: fadeStep 0.35s ease forwards; }
      `}</style>

      {/* ── Page wrapper ──────────────────────────────────────────────────── */}
      <div
        className="ob-page min-h-screen flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse at 15% 15%, rgba(61,199,166,0.06) 0%, transparent 55%),' +
            'radial-gradient(ellipse at 85% 10%, rgba(80,220,175,0.14) 0%, transparent 50%),' +
            'radial-gradient(ellipse at 88% 82%, rgba(224,121,49,0.16) 0%, transparent 52%),' +
            'radial-gradient(ellipse at 12% 88%, rgba(158,160,81,0.16) 0%, transparent 50%),' +
            'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.30) 0%, transparent 65%),' +
            '#f0f4f8',
        }}
      >

        {/* ══ STEP 1 — Splash ══════════════════════════════════════════════ */}
        {step === 1 && (
          <div
            className="flex flex-col items-center text-center relative z-10 w-full"
            style={{ maxWidth: 760 }}
          >

            {/* Orbiting-rings illustration */}
            <div
              className={`welcome-er relative flex-shrink-0 mb-11 ${ringsClass}`}
              style={{ width: 360, height: 360 }}
            >
              {/* Static concentric rings */}
              <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', borderRadius:'50%', border:'1.5px solid rgba(10,126,140,0.04)',  width:360, height:360 }} />
              <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', borderRadius:'50%', border:'1.5px solid rgba(10,126,140,0.07)',  width:244, height:244 }} />
              <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', borderRadius:'50%', border:'1.5px solid rgba(10,126,140,0.10)',  width:134, height:134 }} />

              {/* Orbit 1 — 1 dot (8 px) */}
              <div className="er-orbit er-orbit-1">
                <div style={{ position:'absolute', borderRadius:'50%', background:'#e9eae4', border:'1px solid rgba(10,126,140,0.14)', width:8,  height:8,  top:-4,          left:'calc(50% - 4px)'   }} />
              </div>

              {/* Orbit 2 — 2 dots (13 px top, 10 px side) */}
              <div className="er-orbit er-orbit-2">
                <div style={{ position:'absolute', borderRadius:'50%', background:'#e9eae4', border:'1px solid rgba(10,126,140,0.14)', width:13, height:13, top:-6.5,        left:'calc(50% - 6.5px)' }} />
                <div style={{ position:'absolute', borderRadius:'50%', background:'#e9eae4', border:'1px solid rgba(10,126,140,0.14)', width:10, height:10, top:'calc(50% - 5px)', right:-5 }} />
              </div>

              {/* Orbit 3 — 2 dots (16 px top, 11 px bottom) */}
              <div className="er-orbit er-orbit-3">
                <div style={{ position:'absolute', borderRadius:'50%', background:'#e9eae4', border:'1px solid rgba(10,126,140,0.14)', width:16, height:16, top:-8,          left:'calc(50% - 8px)'   }} />
                <div style={{ position:'absolute', borderRadius:'50%', background:'#e9eae4', border:'1px solid rgba(10,126,140,0.14)', width:11, height:11, bottom:-5.5,     left:'calc(50% - 5.5px)' }} />
              </div>

              {/* Centre dot */}
              <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:20, height:20, borderRadius:'50%', background:'#0A7E8C', boxShadow:'0 3px 14px rgba(10,126,140,0.40)' }} />
            </div>

            {/* Typewriter title */}
            <h1
              className="font-extrabold tracking-tight text-center mb-12"
              style={{
                fontSize: 'clamp(2.5rem, 6.5vw, 4.75rem)',
                lineHeight: 1.1,
                letterSpacing: '-0.035em',
                color: '#1A1A2E',
              }}
            >
              {line1Chars.map((ch, i) => (
                <span key={i} style={{ opacity: i < line1Visible ? 1 : 0 }}>
                  {ch === ' ' ? '\u00A0' : ch}
                </span>
              ))}
              <br />
              {LINE2_CHARS.map((ch, i) => (
                <span key={i} style={{ opacity: i < line2Visible ? 1 : 0, color: '#0A7E8C' }}>
                  {ch === ' ' ? '\u00A0' : ch}
                </span>
              ))}
            </h1>

            {/* Primary CTA */}
            <button
              type="button"
              onClick={() => setStep(2)}
              className="font-bold rounded-full px-8 py-4 text-white cursor-pointer hover:brightness-110 active:scale-[0.97]"
              style={{
                background: '#0A7E8C',
                fontSize: '1.05rem',
                opacity: ctaVisible ? 1 : 0,
                transform: ctaVisible ? 'translateY(0)' : 'translateY(10px)',
                transition: 'opacity 0.5s ease, transform 0.5s ease',
              }}
            >
              ¿Cuál es tu crisis?
            </button>

            {/* Skip */}
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="mt-3 px-3 py-2 text-sm font-semibold cursor-pointer bg-transparent border-none"
              style={{
                color: '#5a7478',
                opacity: skipVisible ? 1 : 0,
                transform: skipVisible ? 'translateY(0)' : 'translateY(10px)',
                transition: 'opacity 0.5s ease, transform 0.5s ease',
                fontFamily: 'inherit',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#0A7E8C')}
              onMouseLeave={e => (e.currentTarget.style.color = '#5a7478')}
            >
              Omitir por ahora
            </button>
          </div>
        )}

        {/* ══ STEPS 2–4 — Card ════════════════════════════════════════════ */}
        {step !== 1 && (
          <div
            className="relative z-10 bg-white rounded-3xl w-full px-8 py-8"
            style={{ maxWidth: 720, boxShadow: '0 4px 24px rgba(10,126,140,0.08)' }}
          >

            {/* ── Stepper ───────────────────────────────────────────────── */}
            <div className="flex items-center mb-7">
              {(
                [
                  { label: 'Situación', pos: 1 },
                  { label: 'Círculo',   pos: 2 },
                  { label: 'Contexto',  pos: 3 },
                ] as const
              ).map(({ label, pos }, i) => {
                const st       = stepState(pos)
                const isActive = st === 'active'
                const isDone   = st === 'done'
                return (
                  <Fragment key={label}>
                    <div
                      className="flex flex-col items-center gap-[5px]"
                      style={{ opacity: isActive || isDone ? 1 : 0.25, transition: 'opacity 0.2s' }}
                    >
                      <div
                        style={{
                          width: 26, height: 26, borderRadius: '50%',
                          border: `1.5px solid ${isActive || isDone ? '#0A7E8C' : 'rgba(10,126,140,0.12)'}`,
                          background: isActive ? '#0A7E8C' : isDone ? 'rgba(10,126,140,0.10)' : 'white',
                          color: isActive ? 'white' : isDone ? '#0A7E8C' : '#5a7478',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700,
                          transition: 'all 0.2s',
                        }}
                      >
                        {isDone ? '✓' : pos}
                      </div>
                      <span
                        style={{
                          fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
                          textTransform: 'uppercase', whiteSpace: 'nowrap',
                          color: isActive || isDone ? '#0A7E8C' : '#5a7478',
                        }}
                      >
                        {label}
                      </span>
                    </div>
                    {i < 2 && (
                      <div
                        style={{
                          flex: 1, height: 1.5, minWidth: 32, marginBottom: 17,
                          background: isDone ? '#0A7E8C' : 'rgba(10,126,140,0.12)',
                          transition: 'background 0.2s',
                        }}
                      />
                    )}
                  </Fragment>
                )
              })}
            </div>

            {/* ── STEP 2 — Crisis ───────────────────────────────────────── */}
            {step === 2 && (
              <div className="ob-step-panel">
                <p className="text-2xl font-extrabold text-[#1A1A2E] mb-2 tracking-tight">
                  ¿Qué está pasando?
                </p>
                <p className="text-[#5a7478] mb-6 leading-relaxed" style={{ fontSize: '0.95rem' }}>
                  Contalo con tus palabras. Voy a armar el contexto para ayudarte.
                </p>

                <textarea
                  rows={4}
                  value={crisis}
                  onChange={e => setCrisis(e.target.value)}
                  placeholder="Escribí lo que está pasando…"
                  className="w-full rounded-2xl px-4 py-3 text-[#1A1A2E] text-sm outline-none resize-none transition-all"
                  style={{ background: '#FAF8F5', border: '1.5px solid rgba(10,126,140,0.12)', fontFamily: 'inherit' }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#0A7E8C'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(10,126,140,0.09)' }}
                  onBlur={e  => { e.currentTarget.style.borderColor = 'rgba(10,126,140,0.12)'; e.currentTarget.style.boxShadow = 'none' }}
                />

                <StepNav
                  onBack={() => setStep(1)}
                  onSkip={() => setStep(3)}
                  onNext={handleStep2Next}
                />
              </div>
            )}

            {/* ── STEP 3 — Contacts ─────────────────────────────────────── */}
            {step === 3 && (
              <div className="ob-step-panel">
                <p className="text-2xl font-extrabold text-[#1A1A2E] mb-2 tracking-tight">
                  ¿Quién forma tu círculo?
                </p>
                <p className="text-[#5a7478] mb-6 leading-relaxed" style={{ fontSize: '0.95rem' }}>
                  Nombre, rol y cercanía. El agente los activa según lo que necesites.
                </p>

                <div className="flex flex-col gap-2.5">
                  {contacts.map((c, idx) => (
                    <div
                      key={c.id}
                      className="rounded-2xl px-4 py-3.5"
                      style={{ background: '#FAF8F5', border: '1.5px solid rgba(10,126,140,0.12)' }}
                    >
                      {/* Row 1: avatar + name + phone + remove */}
                      <div className="flex items-center gap-2 mb-2.5">
                        <div
                          className="flex-shrink-0 flex items-center justify-center rounded-full text-white font-bold"
                          style={{ width: 36, height: 36, background: AV_GRADIENTS[idx % AV_GRADIENTS.length], fontSize: '0.78rem' }}
                        >
                          {INIT_POOL[idx % INIT_POOL.length]}
                        </div>
                        <input
                          type="text"
                          placeholder="Nombre"
                          value={c.name}
                          onChange={e => updateContact(c.id, 'name', e.target.value)}
                          className="flex-1 min-w-0 rounded-xl px-3 py-2 text-[#1A1A2E] text-sm outline-none transition-all"
                          style={{ background: 'white', border: '1.5px solid rgba(10,126,140,0.12)', fontFamily: 'inherit' }}
                          onFocus={e => e.currentTarget.style.borderColor = '#0A7E8C'}
                          onBlur={e  => e.currentTarget.style.borderColor = 'rgba(10,126,140,0.12)'}
                        />
                        <input
                          type="tel"
                          placeholder="Teléfono"
                          value={c.phone}
                          onChange={e => updateContact(c.id, 'phone', e.target.value)}
                          className="min-w-0 rounded-xl px-3 py-2 text-[#1A1A2E] text-sm outline-none transition-all"
                          style={{ width: 130, background: 'white', border: '1.5px solid rgba(10,126,140,0.12)', fontFamily: 'inherit' }}
                          onFocus={e => e.currentTarget.style.borderColor = '#0A7E8C'}
                          onBlur={e  => e.currentTarget.style.borderColor = 'rgba(10,126,140,0.12)'}
                        />
                        <button
                          type="button"
                          onClick={() => removeContact(c.id)}
                          className="flex-shrink-0 flex items-center justify-center rounded-full cursor-pointer transition-colors"
                          style={{ width: 30, height: 30, border: '1.5px solid rgba(10,126,140,0.12)', background: 'none', color: '#5a7478', fontSize: '1rem', lineHeight: 1, fontFamily: 'inherit' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = '#ba1a1a'; e.currentTarget.style.color = '#ba1a1a' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(10,126,140,0.12)'; e.currentTarget.style.color = '#5a7478' }}
                          title="Quitar"
                        >
                          ×
                        </button>
                      </div>

                      {/* Row 2: role + proximity (indented past avatar) */}
                      <div className="flex gap-2" style={{ paddingLeft: 44 }}>
                        <select
                          value={c.role}
                          onChange={e => updateContact(c.id, 'role', e.target.value)}
                          className="flex-1 min-w-0 rounded-xl px-3 py-2 text-[#1A1A2E] text-sm outline-none cursor-pointer"
                          style={{ background: 'white', border: '1.5px solid rgba(10,126,140,0.12)', fontFamily: 'inherit' }}
                          aria-label="Rol"
                        >
                          <option value="">¿Qué rol tiene?</option>
                          <option value="acompanamiento">Acompañamiento</option>
                          <option value="logistica">Logístico</option>
                          <option value="prestador">Prestador de servicios</option>
                        </select>
                        <select
                          value={c.proximity}
                          onChange={e => updateContact(c.id, 'proximity', e.target.value)}
                          className="flex-1 min-w-0 rounded-xl px-3 py-2 text-[#1A1A2E] text-sm outline-none cursor-pointer"
                          style={{ background: 'white', border: '1.5px solid rgba(10,126,140,0.12)', fontFamily: 'inherit' }}
                          aria-label="Cercanía"
                        >
                          <option value="">¿Qué tan cercana?</option>
                          <option value="nucleo">Es parte de mi núcleo</option>
                          <option value="ayuda">Me ayuda o puede ayudar</option>
                          <option value="profesional">Proveedor o profesional</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addContact}
                  className="mt-3 mb-6 rounded-full px-4 py-2 text-sm font-semibold cursor-pointer transition-colors text-[#0A7E8C] hover:bg-[rgba(10,126,140,0.06)]"
                  style={{ border: '1.5px solid rgba(10,126,140,0.20)', background: 'none', fontFamily: 'inherit' }}
                >
                  + Agregar persona
                </button>

                <StepNav
                  onBack={() => setStep(2)}
                  onSkip={() => setStep(4)}
                  onNext={handleStep3Next}
                />
              </div>
            )}

            {/* ── STEP 4 — Chat ─────────────────────────────────────────── */}
            {step === 4 && (
              <div className="ob-step-panel">
                <p className="text-2xl font-extrabold text-[#1A1A2E] mb-2 tracking-tight">
                  ¿Qué más podés contarme?
                </p>
                <p className="text-[#5a7478] mb-5 leading-relaxed" style={{ fontSize: '0.95rem' }}>
                  Todo lo que me cuentes me contextualizará mejor.
                </p>

                {/* Chat container */}
                <div
                  className="rounded-2xl overflow-hidden mb-5"
                  style={{ border: '1.5px solid rgba(10,126,140,0.12)', background: '#FAF8F5' }}
                >
                  {/* Messages */}
                  <div
                    ref={chatLogRef}
                    className="flex flex-col gap-2.5 p-4 overflow-y-auto"
                    style={{ height: 230, scrollBehavior: 'smooth' }}
                  >
                    {chatMsgs.map(msg => (
                      <div
                        key={msg.id}
                        className="ob-chat-msg"
                        style={{
                          maxWidth: '82%',
                          padding: '10px 14px',
                          fontSize: '0.875rem',
                          lineHeight: 1.5,
                          alignSelf: msg.from === 'circl' ? 'flex-start' : 'flex-end',
                          borderRadius: msg.from === 'circl' ? '18px 18px 18px 4px' : '18px 18px 4px 18px',
                          background: msg.from === 'circl' ? 'white' : '#0A7E8C',
                          border: msg.from === 'circl' ? '1.5px solid rgba(10,126,140,0.12)' : 'none',
                          color: msg.from === 'circl' ? '#1A1A2E' : 'white',
                        }}
                      >
                        {msg.text}
                      </div>
                    ))}

                    {isTyping && (
                      <div
                        className="self-start flex items-center gap-1 px-3.5 py-2.5"
                        style={{
                          width: 60,
                          background: 'white',
                          border: '1.5px solid rgba(10,126,140,0.12)',
                          borderRadius: '18px 18px 18px 4px',
                        }}
                      >
                        <span className="ob-typing-dot inline-block rounded-full bg-[#5a7478]" style={{ width: 6, height: 6 }} />
                        <span className="ob-typing-dot inline-block rounded-full bg-[#5a7478]" style={{ width: 6, height: 6 }} />
                        <span className="ob-typing-dot inline-block rounded-full bg-[#5a7478]" style={{ width: 6, height: 6 }} />
                      </div>
                    )}
                  </div>

                  {/* Input row */}
                  <div
                    className="flex items-center gap-2 px-3 py-2.5 bg-white"
                    style={{ borderTop: '1px solid rgba(10,126,140,0.12)' }}
                  >
                    <input
                      type="text"
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendChatMessage() } }}
                      placeholder="Escribí tu respuesta…"
                      autoComplete="off"
                      className="flex-1 border-none outline-none text-sm text-[#1A1A2E] bg-transparent"
                      style={{ fontFamily: 'inherit', color: '#1A1A2E' }}
                    />
                    <button
                      type="button"
                      onClick={() => { sendChatMessage() }}
                      disabled={isTyping}
                      className="flex-shrink-0 flex items-center justify-center rounded-full transition-colors"
                      style={{ width: 34, height: 34, background: '#0A7E8C', border: 'none', cursor: isTyping ? 'not-allowed' : 'pointer', opacity: isTyping ? 0.55 : 1 }}
                      onMouseEnter={e => { if (!isTyping) e.currentTarget.style.background = '#065e6a' }}
                      onMouseLeave={e => (e.currentTarget.style.background = '#0A7E8C')}
                      aria-label="Enviar"
                    >
                      <IconSend />
                    </button>
                  </div>
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between gap-3">
                  <BtnBack onClick={() => setStep(3)} />
                  <div className="flex items-center gap-2">
                    <BtnSkip onClick={() => router.push('/dashboard')} label="Omitir" />
                    <button
                      type="button"
                      onClick={() => router.push('/dashboard')}
                      className="bg-[#0A7E8C] text-white font-bold rounded-full py-3 px-6 cursor-pointer hover:brightness-110 active:scale-[0.97] transition-all"
                      style={{ fontFamily: 'inherit' }}
                    >
                      Finalizar
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StepNav({
  onBack,
  onSkip,
  onNext,
  nextLabel = 'Continuar',
}: {
  onBack: () => void
  onSkip: () => void
  onNext: () => void
  nextLabel?: string
}) {
  return (
    <div className="flex items-center justify-between mt-7 gap-3">
      <BtnBack onClick={onBack} />
      <div className="flex items-center gap-2">
        <BtnSkip onClick={onSkip} label="Omitir" />
        <button
          type="button"
          onClick={onNext}
          className="bg-[#0A7E8C] text-white font-bold rounded-full py-3 px-6 cursor-pointer hover:brightness-110 active:scale-[0.97] transition-all"
          style={{ fontFamily: 'inherit' }}
        >
          {nextLabel}
        </button>
      </div>
    </div>
  )
}

function BtnBack({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full px-[22px] py-3 font-bold text-[#5a7478] cursor-pointer transition-colors"
      style={{ border: '1.5px solid rgba(10,126,140,0.12)', background: 'none', fontFamily: 'inherit', fontSize: 'inherit' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#0A7E8C'; e.currentTarget.style.color = '#0A7E8C' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(10,126,140,0.12)'; e.currentTarget.style.color = '#5a7478' }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
      Atrás
    </button>
  )
}

function BtnSkip({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-2 text-sm font-semibold cursor-pointer bg-transparent border-none text-[#5a7478] transition-colors"
      style={{ fontFamily: 'inherit' }}
      onMouseEnter={e => (e.currentTarget.style.color = '#0A7E8C')}
      onMouseLeave={e => (e.currentTarget.style.color = '#5a7478')}
    >
      {label}
    </button>
  )
}

function IconSend() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22 2L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2L15 22L11 13L2 9L22 2Z" fill="white" />
    </svg>
  )
}
