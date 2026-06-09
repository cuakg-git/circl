'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles, ChevronRight, X, Send } from 'lucide-react'

type Props = {
  /** Texto del contexto generado. null si todavía no hay. */
  contextText: string | null
  /** Handler que se ejecuta al enviar una novedad. El padre
   *  debe llamar a su endpoint y actualizar contextText. */
  onSendNovedad: (text: string) => Promise<void> | void
  /** Está cargando el contexto desde el backend. */
  isLoadingContext?: boolean
  /** Está enviando una novedad. */
  isSendingNovedad?: boolean
  /** Label custom para el estado vacío (si no se pasa, usa
   *  "Mhiru todavía no tiene contexto de este tema."). */
  emptyStateLabel?: string
  /** Título del drawer (si no se pasa, usa "Lo que sé del tema"). */
  drawerTitle?: string
}

function getFirstSentence(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]/)
  return match ? match[0].trim() : text
}

export default function ContextStripDrawer({
  contextText,
  onSendNovedad,
  isLoadingContext = false,
  isSendingNovedad = false,
  emptyStateLabel = 'Mhiru todavía no tiene contexto de este tema.',
  drawerTitle = 'Lo que sé del tema',
}: Props) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const isEmpty   = !contextText || contextText.trim().length === 0
  const stripText = isEmpty
    ? emptyStateLabel
    : getFirstSentence(contextText!)

  // ESC para cerrar
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // Body scroll lock cuando el drawer está abierto
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [open])

  // Focus input al abrir si es estado vacío
  useEffect(() => {
    if (open && isEmpty && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 250)
    }
  }, [open, isEmpty])

  async function handleSubmit() {
    const text = input.trim()
    if (!text || isSendingNovedad) return
    await onSendNovedad(text)
    setInput('')
  }

  function handleStripClick() {
    setOpen(true)
  }

  return (
    <>
      <style>{`
        @keyframes csd-slide-in-right {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes csd-slide-in-bottom {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @keyframes csd-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .csd-backdrop {
          animation: csd-fade-in 0.2s ease-out;
        }
        .csd-panel-desktop {
          animation: csd-slide-in-right 0.22s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .csd-panel-mobile {
          animation: csd-slide-in-bottom 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        @media (max-width: 640px) {
          .csd-panel-desktop-only { display: none !important; }
          .csd-strip {
            height: auto !important;
            padding: 16px 14px !important;
            flex-wrap: wrap !important;
            border-radius: 1rem !important;
          }
          .csd-strip-text {
            white-space: normal !important;
            text-overflow: clip !important;
            overflow: visible !important;
            flex: 1 1 calc(100% - 28px) !important;
          }
          .csd-strip-more {
            flex: 1 1 100% !important;
            justify-content: flex-end !important;
            margin-top: 8px !important;
          }
        }
        @media (min-width: 641px) {
          .csd-panel-mobile-only { display: none !important; }
        }
      `}</style>

      {/* ── Strip ─────────────────────────────────────────────────── */}
      <button
        type="button"
        className="csd-strip"
        onClick={handleStripClick}
        disabled={isLoadingContext}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          width: '100%',
          minWidth: 0,
          maxWidth: '100%',
          height: 40,
          padding: '0 14px',
          background: 'rgba(10,126,140,0.04)',
          border: 'none',
          borderRadius: 9999,
          cursor: isLoadingContext ? 'wait' : 'pointer',
          fontFamily: 'inherit',
          transition: 'background 0.15s',
          textAlign: 'left',
          opacity: isLoadingContext ? 0.6 : 1,
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
        onMouseEnter={(e) => {
          if (!isLoadingContext) e.currentTarget.style.background = 'rgba(10,126,140,0.08)'
        }}
        onMouseLeave={(e) => {
          if (!isLoadingContext) e.currentTarget.style.background = 'rgba(10,126,140,0.04)'
        }}
      >
        <Sparkles size={16} color="#0A7E8C" style={{ flexShrink: 0 }} />

        <span
          className="csd-strip-text"
          style={{
            flex: 1, minWidth: 0,
            fontSize: '0.875rem',
            color: isEmpty ? '#5a7478' : '#1A1A2E',
            fontStyle: isEmpty ? 'italic' : 'normal',
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '100%',
            display: 'block',
          }}>
          {!isEmpty && (
            <strong style={{ fontWeight: 700, color: '#1A1A2E', marginRight: 4 }}>
              Contexto:
            </strong>
          )}
          {stripText}
        </span>

        <span
          className="csd-strip-more"
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            flexShrink: 0,
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#5a7478',
          }}>
          Ver más
          <ChevronRight size={14} />
        </span>
      </button>

      {/* ── Backdrop ──────────────────────────────────────────────── */}
      {open && (
        <div
          className="csd-backdrop"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.32)',
            zIndex: 800,
          }}
        />
      )}

      {/* ── Drawer desktop (slide right) ──────────────────────────── */}
      {open && (
        <div
          className="csd-panel-desktop csd-panel-desktop-only"
          style={{
            position: 'fixed', top: 0, right: 0,
            width: 420, maxWidth: '100vw',
            height: '100vh',
            background: '#FFFFFF',
            zIndex: 801,
            display: 'flex', flexDirection: 'column',
            boxShadow: '-6px 0 32px rgba(0,0,0,0.10)',
          }}
        >
          <DrawerContent
            contextText={contextText}
            isEmpty={isEmpty}
            input={input}
            setInput={setInput}
            isSendingNovedad={isSendingNovedad}
            onSubmit={handleSubmit}
            onClose={() => setOpen(false)}
            drawerTitle={drawerTitle}
            inputRef={inputRef}
          />
        </div>
      )}

      {/* ── Drawer mobile (bottom sheet) ──────────────────────────── */}
      {open && (
        <div
          className="csd-panel-mobile csd-panel-mobile-only"
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            maxHeight: '85vh',
            background: '#FFFFFF',
            zIndex: 801,
            display: 'flex', flexDirection: 'column',
            borderTopLeftRadius: '1.25rem',
            borderTopRightRadius: '1.25rem',
            boxShadow: '0 -6px 32px rgba(0,0,0,0.12)',
          }}
        >
          {/* Drag handle visual */}
          <div style={{
            display: 'flex', justifyContent: 'center',
            padding: '10px 0 6px',
            flexShrink: 0,
          }}>
            <div style={{
              width: 40, height: 4, borderRadius: 9999,
              background: 'rgba(10,126,140,0.20)',
            }} />
          </div>

          <DrawerContent
            contextText={contextText}
            isEmpty={isEmpty}
            input={input}
            setInput={setInput}
            isSendingNovedad={isSendingNovedad}
            onSubmit={handleSubmit}
            onClose={() => setOpen(false)}
            drawerTitle={drawerTitle}
            inputRef={inputRef}
          />
        </div>
      )}
    </>
  )
}

