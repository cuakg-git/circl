import type { Metadata } from 'next'
import EquipoCard from './EquipoCard'

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
        <EquipoCard
          href="/equipo/cto"
          badge="Co Founder · AI Specialist"
          title="CTO: Seguridad de la información y arquitectura"
          description="A sumar como tercer cofundador."
          tags={['Cofundador', 'Full time', 'Equity de socio']}
        />

      </div>
    </div>
  )
}
