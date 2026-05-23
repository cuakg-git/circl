'use client'

import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Equipo — Mhiru',
  description: 'Construimos Mhiru con las personas correctas, no con las más rápidas en llegar.',
}

export default function EquipoPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#FAF8F5',
      fontFamily: 'var(--font-plus-jakarta-sans), sans-serif',
    }}>
      <div style={{
        maxWidth: 860,
        margin: '0 auto',
        padding: '64px 24px 80px',
      }}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 56 }}>
          <p style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#0A7E8C',
            marginBottom: 16,
          }}>
            Mhiru · Equipo
          </p>
          <h1 style={{
            fontSize: 'clamp(2rem, 5vw, 2.75rem)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            color: '#1A1A2E',
            marginBottom: 16,
          }}>
            Estamos buscando
          </h1>
          <p style={{
            fontSize: '1.0625rem',
            color: '#5a7478',
            lineHeight: 1.65,
            maxWidth: 520,
          }}>
            Construimos Mhiru con las personas correctas, no con las más rápidas en llegar.
          </p>
        </div>

        {/* ── Divider ─────────────────────────────────────────────────── */}
        <div style={{
          height: 1,
          background: 'rgba(10,126,140,0.10)',
          marginBottom: 40,
        }} />

        {/* ── Role card ───────────────────────────────────────────────── */}
        <Link
          href="/equipo/cto"
          style={{
            display: 'block',
            background: '#FFFFFF',
            borderRadius: '1.5rem',
            boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
            padding: '32px',
            textDecoration: 'none',
            color: 'inherit',
            border: '1.5px solid transparent',
            transition: 'box-shadow 0.2s, transform 0.2s, border-color 0.2s',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLAnchorElement
            el.style.boxShadow = '0 8px 40px rgba(10,126,140,0.14)'
            el.style.transform = 'translateY(-2px)'
            el.style.borderColor = 'rgba(10,126,140,0.15)'
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLAnchorElement
            el.style.boxShadow = '0 4px 24px rgba(10,126,140,0.08)'
            el.style.transform = 'translateY(0)'
            el.style.borderColor = 'transparent'
          }}
        >
          {/* Badge */}
          <p style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#0A7E8C',
            marginBottom: 14,
          }}>
            Co Founder · AI Specialist
          </p>

          {/* Title */}
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: '#1A1A2E',
            marginBottom: 10,
            lineHeight: 1.25,
          }}>
            CTO: Seguridad de la información y arquitectura
          </h2>

          {/* Description */}
          <p style={{
            fontSize: '0.9375rem',
            color: '#5a7478',
            lineHeight: 1.6,
            marginBottom: 20,
          }}>
            A sumar como tercer cofundador.
          </p>

          {/* Tags */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
            {['Cofundador', 'Full time', 'Equity de socio'].map((tag) => (
              <span key={tag} style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                background: 'rgba(10,126,140,0.07)',
                color: '#0A7E8C',
                borderRadius: 9999,
                padding: '4px 12px',
              }}>
                {tag}
              </span>
            ))}
          </div>

          {/* CTA */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.875rem',
            fontWeight: 700,
            color: '#0A7E8C',
          }}>
            Ver posición
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </div>
        </Link>

      </div>
    </div>
  )
}
