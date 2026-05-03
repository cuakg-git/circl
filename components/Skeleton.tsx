'use client'

import React from 'react'

// ─── Shimmer keyframes ─────────────────────────────────────────────────────────
// Render <SkeletonStyles /> once inside the JSX of any page that uses skeletons.
// All sibling skeleton components rely on the `sk-shimmer` keyframe it defines.

export function SkeletonStyles() {
  return (
    <style>{`
      @keyframes sk-shimmer {
        0%   { background-position:  200% 0 }
        100% { background-position: -200% 0 }
      }
    `}</style>
  )
}

// ─── Shimmer base style (shared) ──────────────────────────────────────────────

const SHIMMER: React.CSSProperties = {
  background:               'linear-gradient(90deg, rgba(10,126,140,0.06) 25%, rgba(10,126,140,0.12) 50%, rgba(10,126,140,0.06) 75%)',
  backgroundSize:           '200% 100%',
  animationName:            'sk-shimmer',
  animationDuration:        '1.5s',
  animationIterationCount:  'infinite',
  animationTimingFunction:  'linear',
}

// ─── SkeletonBase ──────────────────────────────────────────────────────────────

export function SkeletonBase({
  width,
  height,
  className,
  style,
}: {
  width?:     string | number
  height?:    string | number
  className?: string
  style?:     React.CSSProperties
}) {
  return (
    <div
      className={className}
      style={{
        width:        width  ?? '100%',
        height:       height ?? 16,
        borderRadius: '0.5rem',
        flexShrink:   0,
        ...SHIMMER,
        ...style,
      }}
    />
  )
}

// ─── SkeletonText ──────────────────────────────────────────────────────────────

export function SkeletonText({
  width = '100%',
  className,
  style,
}: {
  width?:     string | number
  className?: string
  style?:     React.CSSProperties
}) {
  return <SkeletonBase width={width} height={14} className={className} style={style} />
}

// ─── SkeletonAvatar ────────────────────────────────────────────────────────────

export function SkeletonAvatar({ size = 40 }: { size?: number }) {
  return (
    <SkeletonBase
      width={size}
      height={size}
      style={{ borderRadius: '50%' }}
    />
  )
}

// ─── SkeletonCard ──────────────────────────────────────────────────────────────
// White card wrapper matching the real Card dimensions.

export function SkeletonCard({
  children,
  className,
  style,
}: {
  children?:  React.ReactNode
  className?: string
  style?:     React.CSSProperties
}) {
  return (
    <div
      className={className}
      style={{
        background:   '#FFFFFF',
        borderRadius: '1.5rem',
        boxShadow:    '0 4px 24px rgba(10,126,140,0.08)',
        padding:      '20px',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