// ── Drawer content shared entre desktop y mobile ───────────────────

type DrawerContentProps = {
  contextText: string | null
  isEmpty: boolean
  input: string
  setInput: (v: string) => void
  isSendingNovedad: boolean
  onSubmit: () => void
  onClose: () => void
  drawerTitle: string
  inputRef: React.RefObject<HTMLTextAreaElement | null>
}

function DrawerContent({
  contextText, isEmpty,
  input, setInput,
  isSendingNovedad,
  onSubmit, onClose,
  drawerTitle,
  inputRef,
}: DrawerContentProps) {
  return (
    <>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '20px 24px',
        borderBottom: '1px solid rgba(10,126,140,0.08)',
        flexShrink: 0,
      }}>
        <Sparkles size={18} color="#0A7E8C" style={{ flexShrink: 0 }} />
        <span style={{
          flex: 1, minWidth: 0,
          fontSize: '1rem', fontWeight: 800,
          color: '#1A1A2E', letterSpacing: '-0.01em',
        }}>
          {drawerTitle}
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(0,0,0,0.06)', border: 'none',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#5a7478',
            flexShrink: 0,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.11)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)' }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {/* Sección 1: Contexto */}
        <div style={{ marginBottom: 24 }}>
          <p style={{
            fontSize: '0.7rem', fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: '#5a7478', margin: '0 0 10px',
          }}>
            Contexto
          </p>
          {isEmpty ? (
            <p style={{
              fontSize: '0.875rem', color: '#5a7478',
              fontStyle: 'italic', lineHeight: 1.6, margin: 0,
            }}>
              Todavía no hay contexto generado. Contame una novedad
              abajo para que Mhiru empiece a construirlo.
            </p>
          ) : (
            <p style={{
              fontSize: '0.9375rem', color: '#1A1A2E',
              lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap',
            }}>
              {contextText}
            </p>
          )}
        </div>

        <div style={{
          height: 1, background: 'rgba(10,126,140,0.08)',
          margin: '0 -24px 20px',
        }} />

        {/* Sección 2: Minichat */}
        <div>
          <p style={{
            fontSize: '0.7rem', fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: '#5a7478', margin: '0 0 10px',
          }}>
            Editar contexto
          </p>

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSubmit()
              }
            }}
            placeholder="¿Hay algo que quieras cambiar o agregar al contexto?"
            rows={3}
            disabled={isSendingNovedad}
            style={{
              width: '100%', boxSizing: 'border-box',
              border: '1.5px solid rgba(10,126,140,0.12)',
              borderRadius: '0.85rem',
              padding: '12px 14px',
              fontSize: '0.875rem', color: '#1A1A2E',
              fontFamily: 'inherit', outline: 'none',
              background: '#FAF8F5', lineHeight: 1.55,
              resize: 'vertical', minHeight: 72,
              display: 'block',
              opacity: isSendingNovedad ? 0.6 : 1,
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#0A7E8C' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(10,126,140,0.12)' }}
          />

          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'flex-end', gap: 12,
            marginTop: 10,
          }}>
            <button
              type="button"
              onClick={onSubmit}
              disabled={isSendingNovedad || !input.trim()}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: isSendingNovedad || !input.trim()
                  ? 'rgba(10,126,140,0.35)'
                  : 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                color: 'white', border: 'none',
                borderRadius: 9999, padding: '8px 18px',
                fontSize: '0.8125rem', fontWeight: 700,
                cursor: isSendingNovedad || !input.trim() ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', flexShrink: 0,
              }}
            >
              <Send size={13} />
              {isSendingNovedad ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
