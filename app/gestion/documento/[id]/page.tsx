'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────────

type Doc = {
  id:                     string
  name:                   string
  type:                   string | null
  created_at:             string
  storage_path:           string
  original_filename:      string | null
  file_size_bytes:        number | null
  file_mime_type:         string | null
  uploaded_by_user:       boolean | null
  uploaded_by_contact_id: string | null
  description:            string | null
  crisis_id:              string
}

type TaskSummary = {
  id:    string
  title: string
}

type Contact = {
  id:   string
  name: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  estudio_medico: 'Estudio médico',
  receta:         'Receta',
  informe:        'Informe',
  otros:          'Otros',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtLongDate(iso: string | null) {
  if (!iso) return '—'
  const s = new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DocumentoDetailPage() {
  const router  = useRouter()
  const params  = useParams()
  const docId   = params.id as string

  const [loading,       setLoading]       = useState(true)
  const [doc,           setDoc]           = useState<Doc | null>(null)
  const [contacts,      setContacts]      = useState<Contact[]>([])
  const [linkedTasks,   setLinkedTasks]   = useState<TaskSummary[]>([])
  const [availTasks,    setAvailTasks]    = useState<TaskSummary[]>([])
  const [thumbUrl,      setThumbUrl]      = useState<string | null>(null)
  const [previewOpen,   setPreviewOpen]   = useState(false)
  const [previewUrl,    setPreviewUrl]    = useState<string | null>(null)
  const [previewLoading,setPreviewLoading]= useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [taskPickerOpen,setTaskPickerOpen]= useState(false)
  const [linkLoading,   setLinkLoading]   = useState(false)
  const [linkedTaskIds, setLinkedTaskIds] = useState<string[]>([])

  // ── Load ──────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const { data: { user }, error: userErr } = await supabase.auth.getUser()
      if (userErr || !user) { router.replace('/login'); return }

      const { data: crisis } = await supabase
        .from('crises')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'activa')
        .maybeSingle()

      if (!crisis) { router.replace('/gestion'); return }

      const [docRes, contactsRes, taskDocsRes, allTasksRes] = await Promise.all([
        supabase
          .from('documents')
          .select('id, name, type, created_at, storage_path, original_filename, file_size_bytes, file_mime_type, uploaded_by_user, uploaded_by_contact_id, description, crisis_id')
          .eq('id', docId)
          .eq('crisis_id', crisis.id)
          .maybeSingle(),
        supabase
          .from('crisis_contacts')
          .select('contact:contacts(id, name)')
          .eq('crisis_id', crisis.id),
        supabase
          .from('task_documents')
          .select('task_id')
          .eq('document_id', docId),
        supabase
          .from('tasks')
          .select('id, title')
          .eq('crisis_id', crisis.id)
          .eq('status', 'pendiente')
          .order('due_date', { ascending: true, nullsFirst: false }),
      ])

      if (!docRes.data) { router.replace('/gestion'); return }

      const d = docRes.data as Doc
      setDoc(d)

      // Contactos
      const ccRows = (contactsRes.data ?? []) as { contact: Contact | Contact[] | null }[]
      const dedup  = new Map<string, Contact>()
      for (const r of ccRows) {
        const c = Array.isArray(r.contact) ? r.contact[0] : r.contact
        if (c && !dedup.has(c.id)) dedup.set(c.id, c)
      }
      setContacts(Array.from(dedup.values()))

      // Tareas vinculadas
      const linkedIds = (taskDocsRes.data ?? []).map(r => r.task_id)
      setLinkedTaskIds(linkedIds)

      const allTasks = (allTasksRes.data ?? []) as TaskSummary[]
      setLinkedTasks(allTasks.filter(t => linkedIds.includes(t.id)))
      setAvailTasks(allTasks)

      // Thumbnail para imágenes y PDFs
      const mime = d.file_mime_type ?? ''
      if (mime.startsWith('image/') || mime === 'application/pdf') {
        const { data: signedData } = await supabase.storage
          .from('docs')
          .createSignedUrl(d.storage_path, 3600)
        if (signedData?.signedUrl) setThumbUrl(signedData.signedUrl)
      }

      setLoading(false)
    }
    load()
  }, [router, docId])

  // ── Handlers ──────────────────────────────────────────────────────────────────

  async function handleDownload() {
    if (!doc) return
    setError(null)
    const { data, error } = await supabase.storage
      .from('docs')
      .createSignedUrl(doc.storage_path, 3600, {
        download: doc.original_filename ?? doc.name,
      })
    if (error || !data?.signedUrl) {
      setError('No se pudo generar el link de descarga')
      return
    }
    const a = document.createElement('a')
    a.href = data.signedUrl
    a.download = doc.original_filename ?? doc.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  async function handleOpenPreview() {
    if (!doc) return
    if (thumbUrl) {
      setPreviewUrl(thumbUrl)
      setPreviewOpen(true)
      return
    }
    setPreviewLoading(true)
    const { data, error } = await supabase.storage
      .from('docs')
      .createSignedUrl(doc.storage_path, 3600)
    setPreviewLoading(false)
    if (error || !data?.signedUrl) {
      setError('No se pudo generar la vista previa')
      return
    }
    setPreviewUrl(data.signedUrl)
    setPreviewOpen(true)
  }

  async function handleDelete() {
    if (!doc) return
    setDeleteLoading(true)
    const { error: storageErr } = await supabase.storage
      .from('docs')
      .remove([doc.storage_path])
    if (storageErr) { setDeleteLoading(false); setError(storageErr.message); return }
    const { error: dbErr } = await supabase
      .from('documents')
      .delete()
      .eq('id', docId)
    setDeleteLoading(false)
    if (dbErr) { setError(dbErr.message); return }
    router.replace('/gestion')
  }

  async function handleLinkTask(taskId: string) {
    setLinkLoading(true)
    const { error } = await supabase
      .from('task_documents')
      .insert({ task_id: taskId, document_id: docId })
    setLinkLoading(false)
    if (error) { setError(error.message); return }
    setLinkedTaskIds(prev => [...prev, taskId])
    const task = availTasks.find(t => t.id === taskId)
    if (task) setLinkedTasks(prev => [...prev, task])
    setTaskPickerOpen(false)
  }

  async function handleUnlinkTask(taskId: string) {
    const { error } = await supabase
      .from('task_documents')
      .delete()
      .eq('task_id', taskId)
      .eq('document_id', docId)
    if (error) { setError(error.message); return }
    setLinkedTaskIds(prev => prev.filter(id => id !== taskId))
    setLinkedTasks(prev => prev.filter(t => t.id !== taskId))
  }

  // ── Computed ──────────────────────────────────────────────────────────────────

  const uploaderName = doc?.uploaded_by_user
    ? 'Vos'
    : doc?.uploaded_by_contact_id
      ? contacts.find(c => c.id === doc.uploaded_by_contact_id)?.name ?? '—'
      : '—'

  const mime = doc?.file_mime_type ?? ''
  const isPreviewable = mime.startsWith('image/') || mime === 'application/pdf'

  const unlinkedTasks = availTasks.filter(t => !linkedTaskIds.includes(t.id))

  // ── Render ────────────────────────────────────────────────────────────────────

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
        .doc-detail-bg { animation: heroBgDrift 30s ease-in-out infinite; }
      `}</style>

      {/* Preview modal */}
      {previewOpen && doc && (
        <>
          <div
            onClick={() => { setPreviewOpen(false); setPreviewUrl(null) }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 300 }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 301, width: 'min(92vw, 860px)', maxHeight: '90vh',
            background: '#fff', borderRadius: '1.25rem',
            boxShadow: '0 24px 80px rgba(0,0,0,0.30)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: '1px solid rgba(10,126,140,0.12)',
              flexShrink: 0,
            }}>
              <span style={{
                fontSize: '0.875rem', fontWeight: 700, color: '#1A1A2E',
                maxWidth: 'calc(100% - 40px)', overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {doc.name}
              </span>
              <button
                onClick={() => { setPreviewOpen(false); setPreviewUrl(null) }}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.06)', border: 'none',
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
              {previewUrl ? (
                mime.startsWith('image/') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt={doc.name}
                    style={{
                      display: 'block', maxWidth: '100%', maxHeight: '70vh',
                      margin: 'auto', objectFit: 'contain', padding: 16,
                    }}
                  />
                ) : (
                  <iframe src={previewUrl} title={doc.name}
                    style={{ width: '100%', height: '70vh', border: 'none', display: 'block' }}
                  />
                )
              ) : (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: 200, color: '#5a7478', fontSize: '0.875rem',
                }}>
                  Cargando…
                </div>
              )}
            </div>
            <div style={{
              display: 'flex', gap: 8, padding: '14px 20px',
              borderTop: '1px solid rgba(10,126,140,0.12)',
              flexShrink: 0, justifyContent: 'flex-end',
            }}>
              <button
                onClick={handleDownload}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 22px', borderRadius: 9999,
                  border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: '0.875rem',
                  background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                  color: 'white',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Descargar
              </button>
            </div>
          </div>
        </>
      )}

      <div className="doc-detail-bg flex min-h-screen">
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
              {doc?.name ?? '…'}
            </span>
          </nav>

          {loading && (
            <div style={{ maxWidth: 560, margin: '0 auto' }}>
              <div style={{
                background: '#FFFFFF', borderRadius: '1.5rem',
                boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                padding: 32, textAlign: 'center',
              }}>
                <p style={{ color: '#5a7478', fontSize: '0.875rem' }}>Cargando…</p>
              </div>
            </div>
          )}

          {!loading && doc && (
            <div style={{ maxWidth: 560, margin: '0 auto' }}>

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
                  marginBottom: 6,
                }}>
                  {doc.name}
                </h1>
                <span style={{ fontSize: '0.75rem', color: '#5a7478' }}>
                  {DOC_TYPE_LABELS[doc.type ?? ''] ?? 'Documento'} · {fmtLongDate(doc.created_at)}
                </span>
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

              {/* Información */}
              <div style={{ marginBottom: 24 }}>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
                }}>Información</p>
                <div style={{
                  background: '#FFFFFF', borderRadius: '1.5rem',
                  boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                  overflow: 'hidden',
                }}>
                  {[
                    { label: 'Tipo',      value: DOC_TYPE_LABELS[doc.type ?? ''] ?? '—' },
                    { label: 'Fecha',     value: fmtLongDate(doc.created_at) },
                    { label: 'Subido por',value: uploaderName },
                    { label: 'Tamaño',    value: formatBytes(doc.file_size_bytes) },
                  ].map((row, i, arr) => (
                    <div key={row.label} style={{
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 20px',
                      borderBottom: i < arr.length - 1
                        ? '1px solid rgba(10,126,140,0.08)' : 'none',
                      gap: 12,
                    }}>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                        textTransform: 'uppercase', color: '#5a7478', minWidth: 90,
                      }}>{row.label}</span>
                      <span style={{
                        fontSize: '0.875rem', fontWeight: 600,
                        color: '#1A1A2E', flex: 1,
                      }}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Botón descargar */}
              <button
                type="button"
                onClick={handleDownload}
                style={{
                  width: '100%', padding: '14px', borderRadius: 9999,
                  border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: '0.875rem',
                  background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                  color: 'white', marginBottom: 12,
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 8,
                  transition: 'filter 0.15s', fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.08)' }}
                onMouseLeave={(e) => { e.currentTarget.style.filter = 'brightness(1)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Descargar
              </button>

              {/* Botón ver preview */}
              {isPreviewable && (
                <button
                  type="button"
                  onClick={handleOpenPreview}
                  disabled={previewLoading}
                  style={{
                    width: '100%', padding: '13px', borderRadius: 9999,
                    border: '1.5px solid rgba(10,126,140,0.25)',
                    background: 'white', cursor: previewLoading ? 'not-allowed' : 'pointer',
                    fontWeight: 700, fontSize: '0.875rem', color: '#0A7E8C',
                    marginBottom: 24, opacity: previewLoading ? 0.6 : 1,
                    transition: 'background 0.15s', fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(10,126,140,0.04)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'white' }}
                >
                  {previewLoading ? 'Cargando…' : 'Ver documento'}
                </button>
              )}

              {/* Preview inline para imágenes */}
              {isPreviewable && thumbUrl && !previewLoading && (
                <div style={{ marginBottom: 24 }}>
                  <div
                    onClick={handleOpenPreview}
                    role="button"
                    tabIndex={0}
                    style={{
                      position: 'relative', borderRadius: '1rem',
                      overflow: 'hidden', cursor: 'pointer',
                      border: '1.5px solid rgba(10,126,140,0.18)',
                      height: 200, background: '#f0f4f8',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 4px 20px rgba(10,126,140,0.18)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    {mime.startsWith('image/') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumbUrl} alt={doc.name}
                        style={{
                          width: '100%', height: '100%',
                          objectFit: 'cover', display: 'block',
                          pointerEvents: 'none',
                        }}
                      />
                    ) : (
                      <>
                        <iframe
                          src={`${thumbUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                          title="preview"
                          style={{
                            width: '100%', height: '100%',
                            border: 'none', display: 'block',
                            pointerEvents: 'none',
                          }}
                        />
                        <div style={{ position: 'absolute', inset: 0 }} />
                      </>
                    )}
                    <div style={{
                      position: 'absolute', bottom: 10, right: 10,
                      background: 'rgba(10,126,140,0.82)',
                      backdropFilter: 'blur(6px)',
                      borderRadius: 9999, padding: '4px 12px',
                      fontSize: '0.75rem', fontWeight: 700,
                      color: 'white', pointerEvents: 'none',
                    }}>
                      Ver
                    </div>
                  </div>
                </div>
              )}

              {/* Tareas vinculadas */}
              <div style={{ marginBottom: 24 }}>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
                }}>Tareas vinculadas</p>
                <div style={{
                  background: '#FFFFFF', borderRadius: '1.5rem',
                  boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                  overflow: 'hidden',
                }}>
                  {linkedTasks.length === 0 && !taskPickerOpen && (
                    <div style={{ padding: '16px 20px' }}>
                      <p style={{
                        fontSize: '0.875rem', color: '#5a7478',
                        fontStyle: 'italic', margin: 0,
                      }}>
                        Sin tareas vinculadas todavía.
                      </p>
                    </div>
                  )}

                  {linkedTasks.length > 0 && (
                    <div>
                      {linkedTasks.map((t, i) => (
                        <div key={t.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '13px 20px',
                          borderBottom: i < linkedTasks.length - 1
                            ? '1px solid rgba(10,126,140,0.08)' : 'none',
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24"
                            fill="none" stroke="#0A7E8C" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round"
                            style={{ flexShrink: 0 }}>
                            <polyline points="9 11 12 14 22 4" />
                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                          </svg>
                          <Link
                            href={`/gestion/tarea/${t.id}`}
                            style={{
                              flex: 1, fontSize: '0.875rem', fontWeight: 600,
                              color: '#1A1A2E', textDecoration: 'none',
                              whiteSpace: 'nowrap', overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = '#0A7E8C' }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = '#1A1A2E' }}
                          >
                            {t.title}
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleUnlinkTask(t.id)}
                            style={{
                              background: 'none', border: 'none',
                              cursor: 'pointer', color: '#5a7478',
                              padding: 4, flexShrink: 0,
                              transition: 'color 0.15s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = '#ba1a1a' }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = '#5a7478' }}
                            title="Desvincular tarea"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24"
                              fill="none" stroke="currentColor" strokeWidth="2"
                              strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Picker de tareas */}
                  {taskPickerOpen && (
                    <div style={{
                      padding: '12px 20px 14px',
                      borderTop: linkedTasks.length > 0
                        ? '1px solid rgba(10,126,140,0.08)' : 'none',
                    }}>
                      <p style={{
                        fontSize: '0.7rem', fontWeight: 700,
                        letterSpacing: '0.06em', textTransform: 'uppercase',
                        color: '#5a7478', marginBottom: 10,
                      }}>Seleccioná una tarea</p>
                      {unlinkedTasks.length === 0 ? (
                        <p style={{
                          fontSize: '0.8125rem', color: '#5a7478',
                          fontStyle: 'italic', margin: '0 0 8px',
                        }}>
                          No hay tareas pendientes disponibles.
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                          {unlinkedTasks.map(t => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => handleLinkTask(t.id)}
                              disabled={linkLoading}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '8px 10px', borderRadius: '0.5rem',
                                background: 'rgba(10,126,140,0.04)',
                                border: '1px solid rgba(10,126,140,0.10)',
                                cursor: linkLoading ? 'not-allowed' : 'pointer',
                                textAlign: 'left', fontFamily: 'inherit',
                                opacity: linkLoading ? 0.6 : 1,
                                transition: 'background 0.15s',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(10,126,140,0.09)' }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(10,126,140,0.04)' }}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24"
                                fill="none" stroke="#0A7E8C" strokeWidth="2"
                                strokeLinecap="round" strokeLinejoin="round"
                                style={{ flexShrink: 0 }}>
                                <polyline points="9 11 12 14 22 4" />
                                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                              </svg>
                              <span style={{
                                flex: 1, fontSize: '0.8125rem', fontWeight: 600,
                                color: '#1A1A2E', whiteSpace: 'nowrap',
                                overflow: 'hidden', textOverflow: 'ellipsis',
                              }}>{t.title}</span>
                              <svg width="13" height="13" viewBox="0 0 24 24"
                                fill="none" stroke="#0A7E8C" strokeWidth="2.5"
                                strokeLinecap="round" strokeLinejoin="round"
                                style={{ flexShrink: 0 }}>
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                              </svg>
                            </button>
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setTaskPickerOpen(false)}
                        style={{
                          background: 'none', border: 'none',
                          cursor: 'pointer', color: '#5a7478',
                          fontSize: '0.75rem', fontFamily: 'inherit',
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  )}

                  {/* Botón vincular */}
                  {!taskPickerOpen && unlinkedTasks.length > 0 && (
                    <div style={{
                      padding: '10px 20px 14px',
                      borderTop: linkedTasks.length > 0
                        ? '1px solid rgba(10,126,140,0.08)' : 'none',
                    }}>
                      <button
                        type="button"
                        onClick={() => setTaskPickerOpen(true)}
                        style={{
                          background: 'none', border: 'none',
                          cursor: 'pointer', color: '#0A7E8C',
                          fontSize: '0.8125rem', fontWeight: 600,
                          fontFamily: 'inherit', padding: 0,
                          textDecoration: 'underline', textUnderlineOffset: 3,
                        }}
                      >
                        + Vincular a una tarea
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Acciones */}
              <div style={{ marginBottom: 24 }}>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
                }}>Acciones</p>
                <div style={{
                  background: '#FFFFFF', borderRadius: '1rem',
                  boxShadow: '0 4px 24px rgba(10,126,140,0.08)',
                  padding: '13px 20px',
                }}>
                  {deleteConfirm ? (
                    <div>
                      <p style={{
                        fontSize: '0.875rem', color: '#1A1A2E',
                        fontWeight: 600, marginBottom: 12,
                      }}>
                        ¿Eliminar este documento?<br />
                        <span style={{ fontWeight: 400, fontSize: '0.8125rem', color: '#5a7478' }}>
                          Esta acción no se puede deshacer.
                        </span>
                      </p>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button
                          onClick={() => setDeleteConfirm(false)}
                          disabled={deleteLoading}
                          style={{
                            flex: 1, padding: '9px 0',
                            background: 'rgba(10,126,140,0.07)',
                            color: '#0A7E8C', border: 'none',
                            borderRadius: '0.6rem', fontWeight: 700,
                            fontSize: '0.875rem', cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}>
                          Cancelar
                        </button>
                        <button
                          onClick={handleDelete}
                          disabled={deleteLoading}
                          style={{
                            flex: 1, padding: '9px 0',
                            background: 'rgba(186,26,26,0.10)',
                            color: '#ba1a1a', border: 'none',
                            borderRadius: '0.6rem', fontWeight: 700,
                            fontSize: '0.875rem', cursor: 'pointer',
                            fontFamily: 'inherit',
                            opacity: deleteLoading ? 0.6 : 1,
                          }}>
                          {deleteLoading ? 'Eliminando…' : 'Eliminar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between', gap: 12,
                    }}>
                      <span style={{ fontSize: '0.875rem', color: '#5a7478', flex: 1 }}>
                        Eliminar este documento
                      </span>
                      <button
                        onClick={() => setDeleteConfirm(true)}
                        style={{
                          background: 'rgba(186,26,26,0.06)', color: '#ba1a1a',
                          border: 'none', borderRadius: '0.6rem',
                          padding: '7px 16px', fontSize: '0.875rem',
                          fontWeight: 700, cursor: 'pointer',
                          transition: 'background 0.15s', fontFamily: 'inherit',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(186,26,26,0.14)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(186,26,26,0.06)' }}
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </main>
      </div>
    </>
  )
}
