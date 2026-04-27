'use client'

import Link from 'next/link'
import Image from 'next/image'
import Sidebar from '@/components/Sidebar'

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconCheck() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#0A7E8C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path className="check-path" d="M5 12l5 5L20 7" />
    </svg>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Logo() {
  return (
    <div className="flex items-center justify-center gap-[10px] mb-9">
      <Image
        src="/LOGO_CIRCL_1.svg"
        alt="Circl"
        width={38}
        height={38}
        style={{ width: 'auto', height: 38 }}
      />
      <span className="text-[1.6rem] font-extrabold text-[#1A1A2E] tracking-[-0.03em]">
        Circl
      </span>
    </div>
  )
}

function Backdrop() {
  return (
    <>
      <style>{`
        @keyframes heroBgDrift {
          0%, 100% {
            background:
              radial-gradient(ellipse at 15% 15%, rgba(61,199,166,0.03) 0%, transparent 55%),
              radial-gradient(ellipse at 85% 10%, rgba(80,220,175,0.07) 0%, transparent 50%),
              radial-gradient(ellipse at 88% 82%, rgba(224,121,49,0.08) 0%, transparent 52%),
              radial-gradient(ellipse at 12% 88%, rgba(158,160,81,0.08) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 65%),
              #f0f4f8;
          }
          25% {
            background:
              radial-gradient(ellipse at 22% 10%, rgba(61,199,166,0.03) 0%, transparent 55%),
              radial-gradient(ellipse at 90% 20%, rgba(80,220,175,0.07) 0%, transparent 50%),
              radial-gradient(ellipse at 80% 88%, rgba(224,121,49,0.08) 0%, transparent 52%),
              radial-gradient(ellipse at 6% 78%, rgba(158,160,81,0.08) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 65%),
              #f0f4f8;
          }
          50% {
            background:
              radial-gradient(ellipse at 10% 22%, rgba(61,199,166,0.03) 0%, transparent 55%),
              radial-gradient(ellipse at 78% 8%, rgba(80,220,175,0.07) 0%, transparent 50%),
              radial-gradient(ellipse at 92% 75%, rgba(224,121,49,0.08) 0%, transparent 52%),
              radial-gradient(ellipse at 18% 92%, rgba(158,160,81,0.08) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 65%),
              #f0f4f8;
          }
          75% {
            background:
              radial-gradient(ellipse at 20% 22%, rgba(61,199,166,0.03) 0%, transparent 55%),
              radial-gradient(ellipse at 82% 18%, rgba(80,220,175,0.07) 0%, transparent 50%),
              radial-gradient(ellipse at 85% 90%, rgba(224,121,49,0.08) 0%, transparent 52%),
              radial-gradient(ellipse at 14% 82%, rgba(158,160,81,0.08) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 65%),
              #f0f4f8;
          }
        }
        .auth-bg { animation: heroBgDrift 30s ease-in-out infinite; }

        /* Success icon animations */
        .success-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid rgba(46,205,167,0.30);
          animation: ringPulse 2.4s ease-in-out infinite;
        }
        @keyframes ringPulse {
          0%, 100% { transform: scale(1);    opacity: 1; }
          50%       { transform: scale(1.12); opacity: 0.45; }
        }
        .success-icon {
          position: absolute;
          inset: 8px;
          border-radius: 50%;
          background: rgba(46,205,167,0.12);
          border: 2px solid rgba(46,205,167,0.30);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #0A7E8C;
        }

        /* Checkmark draw animation */
        .check-path {
          stroke-dasharray: 40;
          stroke-dashoffset: 40;
          animation: drawCheck 0.55s ease-out 0.2s forwards;
        }
        @keyframes drawCheck {
          to { stroke-dashoffset: 0; }
        }

        /* Card fade-in */
        .auth-card {
          animation: cardIn 0.45s ease-out both;
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChangePasswordSuccessPage() {
  return (
    <>
      <Backdrop />
      <div className="auth-bg min-h-screen flex items-center justify-center px-4 py-8">
        <div
          className="bg-white rounded-2xl shadow-2xl p-12 w-full max-w-[440px] text-center auth-card"
          style={{ boxShadow: '0 8px 40px rgba(10,126,140,0.16)' }}
        >
          {/* Logo */}
          <Logo />

          {/* Success icon */}
          <div className="w-22 h-22 mx-auto mb-6" style={{ width: '88px', height: '88px', position: 'relative' }}>
            <div className="success-ring"></div>
            <div className="success-icon">
              <IconCheck />
            </div>
          </div>

          {/* Heading */}
          <h1 className="text-xl font-extrabold text-[#1A1A2E] mb-2">
            ¡Contraseña actualizada!
          </h1>

          {/* Subtitle */}
          <p className="text-sm text-[#5a7478] mb-6">
            Tu contraseña ha sido actualizada correctamente.<br />
            Ya podés usar tus nuevas credenciales.
          </p>

          {/* CTA button */}
          <Link
            href="/profile"
            className="block bg-[#0A7E8C] text-white text-md font-bold rounded-3xl px-7 py-3 transition-all hover:brightness-110 cursor-pointer w-full text-center mb-3"
          >
            Volver a mi perfil
          </Link>

          {/* Support link */}
          <p className="text-center text-[0.75rem] text-[#5a7478]">
            ¿Necesitás ayuda? Escribinos a{' '}
            <a href="mailto:soporte@circl.app" className="text-[#0A7E8C] font-semibold underline">
              soporte@circl.app
            </a>
          </p>
        </div>
      </div>
    </>
  )
}
