'use client'

import Link from 'next/link'

interface EquipoCardProps {
  href: string
  badge: string
  title: string
  description: string
  tags: string[]
}

export default function EquipoCard({ href, badge, title, description, tags }: EquipoCardProps) {
  return (
    <Link
      href={href}
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
        {badge}
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
        {title}
      </h2>

      {/* Description */}
      <p style={{
        fontSize: '0.9375rem',
        color: '#5a7478',
        lineHeight: 1.6,
        marginBottom: 20,
      }}>
        {description}
      </p>

      {/* Tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        {tags.map((tag) => (
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
  )
}
