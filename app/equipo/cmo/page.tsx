import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'CMO: Marketing y crecimiento — Mhiru',
  description: 'A sumar como cofundador en Mhiru. Rol: Co-founder / CMO, foco en marketing y crecimiento.',
}

// ── Shared style token ────────────────────────────────────────────────────────

const MONO: React.CSSProperties = { fontFamily: 'var(--font-mono)' }

// ── Sub-components ────────────────────────────────────────────────────────────

function CheckCircle() {
  return (
    <div style={{
      width: 22, height: 22, borderRadius: '50%',
      background: '#2ECDA7',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, marginTop: 1,
    }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white"
        strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </div>
  )
}

function SectionDivider({ n }: { n: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <span style={{ ...MONO, fontSize: '0.65rem', fontWeight: 500, letterSpacing: '0.14em', color: '#0A7E8C' }}>
        {n}
      </span>
      <div style={{ flex: 1, height: 1, background: 'rgba(10,126,140,0.12)' }} />
    </div>
  )
}

function DotLabel({ label, dotColor, textColor }: { label: string; dotColor: string; textColor: string }) {
  return (
    <p style={{
      ...MONO,
      display: 'flex', alignItems: 'center', gap: 7,
      fontSize: '0.65rem', fontWeight: 500,
      letterSpacing: '0.12em', textTransform: 'uppercase',
      color: textColor, marginBottom: 12,
      position: 'relative', zIndex: 1,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
      {label}
    </p>
  )
}

// ── Decorative SVGs ───────────────────────────────────────────────────────────

function OrbitalFixed() {
  return (
    <div style={{
      position: 'fixed',
      bottom: -80,
      right: -80,
      width: 640,
      height: 640,
      zIndex: 0,
      pointerEvents: 'none',
      opacity: 0.55,
    }}>
      <svg viewBox="0 0 640 640" xmlns="http://www.w3.org/2000/svg" width="640" height="640">
        <path d="M 140 640 A 500 500 0 0 1 640 140"
          fill="none" stroke="rgba(10,126,140,0.30)" strokeWidth="1.5"
          strokeDasharray="2 7" strokeLinecap="round" />
        <path d="M 320 640 A 320 320 0 0 1 640 320"
          fill="none" stroke="rgba(10,126,140,0.18)" strokeWidth="1"
          strokeDasharray="2 6" strokeLinecap="round" />
        <circle cx="287" cy="287" r="7" fill="#2ECDA7" />
        <circle cx="414" cy="414" r="5" fill="#E8913A" />
      </svg>
    </div>
  )
}

function OrbitalCard({ small = false }: { small?: boolean }) {
  const size = small ? 140 : 180
  const r1   = small ? 110 : 140
  const r2   = small ? 68  : 88
  const p1   = size - r1
  const p2   = size - r2
  const dotX = small ? 40  : 50
  const dotY = small ? 40  : 50
  const dotR = small ? 4.5 : 6

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0,
      width: size, height: size,
      pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <path d={`M ${p1} ${size} A ${r1} ${r1} 0 0 1 ${size} ${p1}`}
          fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5"
          strokeDasharray="2 6" strokeLinecap="round" />
        <path d={`M ${p2} ${size} A ${r2} ${r2} 0 0 1 ${size} ${p2}`}
          fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1"
          strokeDasharray="2 5" strokeLinecap="round" />
        <circle cx={dotX} cy={dotY} r={dotR} fill="#2ECDA7" opacity="0.85" />
      </svg>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CMOPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #FAF8F5 0%, #F4F1EC 100%)',
      fontFamily: 'var(--font-plus-jakarta-sans), sans-serif',
      position: 'relative',
    }}>
      <OrbitalFixed />

      <div style={{
        maxWidth: 860,
        margin: '0 auto',
        padding: '0 24px 96px',
        position: 'relative',
        zIndex: 1,
      }}>

        {/* ══════════════════════════════════════════════════════════════
            DOC HEADER
        ══════════════════════════════════════════════════════════════ */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '28px 0 24px',
          borderBottom: '1px solid rgba(10,126,140,0.12)',
          marginBottom: 48,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Image
              src="/LOGO_CIRCL_2.svg"
              alt="Mhiru"
              width={28}
              height={28}
              style={{ width: 'auto', height: 28 }}
            />
            <span style={{
              fontSize: '1rem', fontWeight: 800,
              letterSpacing: '-0.02em', color: '#1A1A2E',
            }}>
              Mhiru
            </span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ ...MONO, fontSize: '0.75rem', color: '#5a7478', lineHeight: 1.5 }}>
              Job Description
            </p>
            <p style={{ ...MONO, fontSize: '0.75rem', color: '#5a7478', lineHeight: 1.5 }}>
              Mayo 2026 · v1
            </p>
          </div>
        </div> 

        {/* ══════════════════════════════════════════════════════════════
            HERO
        ══════════════════════════════════════════════════════════════ */}

        <p style={{
          ...MONO,
          fontSize: '0.65rem', fontWeight: 500,
          letterSpacing: '0.16em', textTransform: 'uppercase',
          color: '#0A7E8C', marginBottom: 16,
        }}>
          Co Founder · Marketing y crecimiento
        </p>

        <h1 style={{
          fontSize: 'clamp(1.75rem, 4.5vw, 2.5rem)',
          fontWeight: 800, letterSpacing: '-0.03em',
          lineHeight: 1.1, color: '#1A1A2E', marginBottom: 12,
        }}>
          CMO: Marketing y crecimiento
        </h1>

        <p style={{
          fontSize: '1.0625rem', color: '#5a7478',
          lineHeight: 1.6, marginBottom: 20,
        }}>
          A sumar como cofundador.
        </p>

        {/* Tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 40 }}>
          {[
            { label: 'Cofundador',      dot: '#0A7E8C', bg: 'rgba(10,126,140,0.07)'  },
            { label: 'Full time',       dot: '#2ECDA7', bg: 'rgba(46,205,167,0.08)'  },
            { label: 'Equity de socio', dot: '#E8913A', bg: 'rgba(232,145,58,0.08)'  },
          ].map(({ label, dot, bg }) => (
            <span key={label} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              fontSize: '0.7rem', fontWeight: 700,
              letterSpacing: '0.05em', textTransform: 'uppercase',
              background: bg, color: '#1A1A2E',
              borderRadius: 9999, padding: '5px 13px',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
              {label}
            </span>
          ))}
        </div>

        {/* Metrics grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 1,
          background: 'rgba(10,126,140,0.10)',
          borderRadius: '1.25rem', overflow: 'hidden',
          marginBottom: 64,
        }}>
          {[
            { label: 'ROL',         value: 'Co-founder / CMO'       },
            { label: 'FOCO',        value: 'Marketing & crecimiento' },
            { label: 'COMPROMISO',  value: 'Full time cofundador'    },
            { label: 'EXPERIENCIA', value: 'Track record medible'    },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: '#FFFFFF', padding: '20px 24px' }}>
              <p style={{
                ...MONO,
                fontSize: '0.6rem', fontWeight: 500,
                letterSpacing: '0.13em', textTransform: 'uppercase',
                color: '#5a7478', marginBottom: 6,
              }}>
                {label}
              </p>
              <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1A1A2E', lineHeight: 1.3 }}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════
            01 — MISIÓN
        ══════════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: 64 }}>
          <SectionDivider n="01" />

          <h2 style={{
            fontSize: '1.375rem', fontWeight: 800,
            letterSpacing: '-0.02em', color: '#1A1A2E', marginBottom: 20,
          }}>
            Misión
          </h2>

          <div style={{
            background: '#1A1A2E', borderRadius: '1.5rem',
            padding: '32px', position: 'relative', overflow: 'hidden',
          }}>
            <OrbitalCard />
            <p style={{
              ...MONO,
              fontSize: '0.65rem', fontWeight: 500,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: '#2ECDA7', marginBottom: 16,
              position: 'relative', zIndex: 1,
            }}>
              Misión
            </p>
            <p style={{
              fontSize: '1.0625rem',
              color: 'rgba(255,255,255,0.88)',
              lineHeight: 1.75,
              position: 'relative', zIndex: 1,
            }}>
              Que Mhiru atraiga y enamore a su usuaria de manera genuina.
              Que la comunicación conecte de verdad con quien atraviesa una
              crisis, sin caer nunca en el marketing que vende humo.
            </p>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            02 — LLEVA ADELANTE
        ══════════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: 64 }}>
          <SectionDivider n="02" />

          <h2 style={{
            fontSize: '1.375rem', fontWeight: 800,
            letterSpacing: '-0.02em', color: '#1A1A2E', marginBottom: 28,
          }}>
            Lleva adelante
          </h2>

          <div style={{
            background: '#FFFFFF', borderRadius: '1.5rem',
            boxShadow: '0 4px 24px rgba(10,126,140,0.07)',
            overflow: 'hidden', marginBottom: 24,
          }}>
            {[
              {
                n: '01',
                title: 'Estrategia de go to market',
                body:  'Cómo y cuándo Mhiru sale al mercado, en coordinación con el resto del equipo.',
              },
              {
                n: '02',
                title: 'Estrategia de comunicación y posicionamiento de marca',
                body:  '',
              },
              {
                n: '03',
                title: 'Adquisición de clientes',
                body:  'Entender el funnel, las métricas, dónde y cómo llega la usuaria target.',
              },
              {
                n: '04',
                title: 'Investigación profunda de la audiencia',
                body:  'Mujer de treinta y pico gestionando una crisis de salud familiar, para construir mensajes que nazcan del insight, no del capricho.',
              },
              {
                n: '05',
                title: 'Estrategia de contenido y distribución del canal propio',
                body:  'Coordinando con Franco como cara y host cuando corresponda.',
              },
              {
                n: '06',
                title: 'Análisis de marketing y medición',
                body:  'Qué comunicación funciona y qué no, trabajado de forma compartida con la data del negocio.',
              },
            ].map(({ n, title, body }, i, arr) => (
              <div key={n} style={{
                display: 'flex', gap: 20, padding: '22px 28px',
                borderBottom: i < arr.length - 1 ? '1px solid rgba(10,126,140,0.08)' : 'none',
              }}>
                <span style={{
                  ...MONO,
                  fontSize: '0.65rem', fontWeight: 500,
                  color: '#0A7E8C', letterSpacing: '0.1em',
                  flexShrink: 0, paddingTop: 3, minWidth: 24,
                }}>
                  {n}
                </span>
                <div>
                  <p style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1A1A2E', marginBottom: body ? 4 : 0 }}>
                    {title}
                  </p>
                  {body && (
                    <p style={{ fontSize: '0.875rem', color: '#5a7478', lineHeight: 1.55 }}>
                      {body}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Decide / Co-construye */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}>
            <div style={{
              background: '#FFFFFF', borderRadius: '1.25rem', padding: '24px',
              boxShadow: '0 4px 24px rgba(10,126,140,0.07)',
              border: '1.5px solid rgba(10,126,140,0.12)',
            }}>
              <DotLabel label="Decide" dotColor="#2ECDA7" textColor="#0A7E8C" />
              <p style={{ fontSize: '0.9375rem', color: '#5a7478', lineHeight: 1.65 }}>
                El go to market, el mensaje, el posicionamiento, los canales
                y la estrategia de adquisición.
              </p>
            </div>

            <div style={{
              background: '#FFFFFF', borderRadius: '1.25rem', padding: '24px',
              boxShadow: '0 4px 24px rgba(10,126,140,0.07)',
              border: '1.5px solid rgba(10,126,140,0.12)',
            }}>
              <DotLabel label="Co construye con el equipo" dotColor="#E8913A" textColor="#E8913A" />
              <p style={{ fontSize: '0.9375rem', color: '#5a7478', lineHeight: 1.65 }}>
                La identidad de Mhiru, el propósito de la empresa, la cultura interna,
                y las decisiones grandes de rumbo de producto, negocio y tecnología.
              </p>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            03 — PERFIL QUE BUSCAMOS
        ══════════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: 64 }}>
          <SectionDivider n="03" />

          <h2 style={{
            fontSize: '1.375rem', fontWeight: 800,
            letterSpacing: '-0.02em', color: '#1A1A2E', marginBottom: 24,
          }}>
            Perfil que buscamos
          </h2>

          <div style={{
            background: '#FFFFFF', borderRadius: '1.5rem',
            boxShadow: '0 4px 24px rgba(10,126,140,0.07)',
            padding: '8px 0',
          }}>
            {[
              'Cabeza analítica y estratégica más que creativa pura: piensa en datos, funnels, segmentos e insight.',
              'Experiencia construyendo marcas o estrategias de adquisición que conectaron de verdad, con resultados medibles.',
              'Sensibilidad para comunicar en un dominio delicado como la salud sin sonar a vendedor.',
              'Capacidad de entender a la usuaria en profundidad y traducir ese entendimiento en mensaje.',
              'Cómodo midiendo e iterando, no enamorado de sus propias ideas.',
              'Que crea en el principio facilitador, nunca actor, y en escuchar antes de vender.',
            ].map((item, i, arr) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 14, padding: '18px 28px',
                borderBottom: i < arr.length - 1 ? '1px solid rgba(10,126,140,0.07)' : 'none',
              }}>
                <CheckCircle />
                <p style={{ fontSize: '0.9375rem', color: '#1A1A2E', lineHeight: 1.55 }}>
                  {item}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            04 — SOBRE MHIRU
        ══════════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: 72 }}>
          <SectionDivider n="04" />

          <h2 style={{
            fontSize: '1.375rem', fontWeight: 800,
            letterSpacing: '-0.02em', color: '#1A1A2E', marginBottom: 24,
          }}>
            Sobre Mhiru
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}>
            {/* Light card — Misión */}
            <div style={{
              background: '#FFFFFF', borderRadius: '1.25rem', padding: '28px',
              boxShadow: '0 4px 24px rgba(10,126,140,0.07)',
              borderTop: '2px solid #0A7E8C',
            }}>
              <p style={{
                ...MONO,
                fontSize: '0.65rem', fontWeight: 500,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: '#0A7E8C', marginBottom: 14,
              }}>
                Misión
              </p>
              <p style={{ fontSize: '0.9375rem', color: '#5a7478', lineHeight: 1.7 }}>
                En Mhiru democratizamos el bienestar de cada persona, su familia y su
                comunidad: que estar bien y saber salir adelante en los momentos difíciles
                dependa cada vez menos de las cartas que te tocaron.
              </p>
            </div>

            {/* Dark card — Filosofía */}
            <div style={{
              background: '#1A1A2E', borderRadius: '1.25rem',
              padding: '28px', position: 'relative', overflow: 'hidden',
            }}>
              <OrbitalCard small />
              <DotLabel label="Nuestra filosofía de trabajo" dotColor="#2ECDA7" textColor="#2ECDA7" />
              <p style={{
                fontSize: '0.9375rem',
                color: 'rgba(255,255,255,0.80)',
                lineHeight: 1.7,
                position: 'relative', zIndex: 1,
              }}>
                Como emprendimiento AI native, asumimos que lo que nos parecía imposible
                ahora es posible, hasta que la realidad nos demuestre lo contrario.
              </p>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            FOOTER
        ══════════════════════════════════════════════════════════════ */}
        <div style={{
          borderTop: '1px solid rgba(10,126,140,0.10)',
          paddingTop: 24,
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Image
              src="/LOGO_CIRCL_2.svg"
              alt="Mhiru"
              width={18}
              height={18}
              style={{ width: 'auto', height: 18 }}
            />
            <span style={{
              ...MONO,
              fontSize: '0.7rem', letterSpacing: '0.10em',
              textTransform: 'uppercase', color: '#5a7478',
            }}>
              Mhiru · Cofounder Search
            </span>
          </div> 
        </div>

      </div>
    </div>
  )
}
