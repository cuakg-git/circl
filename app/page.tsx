'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
// ── Data ──────────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: '¿Las personas de mi círculo necesitan descargarse algo?',
    a: 'No. Quienes forman tu círculo pueden participar directamente desde WhatsApp. No necesitan crear una cuenta ni instalar ninguna aplicación.',
  },
  {
    q: '¿Es segura mi información?',
    a: 'Absolutamente. Toda la información de salud está encriptada de extremo a extremo. Solo las personas que vos autorices explícitamente tienen acceso a los detalles de tu situación.',
  },
  {
    q: '¿Tiene costo?',
    a: 'Por ahora estoy en acceso anticipado completamente gratuito. Quiero asegurarme de que ninguna familia enfrente una crisis sola por una cuestión económica.',
  },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [openFaq,  setOpenFaq]  = useState<number | null>(null)

  // Parallax targets — updated directly via DOM ref (avoids React re-render overwriting them)
  const heroBlobRef  = useRef<HTMLDivElement>(null)
  const ctaRingRef   = useRef<HTMLDivElement>(null)
  const ctaSectRef   = useRef<HTMLElement>(null)
  const emotionalRef = useRef<HTMLElement>(null)

  // IntersectionObserver targets
  const heroRevealRef  = useRef<HTMLDivElement>(null)
  const faqRevealRef   = useRef<HTMLElement>(null)
  const howCard1Ref    = useRef<HTMLDivElement>(null)
  const howCard2Ref    = useRef<HTMLDivElement>(null)
  const howCard3Ref    = useRef<HTMLDivElement>(null)
  const howCard4Ref    = useRef<HTMLDivElement>(null)
  const previewCardRef = useRef<HTMLDivElement>(null)

  // Cursor glow & FAQ bodies
  const glowRef     = useRef<HTMLDivElement>(null)
  const faqBodyRefs = useRef<(HTMLDivElement | null)[]>([])

  // ── Scroll + observers ────────────────────────────────────────────────────

  useEffect(() => {
    let raf: number | null = null

    function tick(sy: number) {
      const vh = window.innerHeight

      if (heroBlobRef.current)
        heroBlobRef.current.style.transform = `translate(-50%, calc(-50% + ${sy * 0.3}px))`

      if (emotionalRef.current) {
        const rect   = emotionalRef.current.getBoundingClientRect()
        const center = rect.top + rect.height / 2
        const dist   = Math.abs(center - vh / 2)
        let op = 1 - Math.max(0, (dist - vh * 0.25)) / (vh * 0.55)
        op = Math.max(0, Math.min(1, op))
        emotionalRef.current.style.opacity = op.toFixed(3)
      }

      if (ctaRingRef.current && ctaSectRef.current) {
        const rect   = ctaSectRef.current.getBoundingClientRect()
        const offset = sy - (rect.top + sy)
        ctaRingRef.current.style.transform = `translate(-50%, calc(-50% + ${offset * -0.3}px))`
      }
    }

    function onScroll() {
      const sy = window.scrollY
      setScrolled(sy > 0)
      if (!raf) raf = requestAnimationFrame(() => { tick(sy); raf = null })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    setScrolled(window.scrollY > 0)
    tick(window.scrollY)

    // Reveal fade-in
    const revealObs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('p-visible'); revealObs.unobserve(e.target) } })
    }, { threshold: 0.10 })
    if (heroRevealRef.current) revealObs.observe(heroRevealRef.current)
    if (faqRevealRef.current)  revealObs.observe(faqRevealRef.current)

    // How-cards + preview
    const howObs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('how-visible'); howObs.unobserve(e.target) } })
    }, { threshold: 0.12 })
    ;[howCard1Ref, howCard2Ref, howCard3Ref, howCard4Ref, previewCardRef].forEach((r) => {
      if (r.current) howObs.observe(r.current)
    })

    // Cursor glow
    const onMove = (e: MouseEvent) => {
      if (!glowRef.current) return
      glowRef.current.style.left    = e.clientX + 'px'
      glowRef.current.style.top     = e.clientY + 'px'
      glowRef.current.style.opacity = '1'
    }
    const onLeave = () => { if (glowRef.current) glowRef.current.style.opacity = '0' }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseleave', onLeave)

    return () => {
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
      revealObs.disconnect()
      howObs.disconnect()
    }
  }, [])

  // ── Helpers ───────────────────────────────────────────────────────────────

  function closeMenu() { setMenuOpen(false); document.body.style.overflow = '' }
  function toggleMenu() {
    if (menuOpen) { closeMenu() } else { setMenuOpen(true); document.body.style.overflow = 'hidden' }
  }

  function toggleFaq(i: number) {
    const body = faqBodyRefs.current[i]
    if (!body) return
    if (openFaq === i) {
      body.style.maxHeight = '0'
      setOpenFaq(null)
    } else {
      if (openFaq !== null) {
        const prev = faqBodyRefs.current[openFaq]
        if (prev) prev.style.maxHeight = '0'
      }
      body.style.maxHeight = body.scrollHeight + 'px'
      setOpenFaq(i)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        color: '#1a2326', overflowX: 'hidden', width: '100%', maxWidth: '100vw',
        background:
          'radial-gradient(ellipse at 15% 15%, rgba(61,199,166,0.12) 0%, transparent 55%),' +
          'radial-gradient(ellipse at 85% 10%, rgba(80,220,175,0.08) 0%, transparent 50%),' +
          'radial-gradient(ellipse at 88% 82%, rgba(224,121,49,0.12) 0%, transparent 52%),' +
          'radial-gradient(ellipse at 12% 88%, rgba(158,160,81,0.22) 0%, transparent 50%),' +
          'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.6) 0%, transparent 65%),' +
          '#f0f4f8',
        backgroundAttachment: 'fixed',
      }}
    >

      {/* ── All animations & component-specific styles ─── */}
      <style>{`
        section, footer { width:100%; max-width:100vw; overflow-x:clip; }

        /* Reveal */
        .p-reveal { opacity:0; transform:translateY(22px); transition:opacity 0.75s ease, transform 0.75s ease; }
        .p-reveal.p-visible { opacity:1; transform:translateY(0); }

        /* Nav */
        .page-nav {
          position:fixed; top:0; left:0; width:100%; z-index:200;
          background:transparent;
          border-bottom:1px solid rgba(10,126,140,0.07);
          transition:backdrop-filter 0.3s ease;
        }
        .page-nav.scrolled { backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px); }

        /* Gradient pill button */
        @keyframes btnGradientFlow {
          0%   { background-position:0% 50%; }
          50%  { background-position:100% 50%; }
          100% { background-position:0% 50%; }
        }
        .btn-gradient-flow {
          background:linear-gradient(135deg,#0A7E8C 0%,#18a0b0 50%,#0A7E8C 100%);
          background-size:200% 100%;
          animation:btnGradientFlow 6s ease-in-out infinite;
        }

        /* Emotional rings */
        @keyframes orbit-cw  { to { transform:rotate( 360deg); } }
        @keyframes orbit-ccw { to { transform:rotate(-360deg); } }
        .ring-orbit-1 { animation:orbit-cw   50s linear infinite; }
        .ring-orbit-2 { animation:orbit-ccw  80s linear infinite; }
        .ring-orbit-3 { animation:orbit-cw  115s linear infinite; }

        /* Hero blob — CSS sets initial transform; JS updates it directly */
        #hero-blob {
          position:absolute; width:640px; height:640px;
          background:radial-gradient(circle,rgba(10,126,140,0.09) 0%,transparent 68%);
          border-radius:50%; top:50%; left:50%;
          transform:translate(-50%,-50%); pointer-events:none; will-change:transform;
        }
        /* Emotional section — JS updates opacity directly */
        #emotional-section { opacity:0; transition:opacity 0.15s linear; will-change:opacity; }

        /* Orbit stage */
        @property --gc-r { syntax:'<integer>'; inherits:false; initial-value:61;  }
        @property --gc-g { syntax:'<integer>'; inherits:false; initial-value:200; }
        @property --gc-b { syntax:'<integer>'; inherits:false; initial-value:168; }
        @keyframes orbit-spin-cw  { to { transform:rotate( 360deg); } }
        @keyframes orbit-spin-ccw { to { transform:rotate(-360deg); } }
        @keyframes orbit-glow-hue {
          0%,100% { --gc-r:61;  --gc-g:200; --gc-b:168; }
          33%     { --gc-r:159; --gc-g:161; --gc-b:81;  }
          66%     { --gc-r:223; --gc-g:120; --gc-b:48;  }
        }
        .orbit-stage { position:relative; width:320px; max-width:100%; aspect-ratio:1; overflow:hidden; contain:paint; margin:0 auto; }
        .orbit-rotator { position:absolute; inset:0; pointer-events:none; }
        .orbit-r1 { animation:orbit-spin-cw   80s linear infinite; }
        .orbit-r2 { animation:orbit-spin-ccw 110s linear infinite; }
        .orbit-r3 { animation:orbit-spin-cw  140s linear infinite; }
        .orbit-r1 .orbit-ai { animation:orbit-spin-ccw  80s linear infinite; }
        .orbit-r2 .orbit-ai { animation:orbit-spin-cw  110s linear infinite; }
        .orbit-r3 .orbit-ai { animation:orbit-spin-ccw 140s linear infinite; }

        /* How cards */
        .how-card { display:flex; align-items:stretch; opacity:0; transform:translateY(36px); transition:opacity 0.55s ease-in, transform 0.55s ease-in; }
        .how-card.how-visible { opacity:1; transform:translateY(0); }
        #how-card-2, #how-card-4 { transition-delay:0.13s; }

        /* App preview */
        .app-preview-card { background:#fff; border-radius:1.5rem; box-shadow:0 8px 40px rgba(10,126,140,0.16); overflow:hidden; width:100%; max-width:1080px; opacity:0; transform:translateY(32px); transition:opacity 0.6s ease-in, transform 0.6s ease-in; }
        .app-preview-card.how-visible { opacity:1; transform:translateY(0); }

        /* Card grid flipped (mockup left, text right) */
        .card-grid-flipped .col-text   { order:2; }
        .card-grid-flipped .col-mockup { order:1; }

        /* FAQ */
        .faq-body { overflow:hidden; max-height:0; transition:max-height 0.42s ease; }

        /* Mobile overlay + menu */
        .nav-overlay { position:fixed; inset:0; background:rgba(240,244,248,0.72); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); z-index:190; opacity:0; pointer-events:none; transition:opacity 0.35s ease; }
        .nav-overlay.open { opacity:1; pointer-events:auto; }
        .nav-mobile { position:fixed; inset:0; z-index:195; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; opacity:0; pointer-events:none; transition:opacity 0.35s ease, transform 0.35s ease; transform:translateY(12px); }
        .nav-mobile.open { opacity:1; pointer-events:auto; transform:translateY(0); }

        /* Hamburger */
        .nav-burger span { display:block; width:22px; height:2.5px; background:#1a2326; border-radius:2px; transition:transform 0.32s ease; transform-origin:center; }
        .nav-burger.open span:nth-child(1) { transform:translateY(3.75px) rotate(45deg); }
        .nav-burger.open span:nth-child(2) { transform:translateY(-3.75px) rotate(-45deg); }

        /* Cursor glow */
        #cursor-glow { position:fixed; width:600px; height:600px; border-radius:50%; pointer-events:none; transform:translate(-50%,-50%); background:radial-gradient(circle,rgba(10,126,140,0.10) 0%,rgba(46,205,167,0.05) 40%,transparent 70%); transition:opacity 0.4s ease; opacity:0; z-index:0; }

        /* ── Responsive ── */
        @media (max-width:768px) {
          .nav-links  { display:none !important; }
          .nav-burger { display:flex !important; }
          #emotional-rings, #hero-blob, #cta-ring { display:none !important; }
          #hero-section { min-height:50vh !important; }
          body*,body *::before,body *::after { max-width:100vw; }
          .nav-inner,.hero-copy,.emotional-content,.cta-content,.faq-wrap,.footer-row,.how-outer,.how-card,.hw-card-inner,.card-grid,.card-mockup,.card-text { min-width:0; }
          img,svg { max-width:100%; height:auto; }
          .orbit-stage { width:320px !important; max-width:none !important; flex-shrink:0; --orbit-scale:clamp(0.58,calc((100vw - 112px)/320px),0.78); transform:scale(var(--orbit-scale)); transform-origin:center center; margin:calc((1 - var(--orbit-scale))*-160px) auto; }
        }
        @media (max-width:680px) {
          .how-sticky { grid-template-columns:minmax(0,1fr) !important; }
          #how-card-1,#how-card-2,#how-card-3,#how-card-4 { grid-column:1/-1 !important; }
          #how-card-2,#how-card-4 { transition-delay:0s; }
          .hw-card-inner { padding:28px 20px !important; }
          .how-outer { padding-left:16px !important; padding-right:16px !important; }
        }
        @media (max-width:820px) {
          .card-grid { grid-template-columns:minmax(0,1fr) !important; gap:36px !important; }
          .card-grid-flipped .col-text, .card-grid-flipped .col-mockup { order:0 !important; }
        }
        @media (max-width:480px) { .btn-hero { padding:16px 36px !important; font-size:1rem !important; } }
      `}</style>

      {/* Cursor glow */}
      <div ref={glowRef} id="cursor-glow" />

      {/* ══ NAVBAR ══════════════════════════════════════════════════════════ */}
      <nav className={`page-nav${scrolled ? ' scrolled' : ''}`}>
        <div className="nav-inner" style={{ maxWidth:1200, margin:'0 auto', padding:'0 28px', height:70, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <Link href="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}>
            <Image src="/LOGO_CIRCL_1.svg" alt="Circl" width={38} height={38} />
            <span style={{ fontSize:'1.45rem', fontWeight:800, color:'#1a2326', letterSpacing:'-0.03em' }}>Circl</span>
          </Link>

          <div className="nav-links" style={{ display:'flex', alignItems:'center', gap:10 }}>
            <Link href="/login"
              style={{ background:'transparent', color:'#5a7478', border:'none', padding:'9px 16px', fontSize:'0.875rem', fontWeight:600, textDecoration:'none', transition:'color 0.2s ease' }}
              onMouseEnter={e => e.currentTarget.style.color='#1a2326'}
              onMouseLeave={e => e.currentTarget.style.color='#5a7478'}
            >Ingresar</Link>
            <Link href="/register"
              className="btn-gradient-flow"
              style={{ color:'#fff', borderRadius:9999, padding:'9px 24px', fontSize:'0.875rem', fontWeight:700, textDecoration:'none', display:'inline-block', transition:'transform 0.2s ease, filter 0.2s ease' }}
              onMouseEnter={e => { e.currentTarget.style.transform='scale(1.03)'; e.currentTarget.style.filter='brightness(1.07)' }}
              onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.filter='none' }}
            >Crear círculo</Link>
          </div>

          <button
            className={`nav-burger${menuOpen ? ' open' : ''}`}
            onClick={toggleMenu}
            aria-label="Menú"
            style={{ display:'none', flexDirection:'column', justifyContent:'center', gap:5, background:'none', border:'none', cursor:'pointer', padding:8, zIndex:210, position:'relative' }}
          >
            <span /><span />
          </button>
        </div>
      </nav>

      {/* Mobile overlay + menu */}
      <div className={`nav-overlay${menuOpen ? ' open' : ''}`} onClick={closeMenu} />
      <div className={`nav-mobile${menuOpen ? ' open' : ''}`}>
        <Link href="/login"
          style={{ fontSize:'1.5rem', fontWeight:800, letterSpacing:'-0.02em', textDecoration:'none', color:'#1a2326', transition:'color 0.2s' }}
          onClick={closeMenu}
          onMouseEnter={e => e.currentTarget.style.color='#0A7E8C'}
          onMouseLeave={e => e.currentTarget.style.color='#1a2326'}
        >Ingresar</Link>
        <Link href="/register"
          style={{ marginTop:8, background:'linear-gradient(135deg,#0A7E8C,#2ECDA7)', color:'white', borderRadius:9999, padding:'14px 40px', fontSize:'1.1rem', fontWeight:800, letterSpacing:'-0.02em', textDecoration:'none' }}
          onClick={closeMenu}
        >Crear círculo</Link>
      </div>


      {/* ══ HERO ════════════════════════════════════════════════════════════ */}
      <section id="hero-section" style={{ minHeight:'100vh', background:'transparent', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'110px 24px 80px', position:'relative', overflow:'hidden', textAlign:'center' }}>

        {/* Decorative rings (fixed, desktop only) */}
        <div id="emotional-rings" style={{ position:'fixed', opacity:0.8, top:'30%', left:0, width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none', zIndex:0 }}>
          {[{w:320,op:0.08},{w:580,op:0.08},{w:860,op:0.05}].map(({w,op},i) => (
            <div key={i} style={{ position:'absolute', borderRadius:'50%', border:`1.5px solid rgba(10,126,140,${op})`, width:w, height:w }} />
          ))}
          <div className="ring-orbit ring-orbit-1" style={{ position:'absolute', borderRadius:'50%', width:320, height:320 }}>
            <div style={{ position:'absolute', borderRadius:'50%', background:'#e9eae4', border:'1.5px solid rgba(10,126,140,0.08)', width:12, height:12, top:-6, left:'calc(50% - 6px)' }} />
          </div>
          <div className="ring-orbit ring-orbit-2" style={{ position:'absolute', borderRadius:'50%', width:580, height:580 }}>
            <div style={{ position:'absolute', borderRadius:'50%', background:'#e9eae4', border:'1.5px solid rgba(10,126,140,0.08)', width:22, height:22, top:-11, left:'calc(50% - 11px)' }} />
            <div style={{ position:'absolute', borderRadius:'50%', background:'#e9eae4', border:'1.5px solid rgba(10,126,140,0.08)', width:16, height:16, top:'calc(50% - 8px)', right:-8 }} />
          </div>
          <div className="ring-orbit ring-orbit-3" style={{ position:'absolute', borderRadius:'50%', width:860, height:860 }}>
            <div style={{ position:'absolute', borderRadius:'50%', background:'#e9eae4', border:'1.5px solid rgba(10,126,140,0.08)', width:28, height:28, top:-14, left:'calc(50% - 14px)' }} />
            <div style={{ position:'absolute', borderRadius:'50%', background:'#e9eae4', border:'1.5px solid rgba(10,126,140,0.08)', width:18, height:18, bottom:-9, left:'calc(50% - 9px)' }} />
          </div>
        </div>

        {/* Hero blob — initial transform set by CSS, updates via ref */}
        <div ref={heroBlobRef} id="hero-blob" />

        {/* Hero copy */}
        <div ref={heroRevealRef} className="hero-copy p-reveal" style={{ position:'relative', zIndex:2, maxWidth:780, width:'100%' }}>
          <h1 style={{ fontSize:'clamp(1.9rem, 8.5vw, 4.75rem)', fontWeight:800, lineHeight:1.08, letterSpacing:'-0.035em', color:'#1a2326', marginBottom:20, overflowWrap:'break-word', wordBreak:'break-word', hyphens:'auto' }}>
            Hay personas que quieren ayudarte.
          </h1>
          <p style={{ fontSize:'clamp(1rem, 2vw, 1.3rem)', color:'#5a7478', fontWeight:500, letterSpacing:'0.02em', marginBottom:44, overflowWrap:'break-word' }}>
            Circl las activa.
          </p>
          <Link href="/register"
            className="btn-hero"
            style={{ display:'inline-block', background:'#0A7E8C', color:'#fff', borderRadius:9999, padding:'20px 52px', fontSize:'1.1rem', fontWeight:700, boxShadow:'0 10px 36px rgba(10,126,140,0.28)', transition:'transform 0.2s ease, filter 0.2s ease', textDecoration:'none', marginBottom:64 }}
            onMouseEnter={e => { e.currentTarget.style.transform='scale(1.04)'; e.currentTarget.style.filter='brightness(1.1)' }}
            onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.filter='none' }}
          >Crear mi círculo</Link>
        </div>
      </section>


      {/* ══ APP PREVIEW ═════════════════════════════════════════════════════ */}
      <section style={{ padding:'0 24px 100px', display:'flex', justifyContent:'center' }}>
        <div ref={previewCardRef} className="app-preview-card">
          <img src="/app-screenshot.png" alt="Circl — vista de crisis" style={{ width:'100%', height:'auto', display:'block' }} />
        </div>
      </section>


      {/* ══ EMOTIONAL STATEMENT ═════════════════════════════════════════════ */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <section ref={emotionalRef as any} id="emotional-section" style={{ background:'transparent', padding:'130px 24px', position:'relative', overflow:'hidden' }}>
        <div className="emotional-content" style={{ position:'relative', zIndex:2, maxWidth:820, margin:'0 auto', textAlign:'center' }}>
          <h2 style={{ fontSize:'clamp(1.9rem, 8.5vw, 4.75rem)', fontWeight:800, lineHeight:1.08, letterSpacing:'-0.035em', color:'#1a2326', marginBottom:20, overflowWrap:'break-word', wordBreak:'break-word', hyphens:'auto' }}>
            No lo lleves en soledad
          </h2>
          <p style={{ fontSize:'clamp(1rem, 2vw, 1.3rem)', color:'#5a7478', fontWeight:500, letterSpacing:'0.02em' }}>Tu gente quiere estar.</p>
          <p style={{ fontSize:'clamp(1rem, 2vw, 1.3rem)', color:'#5a7478', fontWeight:500, letterSpacing:'0.02em' }}>Circl se encarga de decirles cómo y cuándo.</p>
        </div>
      </section>


      {/* ══ HOW IT WORKS ════════════════════════════════════════════════════ */}
      <section id="how-it-works" style={{ position:'relative' }}>
        <div className="how-outer" style={{ maxWidth:1280, margin:'0 auto', padding:'60px 24px 80px' }}>
          <div className="how-sticky" style={{ display:'grid', gridTemplateColumns:'repeat(20, minmax(0,1fr))', gridTemplateRows:'auto auto', gap:20, alignItems:'stretch', minWidth:0 }}>

            {/* Card 1 — 65% */}
            <div ref={howCard1Ref} className="how-card" id="how-card-1" style={{ gridColumn:'1 / 14' }}>
              <div className="hw-card-inner" style={{ background:'#fff', borderRadius:'1.5rem', boxShadow:'0 8px 40px rgba(10,126,140,0.16)', padding:'48px 40px', width:'100%', display:'flex', flexDirection:'column', justifyContent:'center' }}>
                <div className="card-grid" style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)', gap:60, alignItems:'center' }}>
                  <div className="card-text">
                    <h3 style={{ fontSize:'1.5rem', fontWeight:800, letterSpacing:'-0.02em', marginBottom:8, color:'#1A1A2E' }}>01. Armás tu círculo</h3>
                    <p style={{ fontSize:'0.875rem', lineHeight:1.6, color:'#5a7478' }}>Elegís quién es parte. Les asignás un rol.</p>
                  </div>
                  <div className="card-mockup"><OrbitStage /></div>
                </div>
              </div>
            </div>

            {/* Card 2 — 35% */}
            <div ref={howCard2Ref} className="how-card" id="how-card-2" style={{ gridColumn:'14 / 21' }}>
              <div className="hw-card-inner" style={{ background:'#fff', borderRadius:'1.5rem', boxShadow:'0 8px 40px rgba(10,126,140,0.16)', padding:'48px 40px', width:'100%', display:'flex', flexDirection:'column', justifyContent:'center' }}>
                <div className="card-grid" style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr)', gap:24, alignItems:'center' }}>
                  <div className="card-text">
                    <h3 style={{ fontSize:'1.5rem', fontWeight:800, letterSpacing:'-0.02em', marginBottom:8, color:'#1A1A2E' }}>02. El agente coordina</h3>
                    <p style={{ fontSize:'0.875rem', lineHeight:1.6, color:'#5a7478' }}>Sabe quién puede ayudar y cuándo activarlo.</p>
                  </div>
                  <div className="card-mockup"><ChatMockup /></div>
                </div>
              </div>
            </div>

            {/* Card 3 — 35% */}
            <div ref={howCard3Ref} className="how-card" id="how-card-3" style={{ gridColumn:'1 / 8' }}>
              <div className="hw-card-inner" style={{ background:'#fff', borderRadius:'1.5rem', boxShadow:'0 8px 40px rgba(10,126,140,0.16)', padding:'48px 40px', width:'100%', display:'flex', flexDirection:'column', justifyContent:'center' }}>
                <div className="card-grid" style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr)', gap:24, alignItems:'center' }}>
                  <div className="card-text">
                    <h3 style={{ fontSize:'1.5rem', fontWeight:800, letterSpacing:'-0.02em', marginBottom:8, color:'#1A1A2E' }}>03. Tu red responde</h3>
                    <p style={{ fontSize:'0.875rem', lineHeight:1.6, color:'#5a7478' }}>Desde WhatsApp, sin fricciones.</p>
                  </div>
                  <div className="card-mockup"><WhatsAppMockup /></div>
                </div>
              </div>
            </div>

            {/* Card 4 — 65% (flipped: mockup left, text right) */}
            <div ref={howCard4Ref} className="how-card" id="how-card-4" style={{ gridColumn:'8 / 21' }}>
              <div className="hw-card-inner" style={{ background:'#fff', borderRadius:'1.5rem', boxShadow:'0 8px 40px rgba(10,126,140,0.16)', padding:'48px 40px', width:'100%', display:'flex', flexDirection:'column', justifyContent:'center' }}>
                <div className="card-grid card-grid-flipped" style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)', gap:60, alignItems:'center' }}>
                  <div className="col-text card-text">
                    <h3 style={{ fontSize:'1.5rem', fontWeight:800, letterSpacing:'-0.02em', marginBottom:8, color:'#1A1A2E' }}>04. Todo en un solo lugar</h3>
                    <p style={{ fontSize:'0.875rem', lineHeight:1.6, color:'#5a7478' }}>Ves tu crisis, tu círculo y lo que viene.</p>
                  </div>
                  <div className="col-mockup card-mockup"><DashboardMockup /></div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>


      {/* ══ CTA FINAL ═══════════════════════════════════════════════════════ */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <section ref={ctaSectRef as any} id="cta-final" style={{ position:'relative', padding:'130px 24px 110px', background:'transparent', overflow:'hidden' }}>
        <div ref={ctaRingRef} id="cta-ring" style={{ position:'absolute', width:580, height:580, border:'2px solid rgba(255,255,255,0.1)', borderRadius:'50%', top:'50%', left:'50%', transform:'translate(-50%,-50%)', pointerEvents:'none' }} />
        <div className="cta-content" style={{ position:'relative', zIndex:2, maxWidth:680, margin:'0 auto', textAlign:'center' }}>
          <h2 style={{ fontSize:'clamp(1.9rem, 8.5vw, 4.8rem)', fontWeight:800, color:'#1a2326', letterSpacing:'-0.035em', marginBottom:52, overflowWrap:'break-word', wordBreak:'break-word', hyphens:'auto' }}>
            Tu círculo te espera.
          </h2>
          <Link href="/register"
            className="btn-hero"
            style={{ display:'inline-block', background:'#0A7E8C', color:'#fff', borderRadius:9999, padding:'20px 52px', fontSize:'1.1rem', fontWeight:700, boxShadow:'0 10px 36px rgba(10,126,140,0.28)', transition:'transform 0.2s ease, filter 0.2s ease', textDecoration:'none' }}
            onMouseEnter={e => { e.currentTarget.style.transform='scale(1.04)'; e.currentTarget.style.filter='brightness(1.1)' }}
            onMouseLeave={e => { e.currentTarget.style.transform='scale(1)'; e.currentTarget.style.filter='none' }}
          >Crear mi círculo</Link>
        </div>
      </section>


      {/* ══ FAQ ═════════════════════════════════════════════════════════════ */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <section ref={faqRevealRef as any} id="faq" className="p-reveal" style={{ background:'#FAF8F5', padding:'110px 24px' }}>
        <div className="faq-wrap" style={{ maxWidth:720, margin:'0 auto' }}>
          <h2 style={{ fontSize:'clamp(1.9rem, 4vw, 2.9rem)', fontWeight:800, color:'#0A7E8C', textAlign:'center', letterSpacing:'-0.03em', marginBottom:60 }}>
            Preguntas frecuentes
          </h2>
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} style={{ borderBottom:'1px solid rgba(10,126,140,0.12)', ...(i===0 ? { borderTop:'1px solid rgba(10,126,140,0.12)' } : {}) }}>
              <button
                onClick={() => toggleFaq(i)}
                style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'26px 0', cursor:'pointer', fontWeight:700, fontSize:'1rem', color:'#1a2326', background:'none', border:'none', fontFamily:'inherit', textAlign:'left', gap:16 }}
              >
                <span>{item.q}</span>
                <span style={{
                  width:26, height:26, borderRadius:'50%', border:'1.5px solid #0A7E8C',
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                  fontSize:'1.1rem', fontWeight:300, lineHeight:1,
                  color: openFaq===i ? 'white' : '#0A7E8C',
                  background: openFaq===i ? '#0A7E8C' : 'transparent',
                  transform: openFaq===i ? 'rotate(45deg)' : 'none',
                  transition:'transform 0.3s ease, background 0.3s ease, color 0.3s ease',
                }}>+</span>
              </button>
              <div ref={el => { faqBodyRefs.current[i] = el }} className="faq-body">
                <p style={{ paddingBottom:26, color:'#5a7478', lineHeight:1.78, fontSize:'0.97rem' }}>{item.a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>


      {/* ══ FOOTER ══════════════════════════════════════════════════════════ */}
      <footer style={{ background:'#FAF8F5', borderTop:'1px solid rgba(10,126,140,0.08)', padding:'32px 28px' }}>
        <div className="footer-row" style={{ maxWidth:1200, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
          <Link href="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}>
            <Image src="/LOGO_CIRCL_2.svg" alt="Circl" width={30} height={30} />
            <span style={{ fontSize:'1.2rem', fontWeight:800, color:'#0A7E8C', letterSpacing:'-0.03em' }}>Circl.</span>
          </Link>
          <div style={{ display:'flex', gap:28 }}>
            {['Privacidad', 'Contacto'].map(label => (
              <Link key={label} href="#"
                style={{ textDecoration:'none', fontSize:'0.875rem', fontWeight:500, color:'#5a7478', transition:'color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.color='#0A7E8C'}
                onMouseLeave={e => e.currentTarget.style.color='#5a7478'}
              >{label}</Link>
            ))}
          </div>
        </div>
      </footer>

    </div>
  )
}

// ── Mockup sub-components ──────────────────────────────────────────────────────

/** Orbit-stage illustration (card 1) */
function OrbitStage() {
  return (
    <div className="orbit-stage">
      {/* Conic glow — hue animated via @property */}
      <div style={{
        position:'absolute', top:'50%', left:'50%',
        width:388, height:388, margin:'-194px 0 0 -194px', borderRadius:'50%',
        background:'conic-gradient(from 0deg,rgba(var(--gc-r),var(--gc-g),var(--gc-b),0.00) 0deg,rgba(var(--gc-r),var(--gc-g),var(--gc-b),0.45) 80deg,rgba(var(--gc-r),var(--gc-g),var(--gc-b),0.55) 160deg,rgba(var(--gc-r),var(--gc-g),var(--gc-b),0.30) 240deg,rgba(var(--gc-r),var(--gc-g),var(--gc-b),0.05) 320deg,rgba(var(--gc-r),var(--gc-g),var(--gc-b),0.00) 360deg)',
        WebkitMaskImage:'radial-gradient(circle,transparent 139px,#000 139px,#000 150px,transparent 150px)',
        maskImage:'radial-gradient(circle,transparent 139px,#000 139px,#000 150px,transparent 150px)',
        filter:'blur(6px)',
        animation:'orbit-spin-cw 90s linear infinite,orbit-glow-hue 24s ease-in-out infinite',
        pointerEvents:'none',
      }} />

      {/* Orbit rings */}
      {[{w:124,m:62},{w:200,m:100},{w:278,m:139}].map(({w,m},i) => (
        <div key={i} style={{ position:'absolute', top:'50%', left:'50%', borderRadius:'50%', border:'1px solid rgba(0,0,0,0.08)', pointerEvents:'none', width:w, height:w, margin:`-${m}px 0 0 -${m}px` }} />
      ))}

      {/* Ring 1: Sofi + Carolina */}
      <div className="orbit-rotator orbit-r1">
        <OrbitActor angle="-25deg" r={62}><img src="/sofia.png"    alt="Sofi"     style={{width:'100%',height:'100%',objectFit:'cover'}} /></OrbitActor>
        <OrbitActor angle="165deg" r={62}><img src="/carolina.png" alt="Carolina" style={{width:'100%',height:'100%',objectFit:'cover'}} /></OrbitActor>
      </div>

      {/* Ring 2: Diego */}
      <div className="orbit-rotator orbit-r2">
        <OrbitActor angle="60deg" r={100}><img src="/diego.png" alt="Diego" style={{width:'100%',height:'100%',objectFit:'cover'}} /></OrbitActor>
      </div>

      {/* Ring 3: OSDE + Laura */}
      <div className="orbit-rotator orbit-r3">
        <OrbitActor angle="-45deg" r={139} bg="#1226aa">
          <img src="/osde.png" alt="OSDE" style={{width:'76%',height:'76%',objectFit:'contain'}} />
        </OrbitActor>
        <OrbitActor angle="135deg" r={139}>
          <img src="/laura.png" alt="Laura" style={{width:'100%',height:'100%',objectFit:'cover'}} />
        </OrbitActor>
      </div>

      {/* Center: Valeria */}
      <div style={{ position:'absolute', top:'50%', left:'50%', width:60, height:60, margin:'-30px 0 0 -30px', borderRadius:'50%', overflow:'hidden', border:'2px solid rgba(0,0,0,0.08)', boxShadow:'0 6px 18px rgba(0,0,0,0.18)', zIndex:5 }}>
        <img src="/valeria.png" alt="Valeria" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} />
      </div>
    </div>
  )
}

function OrbitActor({ angle, r, bg = 'white', children }: { angle:string; r:number; bg?:string; children:React.ReactNode }) {
  return (
    <div style={{
      position:'absolute', top:'50%', left:'50%',
      width:38, height:38, margin:'-19px 0 0 -19px', pointerEvents:'auto',
      transform:`translate(calc(${r}px * sin(${angle})),calc(-${r}px * cos(${angle})))`,
    } as React.CSSProperties}>
      <div className="orbit-ai" style={{ width:'100%', height:'100%', borderRadius:'50%', background:bg, border:'2px solid rgba(0,0,0,0.08)', boxShadow:'0 4px 10px rgba(0,0,0,0.10)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', fontWeight:700, fontSize:'0.65rem', color:'white' }}>
        {children}
      </div>
    </div>
  )
}

/** Chat UI mockup (card 2) */
function ChatMockup() {
  const msgs = [
    { user:true,  text:'Necesito que alguien lleve a mamá al médico el jueves.' },
    { user:false, text:'Carlos está disponible el jueves y tiene auto. ¿Lo activo?' },
    { user:true,  text:'Sí, perfecto. Gracias.' },
  ]
  return (
    <div style={{ maxWidth:340, margin:'0 auto', background:'#0A7E8C', borderRadius:22, padding:20, display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ fontSize:'0.62rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'rgba(255,255,255,0.5)', marginBottom:2 }}>Agente Circl</div>
      {msgs.map((m,i) => (
        <div key={i} style={{ alignSelf:m.user?'flex-end':'flex-start', background:m.user?'rgba(255,255,255,0.14)':'white', color:m.user?'white':'#0A7E8C', fontWeight:m.user?400:500, padding:'12px 16px', borderRadius:18, borderBottomRightRadius:m.user?4:18, borderBottomLeftRadius:m.user?18:4, maxWidth:'82%', fontSize:'0.875rem', lineHeight:1.5 }}>
          {m.text}
        </div>
      ))}
    </div>
  )
}

/** WhatsApp-style mockup (card 3) */
function WhatsAppMockup() {
  return (
    <div style={{ maxWidth:340, margin:'0 auto', borderRadius:20, overflow:'hidden', background:'#ece5dd' }}>
      <div style={{ background:'#0A7E8C', padding:'12px 18px', display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:38, height:38, borderRadius:'50%', background:'linear-gradient(135deg,#2ECDA7,#0A7E8C)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:700, fontSize:'0.85rem', flexShrink:0 }}>C</div>
        <div>
          <div style={{ color:'white', fontWeight:600, fontSize:'0.9rem' }}>Carlos</div>
          <div style={{ color:'rgba(255,255,255,0.65)', fontSize:'0.72rem' }}>en línea</div>
        </div>
      </div>
      <div style={{ padding:'16px 14px', display:'flex', flexDirection:'column', gap:8 }}>
        {[
          { out:false, text:'Me llegó el mensaje de Circl. ¿El jueves a las 14h está bien?', ts:'10:32' },
          { out:true,  text:'Sí, perfecto. ¡Gracias Carlos! ❤️',                              ts:'10:33' },
          { out:false, text:'Confirmo. Paso por ella.',                                       ts:'10:34' },
        ].map((m,i) => (
          <div key={i} style={{ background:m.out?'#d9f7be':'white', alignSelf:m.out?'flex-end':'flex-start', borderRadius:12, borderTopLeftRadius:m.out?12:2, borderTopRightRadius:m.out?2:12, padding:'10px 14px', fontSize:'0.85rem', lineHeight:1.5, maxWidth:'82%' }}>
            {m.text}
            <div style={{ fontSize:'0.63rem', color:'#999', textAlign:'right', marginTop:3 }}>{m.ts}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Dashboard mockup (card 4) */
function DashboardMockup() {
  return (
    <div style={{ maxWidth:340, margin:'0 auto', background:'#0A7E8C', borderRadius:22, padding:24 }}>
      <div style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:'rgba(255,255,255,0.45)', marginBottom:6 }}>Tu situación</div>
      <div style={{ fontSize:'1.1rem', fontWeight:700, color:'white', marginBottom:22 }}>Recuperación de mamá</div>
      <div style={{ fontSize:'0.68rem', fontWeight:600, color:'rgba(255,255,255,0.45)', marginBottom:7 }}>Círculo activo · 6 personas</div>
      <div style={{ height:7, background:'rgba(255,255,255,0.12)', borderRadius:9999, overflow:'hidden', marginBottom:26 }}>
        <div style={{ height:'100%', width:'62%', background:'linear-gradient(90deg,#2ECDA7,#0A7E8C)', borderRadius:9999 }} />
      </div>
      <div style={{ fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:'rgba(255,255,255,0.4)', marginBottom:10 }}>Próximos</div>
      {[
        { dot:'#2ECDA7', text:'Turno médico',     time:'Jue 14:00' },
        { dot:'#E8913A', text:'Medicación',        time:'Vie 08:00' },
        { dot:'#2ECDA7', text:'Compras semanales', time:'Sáb 10:00' },
      ].map((row,i,arr) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 0', borderBottom:i<arr.length-1?'1px solid rgba(255,255,255,0.07)':'none' }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:row.dot, flexShrink:0 }} />
          <span style={{ color:'rgba(255,255,255,0.85)', fontSize:'0.875rem', flex:1 }}>{row.text}</span>
          <span style={{ color:'rgba(255,255,255,0.38)', fontSize:'0.75rem', whiteSpace:'nowrap' }}>{row.time}</span>
        </div>
      ))}
    </div>
  )
}
