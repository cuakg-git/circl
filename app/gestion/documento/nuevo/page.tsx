'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'

const DOC_TYPE_LABELS: Record<string, string> = {
  estudio_medico: 'Estudio médico',
  receta:         'Receta',
  informe:        'Informe',
  otros:          'Otros',
}

export default function NuevoDocumentoPage() {
  const router       = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

  const [crisisId,    setCrisisId]    = useState<string | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [isDragging,  setIsDragging]  = useState(false)

  // Form fields
  const [name,     setName]     = useState('')
  const [docType,  setDocType]  = useState('estudio_medico')
  const [file,     setFile]     = useState<File | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) { router.replace('/login'); return }

      const { data: crisis } = await supabase
        .from('crises')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'activa')
        .maybeSingle()

      if (!crisis) { router.replace('/gestion'); return }
      setCrisisId(crisis.id)
      setLoading(false)
    }
    load()
  }, [router])

  function handleFileSelect(f: File) {
    if (f.size > 10 * 1024 * 1024) {
      setError('El archivo supera el límite de 10 MB')
      return
    }
    setError(null)
    setFile(f)
    if (!name.trim()) {
      setName(f.name.replace(/\.[^/.]+$/, ''))
    }
  }

  async function handleSubmit() {
    if (!file || !name.trim() || !crisisId || submitting) return
    setSubmitting(true)
    setError(null)

    // 1. Subir archivo a storage
    const timestamp = Date.now()
    const safeName  = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path      = `${crisisId}/${timestamp}_${safeName}`

    const { error: uploadErr } = await supabase.storage
      .from('docs')
      .upload(path, file)

    if (uploadErr) {
      setSubmitting(false)
      setError(`Error al subir el archivo: ${uploadErr.message}`)
      return
    }

    // 2. Crear registro en documents
    const { data: newDoc, error: dbErr } = await supabase
      .from('documents')
      .insert({
        crisis_id:              crisisId,
        name:                   name.trim(),
        type:                   docType,
        storage_path:           path,
        original_filename:      file.name,
        file_size_bytes:        file.size,
        file_mime_type:         file.type,
        uploaded_by_user:       true,
        uploaded_by_contact_id: null,
      })
      .select('id')
      .single()

    if (dbErr) {
      await supabase.storage.from('docs').remove([path])
      setSubmitting(false)
      setError(dbErr.message)
      return
    }

    router.replace(`/gestion/documento/${newDoc.id}`)
  }

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
          50% {
            background:
              radial-gradient(ellipse at 10% 22%, rgba(61,199,166,0.03) 0%, transparent 55%),
              radial-gradient(ellipse at 78%  8%, rgba(80,220,175,0.07) 0%, transparent 50%),
              radial-gradient(ellipse at 92% 75%, rgba(224,121,49,0.08) 0%, transparent 52%),
              radial-gradient(ellipse at 18% 92%, rgba(158,160,81,0.08) 0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 65%),
              #f0f4f8;
          }
        }
        .nuevo-doc-bg { animation: heroBgDrift 30s ease-in-out infinite; }
      `}</style>

      <div className="nuevo-doc-bg flex min-h-screen">
        <Sidebar />

        <main className="flex-1 ml-0 md:ml-[240px] min-h-screen px-5 py-8 pb-28 md:px-10 md:py-10 md:pb-10">

          {/* Breadcrumb */}
          <nav style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Link href="/gestion" style={{
              fontSize: '0.8125rem', color: '#0A7E8C', fontWeight: 600,
              textDecoration: 'none',
            }}>
              Gestión
            </Link>
            <span style={{ color: '#5a7478', fontSize: '0.8125rem' }}>→</span>
            <span style={{ fontSize: '0.8125rem', color: '#5a7478', fontWeight: 500 }}>
              Nuevo documento
            </span>
          </nav>

          {loading ? (
            <div style={{ maxWidth: 480, margin: '0 auto' }}>
              <div style={{
                background: '#FFFFFF', borderRadius: '1.5rem',
                boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                padding: 32, textAlign: 'center',
              }}>
                <p style={{ color: '#5a7478', fontSize: '0.875rem' }}>Cargando…</p>
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: 480, margin: '0 auto' }}>

              {/* Hero */}
              <div style={{ textAlign: 'center', padding: '16px 0 28px' }}>
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 14px',
                  boxShadow: '0 8px 40px rgba(10,126,140,0.16)',
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                    stroke="white" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </div>
                <h1 style={{
                  fontSize: '1.5rem', fontWeight: 800,
                  letterSpacing: '-0.02em', color: '#1A1A2E',
                  marginBottom: 4,
                }}>
                  Nuevo documento
                </h1>
                <p style={{ fontSize: '0.875rem', color: '#5a7478', margin: 0 }}>
                  Subí un archivo para guardarlo en tu crisis
                </p>
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  marginBottom: 16, padding: '10px 16px',
                  borderRadius: '0.75rem',
                  background: 'rgba(186,26,26,0.07)',
                  border: '1px solid rgba(186,26,26,0.18)',
                  fontSize: '0.8125rem', color: '#ba1a1a', fontWeight: 600,
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 8,
                }}>
                  <span>{error}</span>
                  <button onClick={() => setError(null)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#ba1a1a', fontSize: '1rem', lineHeight: 1,
                  }}>✕</button>
                </div>
              )}

              {/* Drop zone */}
              <div
                onDragEnter={(e) => { e.preventDefault(); dragCounterRef.current++; setIsDragging(true) }}
                onDragLeave={() => { dragCounterRef.current--; if (dragCounterRef.current === 0) setIsDragging(false) }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  dragCounterRef.current = 0
                  setIsDragging(false)
                  const f = e.dataTransfer.files[0]
                  if (f) handleFileSelect(f)
                }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragging ? 'rgba(61,199,166,0.75)' : 'rgba(61,199,166,0.40)'}`,
                  borderRadius: '1.25rem', padding: '36px 20px',
                  textAlign: 'center', cursor: 'pointer',
                  background: isDragging ? 'rgba(61,199,166,0.07)' : '#FFFFFF',
                  transform: isDragging ? 'scale(1.02)' : 'scale(1)',
                  transition: 'all 0.2s',
                  marginBottom: 16,
                  boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  accept=".pdf,image/*,.doc,.docx"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) handleFileSelect(f)
                  }}
                />
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: 'rgba(10,126,140,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 12px',
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                    stroke="#0A7E8C" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                {file ? (
                  <>
                    <p style={{
                      fontSize: '0.875rem', fontWeight: 700,
                      color: '#0A7E8C', margin: '0 0 4px',
                    }}>
                      {file.name}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: '#5a7478', margin: 0 }}>
                      {(file.size / 1024 / 1024).toFixed(1)} MB · Hacé clic para cambiar
                    </p>
                  </>
                ) : (
                  <>
                    <p style={{
                      fontSize: '0.875rem', fontWeight: 600,
                      color: '#1A1A2E', margin: '0 0 4px',
                    }}>
                      Hacé clic o arrastrá el archivo aquí
                    </p>
                    <p style={{ fontSize: '0.75rem', color: '#5a7478', margin: 0 }}>
                      PDF, imagen, Word · Máx. 10 MB
                    </p>
                  </>
                )}
              </div>

              {/* Datos del documento */}
              <div style={{
                background: '#FFFFFF', borderRadius: '1.5rem',
                boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                marginBottom: 24, overflow: 'hidden',
              }}>
                {/* Nombre */}
                <div style={{
                  display: 'flex', alignItems: 'center',
                  padding: '16px 20px',
                  borderBottom: '1px solid rgba(10,126,140,0.08)', gap: 12,
                }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                    textTransform: 'uppercase', color: '#5a7478',
                    minWidth: 72, flexShrink: 0,
                  }}>Nombre</span>
                  <input
                    type="text"
                    placeholder="Nombre del documento…"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
                    style={{
                      flex: 1, border: 'none', background: 'none',
                      fontSize: '0.875rem', fontWeight: 600,
                      outline: 'none', color: '#1A1A2E',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>

                {/* Tipo */}
                <div style={{
                  display: 'flex', alignItems: 'center',
                  padding: '16px 20px', gap: 12,
                }}>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                    textTransform: 'uppercase', color: '#5a7478',
                    minWidth: 72, flexShrink: 0,
                  }}>Tipo</span>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    style={{
                      flex: 1, border: 'none', background: 'none',
                      fontSize: '0.875rem', fontWeight: 600,
                      outline: 'none', color: '#1A1A2E',
                      fontFamily: 'inherit', cursor: 'pointer',
                      appearance: 'none',
                    }}
                  >
                    {Object.entries(DOC_TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Botón subir */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !file || !name.trim()}
                style={{
                  width: '100%', padding: '14px', borderRadius: 9999,
                  border: 'none',
                  cursor: (submitting || !file || !name.trim()) ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: '0.875rem',
                  background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                  color: 'white',
                  opacity: (submitting || !file || !name.trim()) ? 0.6 : 1,
                  transition: 'filter 0.15s', fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => {
                  if (!submitting && file && name.trim())
                    e.currentTarget.style.filter = 'brightness(1.06)'
                }}
                onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)' }}
              >
                {submitting ? 'Subiendo…' : 'Subir documento'}
              </button>

            </div>
          )}
        </main>
      </div>
    </>
  )
}
