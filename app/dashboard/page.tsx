'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { supabase } from '@/lib/supabase'
import {
  SkeletonStyles, SkeletonText, SkeletonAvatar,
  SkeletonCard, SkeletonBase,
} from '@/components/Skeleton'

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type Crisis = {
  id:         string
  name:       string
  status:     string
  category:   string | null
  started_at: string | null
  ai_summary: string | null
}

type Contact = {
  id:           string
  name:         string
  role:         string | null
  proximity:    string | null
  initials:     string | null
  phone:        string | null
  email:        string | null
  relationship: string | null
}

type HistoryEvent = {
  id:          string
  title:       string
  description: string | null
  occurred_at: string
}

// Sidesheet modes
type SSMode = 'member-view' | 'member-add' | null

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function daysSince(iso: string | null) {
  if (!iso) return 0
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

function fmtLongDate(iso: string | null) {
  if (!iso) return 'â€”'
  const s = new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function fmtShortDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso)
    .toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
    .replace('.', '')
}

function getInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

// â”€â”€ Role mapping â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ROLE_BADGES: Record<string, { label: string; bg: string; color: string }> = {
  acompanamiento:      { label: 'AcompaÃ±.',  bg: 'rgba(46,205,167,0.10)', color: '#0a6e5a' },
  logistico:           { label: 'LogÃ­stico', bg: 'rgba(232,145,58,0.10)', color: '#b86a10' },
  prestador_servicios: { label: 'Prestador', bg: 'rgba(10,126,140,0.07)', color: '#0A7E8C' },
}

const ROLE_LABELS: Record<string, string> = {
  acompanamiento:      'AcompaÃ±amiento',
  logistico:           'LogÃ­stico',
  prestador_servicios: 'Prestador de servicios',
}

const PROXIMITY_LABELS: Record<string, string> = {
  nucleo:       'Es parte de mi nÃºcleo',
  ayuda:        'Es alguien que me ayuda o puede ayudar',
  profesional:  'Es un proveedor de servicios o un profesional',
}

const DOC_TYPE_LABELS: Record<string, string> = {
  estudio_medico: 'Estudio mÃ©dico',
  receta:         'Receta',
  informe:        'Informe',
  otros:          'Otros',
}

// â”€â”€ Icons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function IconChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  )
}

function IconAddPerson() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0A7E8C"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8"  x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  )
}

function IconClose({ color = '#5a7478' }: { color?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6"  x2="6"  y2="18" />
      <line x1="6"  y1="6"  x2="18" y2="18" />
    </svg>
  )
}

// â”€â”€ Shared sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-bold uppercase text-[#5a7478]"
      style={{ fontSize: '0.875rem', letterSpacing: '0.1em', marginBottom: 16 }}>
      {children}
    </p>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#FFFFFF', borderRadius: '1.5rem',
      boxShadow: '0 4px 24px rgba(10,126,140,0.08)', padding: 24, ...style,
    }}>
      {children}
    </div>
  )
}

// â”€â”€ Sidesheet shared elements â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SS_INPUT_STYLE: React.CSSProperties = {
  flex: 1, border: 'none', background: 'none',
  fontSize: '0.875rem', fontWeight: 600, outline: 'none',
  color: '#1A1A2E', fontFamily: 'inherit',
}

const SS_SELECT_STYLE: React.CSSProperties = {
  flex: 1, maxWidth: 220,
  background: '#FAF8F5',
  border: '1.5px solid rgba(10,126,140,0.12)',
  borderRadius: 9999,
  padding: '8px 36px 8px 16px',
  fontSize: '0.875rem', color: '#1A1A2E',
  outline: 'none', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235a7478' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: 16,
  cursor: 'pointer',
}

// â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function DashboardPage() {
  const [id, setId] = useState<string | null>(null)
  const router  = useRouter()

  // â”€â”€ Page data state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [crisis,   setCrisis]   = useState<Crisis | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [history,  setHistory]  = useState<HistoryEvent[]>([])
  const [loading,  setLoading]  = useState(true)

  // â”€â”€ Sidesheet state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [ssMode,    setSsMode]    = useState<SSMode>(null)
  const [ssLoading, setSsLoading] = useState(false)
  const [ssError,   setSsError]   = useState<string | null>(null)

  // Member sidesheet state
  const [ssMember,    setSsMember]    = useState<Contact | null>(null)
  const [mvRole,      setMvRole]      = useState('')
  const [mvProximity, setMvProximity] = useState('')
  const [availableContacts, setAvailableContacts] = useState<Contact[]>([])
  const [availableLoading,  setAvailableLoading]  = useState(false)

  // â”€â”€ Load data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  useEffect(() => {
    async function load() {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) { router.replace('/login'); return }

      const { data: activeCrisis, error: activeCrisisError } = await supabase
        .from('cases')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'activa')
        .maybeSingle()

      if (activeCrisisError || !activeCrisis) {
        setLoading(false)
        return
      }

      setId(activeCrisis.id)
      const currentId = activeCrisis.id

      const [crisisRes, contactsRes, historyRes] = await Promise.all([
        supabase
          .from('cases')
          .select('id, name, status, category, started_at, ai_summary')
          .eq('id', currentId).eq('user_id', user.id).maybeSingle(),
        supabase
          .from('case_contacts')
          .select('contact:contacts(id, name, role, proximity, initials, phone, email, relationship)')
          .eq('case_id', currentId),
        supabase
          .from('case_history')
          .select('id, title, description, occurred_at')
          .eq('case_id', currentId).order('occurred_at', { ascending: false }),
      ])

      if (crisisRes.error) console.error('Error crisis:', crisisRes.error)
      if (!crisisRes.data) { router.replace('/case'); return }
      setCrisis(crisisRes.data)

      if (contactsRes.error) console.error('Error contacts:', contactsRes.error)
      // case_contacts may have duplicate rows for the same contact_id;
      // dedupe by contact id before storing
      const ccRows = (contactsRes.data ?? []) as { contact: Contact | Contact[] | null }[]
      const dedup  = new Map<string, Contact>()
      for (const r of ccRows) {
        const c = Array.isArray(r.contact) ? r.contact[0] : r.contact
        if (c && !dedup.has(c.id)) dedup.set(c.id, c)
      }
      setContacts(Array.from(dedup.values()))

      if (historyRes.error) console.error('Error history:', historyRes.error)
      setHistory((historyRes.data ?? []) as HistoryEvent[])

      setLoading(false)
    }
    load()
  }, [id, router])

  // â”€â”€ Reload helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const reloadContacts = useCallback(async () => {
    const { data } = await supabase
      .from('case_contacts')
      .select('contact:contacts(id, name, role, proximity, initials, phone, email, relationship)')
      .eq('case_id', id)
    if (!data) return
    const ccRows = data as { contact: Contact | Contact[] | null }[]
    const dedup  = new Map<string, Contact>()
    for (const r of ccRows) {
      const c = Array.isArray(r.contact) ? r.contact[0] : r.contact
      if (c && !dedup.has(c.id)) dedup.set(c.id, c)
    }
    setContacts(Array.from(dedup.values()))
  }, [id])

  const reloadHistory = useCallback(async () => {
    const { data } = await supabase
      .from('case_history')
      .select('id, title, description, occurred_at')
      .eq('case_id', id)
      .order('occurred_at', { ascending: false })
    if (data) setHistory(data as HistoryEvent[])
  }, [id])

  // Best-effort write to case_history; never blocks the UI on failure
  const logHistory = useCallback(async (title: string, description: string | null, eventType: string) => {
    const { error } = await supabase.from('case_history').insert({
      case_id:     id,
      title,
      description,
      event_type:  eventType,
      occurred_at: new Date().toISOString(),
    })
    if (error) {
      console.error('Error logging history:', error.message, error.details, error.hint, error.code)
      return
    }
    await reloadHistory()
  }, [id, reloadHistory])

  // â”€â”€ Sidesheet helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  function openMemberView(c: Contact) {
    setSsMember(c)
    setMvRole(c.role ?? '')
    setMvProximity(c.proximity ?? '')
    setSsError(null)
    setSsMode('member-view')
  }

  async function openMemberAdd() {
    setSsError(null)
    setAvailableContacts([])
    setAvailableLoading(true)
    setSsMode('member-add')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setAvailableLoading(false); return }

    const { data: allContacts, error } = await supabase
      .from('contacts')
      .select('id, name, role, proximity, initials, phone, email, relationship')
      .eq('user_id', user.id)
      .order('name', { ascending: true })

    setAvailableLoading(false)
    if (error) { setSsError(error.message); return }

    const inCrisis = new Set(contacts.map((c) => c.id))
    const available = (allContacts ?? []).filter((c) => !inCrisis.has(c.id)) as Contact[]
    setAvailableContacts(available)
  }

  function closeSheet() {
    setSsMode(null)
    setSsMember(null)
    setSsError(null)
  }

  // â”€â”€ Member view actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async function handleRoleChange(val: string) {
    if (!ssMember) return
    setMvRole(val)
    setSsError(null)
    const { error } = await supabase.from('contacts').update({ role: val }).eq('id', ssMember.id)
    if (error) { setSsError(error.message); return }
    await reloadContacts()
  }

  async function handleProximityChange(val: string) {
    if (!ssMember) return
    setMvProximity(val)
    setSsError(null)
    const { error } = await supabase.from('contacts').update({ proximity: val }).eq('id', ssMember.id)
    if (error) { setSsError(error.message); return }
    await reloadContacts()
  }

  async function handleRemoveMember() {
    if (!ssMember) return
    if (!window.confirm(`Â¿Quitar a ${ssMember.name.split(' ')[0]} de este tema?`)) return
    setSsLoading(true)
    setSsError(null)
    const { error } = await supabase
      .from('case_contacts')
      .delete()
      .eq('case_id', id)
      .eq('contact_id', ssMember.id)
    setSsLoading(false)
    if (error) { setSsError(error.message); return }
    await reloadContacts()
    closeSheet()
  }

  // â”€â”€ Member add action â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async function handleAddMember(c: Contact) {
    if (ssLoading) return
    setSsLoading(true)
    setSsError(null)
    const { error } = await supabase
      .from('case_contacts')
      .insert({ case_id: id, contact_id: c.id })
    setSsLoading(false)
    if (error) { setSsError(error.message); return }
    await reloadContacts()
    closeSheet()
  }

  // â”€â”€ Derived â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const isOpen = ssMode !== null

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  return (
    <>
      <style>{`
        @keyframes heroBgDrift {
          0%, 100% {
            background:
              radial-gradient(ellipse at 15% 15%, rgba(61,199,166,0.03)  0%, transparent 55%),
              radial-gradient(ellipse at 85% 10%, rgba(80,220,175,0.07)  0%, transparent 50%),
              radial-gradient(ellipse at 88% 82%, rgba(224,121,49,0.08)  0%, transparent 52%),
              radial-gradient(ellipse at 12% 88%, rgba(158,160,81,0.08)  0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 65%),
              #f0f4f8;
          }
          25% {
            background:
              radial-gradient(ellipse at 22% 10%, rgba(61,199,166,0.03)  0%, transparent 55%),
              radial-gradient(ellipse at 90% 20%, rgba(80,220,175,0.07)  0%, transparent 50%),
              radial-gradient(ellipse at 80% 88%, rgba(224,121,49,0.08)  0%, transparent 52%),
              radial-gradient(ellipse at  6% 78%, rgba(158,160,81,0.08)  0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 65%),
              #f0f4f8;
          }
          50% {
            background:
              radial-gradient(ellipse at 10% 22%, rgba(61,199,166,0.03)  0%, transparent 55%),
              radial-gradient(ellipse at 78%  8%, rgba(80,220,175,0.07)  0%, transparent 50%),
              radial-gradient(ellipse at 92% 75%, rgba(224,121,49,0.08)  0%, transparent 52%),
              radial-gradient(ellipse at 18% 92%, rgba(158,160,81,0.08)  0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 65%),
              #f0f4f8;
          }
          75% {
            background:
              radial-gradient(ellipse at 20% 22%, rgba(61,199,166,0.03)  0%, transparent 55%),
              radial-gradient(ellipse at 82% 18%, rgba(80,220,175,0.07)  0%, transparent 50%),
              radial-gradient(ellipse at 85% 90%, rgba(224,121,49,0.08)  0%, transparent 52%),
              radial-gradient(ellipse at 14% 82%, rgba(158,160,81,0.08)  0%, transparent 50%),
              radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.15) 0%, transparent 65%),
              #f0f4f8;
          }
        }
        .crisis-detail-bg { animation: heroBgDrift 30s ease-in-out infinite; }
      `}</style>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          SIDESHEET OVERLAY + PANEL
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}

      {/* Overlay */}
      <div
        onClick={closeSheet}
        style={{
          position:       'fixed',
          inset:          0,
          background:     'rgba(0,0,0,0.22)',
          zIndex:         200,
          opacity:        isOpen ? 1 : 0,
          pointerEvents:  isOpen ? 'auto' : 'none',
          transition:     'opacity 0.3s',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position:   'fixed',
          top:        0,
          right:      0,
          width:      420,
          maxWidth:   '100vw',
          height:     '100vh',
          background: '#f0f4f8',
          zIndex:     201,
          transform:  isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
          overflowY:  'auto',
          display:    'flex',
          flexDirection: 'column',
          boxShadow:  '-6px 0 32px rgba(0,0,0,0.10)',
        }}
      >
        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 0', flexShrink: 0,
        }}>
          <span style={{
            fontSize: '0.7rem', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5a7478',
          }}>
            {ssMode === 'member-view' ? 'Miembro del cÃ­rculo'
             : ssMode === 'member-add'  ? 'Agregar al cÃ­rculo'
             : ''}
          </span>
          <button
            onClick={closeSheet}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#5a7478', fontSize: '1rem', transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.11)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)' }}
          >
            âœ•
          </button>
        </div>

        {/* â”€â”€ MEMBER VIEW â”€â”€ */}
        {ssMode === 'member-view' && ssMember && (() => {
          const initials = (ssMember.initials ?? getInitials(ssMember.name)).slice(0, 2)
          const badge = ROLE_BADGES[ssMember.role ?? ''] ?? null
          return (
            <div style={{ padding: '0 24px 40px', flex: 1 }}>
              {/* Hero */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                textAlign: 'center', padding: '24px 0 20px',
                borderBottom: '1px solid rgba(10,126,140,0.12)', marginBottom: 24,
              }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '1.5rem', color: 'white',
                  boxShadow: '0 8px 40px rgba(10,126,140,0.16)',
                  marginBottom: 14,
                }}>
                  {initials}
                </div>
                <div style={{
                  fontSize: '1.5rem', fontWeight: 800,
                  letterSpacing: '-0.02em', marginBottom: 8, color: '#1A1A2E',
                }}>
                  {ssMember.name}
                </div>
                {badge && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', borderRadius: 9999,
                    padding: '3px 11px', fontSize: '0.7rem', fontWeight: 700,
                    letterSpacing: '0.05em', textTransform: 'uppercase',
                    background: badge.bg, color: badge.color,
                  }}>
                    {ROLE_LABELS[ssMember.role ?? ''] ?? badge.label}
                  </span>
                )}
              </div>

              {/* Datos de contacto */}
              <div style={{ marginBottom: 24 }}>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
                }}>Datos de contacto</p>
                <Card style={{ padding: 0, borderRadius: '1rem' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '13px 20px', borderBottom: '1px solid rgba(10,126,140,0.12)', gap: 12,
                  }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                      textTransform: 'uppercase', color: '#5a7478', minWidth: 80,
                    }}>TelÃ©fono</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1A1A2E', flex: 1 }}>
                      {ssMember.phone || 'â€”'}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '13px 20px', borderBottom: '1px solid rgba(10,126,140,0.12)', gap: 12,
                  }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                      textTransform: 'uppercase', color: '#5a7478', minWidth: 80,
                    }}>Email</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1A1A2E', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {ssMember.email || 'â€”'}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '13px 20px', gap: 12,
                  }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                      textTransform: 'uppercase', color: '#5a7478', minWidth: 80,
                    }}>RelaciÃ³n</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1A1A2E', flex: 1 }}>
                      {ssMember.relationship || 'â€”'}
                    </span>
                  </div>
                </Card>
              </div>

              {/* Rol y cercanÃ­a */}
              <div style={{ marginBottom: 24 }}>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
                }}>Rol y cercanÃ­a</p>
                <Card style={{ padding: 0, borderRadius: '1rem' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '13px 20px', borderBottom: '1px solid rgba(10,126,140,0.12)', gap: 12,
                  }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                      textTransform: 'uppercase', color: '#5a7478', minWidth: 80,
                    }}>Rol</span>
                    <select
                      value={mvRole}
                      onChange={(e) => handleRoleChange(e.target.value)}
                      style={{ ...SS_SELECT_STYLE, maxWidth: 240 }}
                    >
                      <option value="">â€” Sin rol â€”</option>
                      {Object.entries(ROLE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '13px 20px', gap: 12,
                  }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.07em',
                      textTransform: 'uppercase', color: '#5a7478', minWidth: 80,
                    }}>CercanÃ­a</span>
                    <select
                      value={mvProximity}
                      onChange={(e) => handleProximityChange(e.target.value)}
                      style={{ ...SS_SELECT_STYLE, maxWidth: 280 }}
                    >
                      <option value="">â€” Sin definir â€”</option>
                      {Object.entries(PROXIMITY_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>
                </Card>
              </div>

              {/* Error inline */}
              {ssError && (
                <p style={{
                  fontSize: '0.7rem', color: '#ba1a1a', fontWeight: 600,
                  marginBottom: 16, padding: '10px 14px',
                  background: 'rgba(186,26,26,0.06)', borderRadius: '0.6rem',
                }}>
                  {ssError}
                </p>
              )}

              {/* Acciones */}
              <div>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
                }}>Acciones</p>
                <Card style={{ padding: 0, borderRadius: '1rem' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '13px 20px', gap: 12,
                  }}>
                    <span style={{ fontSize: '0.875rem', color: '#5a7478', flex: 1 }}>
                      Quitar a {ssMember.name.split(' ')[0]} de este tema
                    </span>
                    <button
                      onClick={handleRemoveMember}
                      disabled={ssLoading}
                      style={{
                        background: 'rgba(186,26,26,0.06)', color: '#ba1a1a',
                        border: 'none', borderRadius: '0.6rem',
                        padding: '7px 16px', fontSize: '0.875rem', fontWeight: 700,
                        cursor: ssLoading ? 'not-allowed' : 'pointer',
                        opacity: ssLoading ? 0.6 : 1, transition: 'filter 0.15s',
                      }}
                    >
                      Quitar
                    </button>
                  </div>
                </Card>
              </div>
            </div>
          )
        })()}

        {/* â”€â”€ MEMBER ADD â”€â”€ */}
        {ssMode === 'member-add' && (
          <div style={{ padding: '0 24px 40px', flex: 1 }}>
            {/* Hero */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              textAlign: 'center', padding: '24px 0 20px',
              borderBottom: '1px solid rgba(10,126,140,0.12)', marginBottom: 24,
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'rgba(61,199,166,0.08)',
                border: '2px dashed rgba(61,199,166,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 14,
              }}>
                <IconAddPerson />
              </div>
              <div style={{
                fontSize: '1.5rem', fontWeight: 800,
                letterSpacing: '-0.02em', color: '#1A1A2E',
              }}>
                Agregar al cÃ­rculo
              </div>
            </div>

            {/* Error inline */}
            {ssError && (
              <p style={{
                fontSize: '0.7rem', color: '#ba1a1a', fontWeight: 600,
                marginBottom: 16, padding: '10px 14px',
                background: 'rgba(186,26,26,0.06)', borderRadius: '0.6rem',
              }}>
                {ssError}
              </p>
            )}

            {/* Loading state */}
            {availableLoading && (
              <p className="text-center" style={{ fontSize: '0.875rem', color: '#5a7478', padding: '24px 0' }}>
                Cargando contactosâ€¦
              </p>
            )}

            {/* Empty state */}
            {!availableLoading && availableContacts.length === 0 && (
              <Card style={{ padding: 24, textAlign: 'center' }}>
                <p style={{ fontSize: '0.875rem', color: '#5a7478', lineHeight: 1.6 }}>
                  Todos tus contactos ya estÃ¡n en este tema.<br />
                  PodÃ©s agregar nuevos hablando con el agente.
                </p>
              </Card>
            )}

            {/* Available contacts list */}
            {!availableLoading && availableContacts.length > 0 && (
              <>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: '#5a7478', marginBottom: 12,
                }}>Contactos disponibles</p>
                <Card style={{ padding: 0, borderRadius: '1rem' }}>
                  {availableContacts.map((c, i) => {
                    const initials = (c.initials ?? getInitials(c.name)).slice(0, 2)
                    const badge = ROLE_BADGES[c.role ?? ''] ?? null
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleAddMember(c)}
                        disabled={ssLoading}
                        className="flex items-center w-full text-left"
                        style={{
                          gap: 12, padding: '14px 20px',
                          borderBottom: i < availableContacts.length - 1 ? '1px solid rgba(10,126,140,0.12)' : 'none',
                          background: 'transparent', border: 'none',
                          cursor: ssLoading ? 'not-allowed' : 'pointer',
                          opacity: ssLoading ? 0.6 : 1,
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => { if (!ssLoading) e.currentTarget.style.background = 'rgba(61,199,166,0.07)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <div className="rounded-full flex items-center justify-center flex-shrink-0 text-white"
                          style={{
                            width: 36, height: 36, fontSize: '0.75rem', fontWeight: 700,
                            background: 'linear-gradient(135deg, #0A7E8C, #2ECDA7)',
                          }}>
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-[#1A1A2E] truncate" style={{ fontSize: '0.875rem' }}>
                            {c.name}
                          </div>
                          {c.relationship && (
                            <div style={{ fontSize: '0.7rem', color: '#5a7478', marginTop: 2 }}>
                              {c.relationship}
                            </div>
                          )}
                        </div>
                        {badge && (
                          <span className="inline-flex items-center font-bold uppercase whitespace-nowrap flex-shrink-0"
                            style={{
                              background: badge.bg, color: badge.color, borderRadius: 9999,
                              padding: '3px 11px', fontSize: '0.7rem', letterSpacing: '0.05em',
                            }}>
                            {badge.label}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </Card>
              </>
            )}
          </div>
        )}

      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          MAIN PAGE
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}

      <div className="crisis-detail-bg flex min-h-screen">
        <Sidebar />

        <main className="flex-1 ml-0 md:ml-[240px] min-h-screen px-5 py-8 pb-28 md:px-10 md:py-10 md:pb-10">
          <SkeletonStyles />

          {/* Empty state â€” no active crisis */}
          {!loading && !crisis && (
            <div className="flex justify-center" style={{ marginTop: 80 }}>
              <div style={{ textAlign: 'center', maxWidth: 400 }}>
                <p className="font-bold text-[#1A1A2E]" style={{ fontSize: '1rem', marginBottom: 8 }}>
                  No hay ningún tema activo
                </p>
                <p style={{ fontSize: '0.875rem', color: '#5a7478', marginBottom: 24 }}>
                  HablÃ¡ con el agente para registrar tu situaciÃ³n.
                </p>
                <Link href="/chat"
                  className="inline-block bg-[#0A7E8C] text-white font-bold rounded-full transition-all hover:brightness-110"
                  style={{ padding: '12px 28px', fontSize: '0.875rem' }}>
                  Hablar con el agente
                </Link>
              </div>
            </div>
          )}

          {/* Header */}
          {crisis && (
            <div className="flex items-start justify-between flex-wrap"
              style={{ gap: 12, marginBottom: 40 }}>
              <div>
                <h1 className="font-extrabold text-[#1A1A2E]"
                  style={{ fontSize: '2rem', letterSpacing: '-0.03em', marginBottom: 8, lineHeight: 1.15 }}>
                  {crisis.name}
                </h1>
                <div className="flex items-center flex-wrap" style={{ gap: 10 }}>
                  {crisis.status === 'activa' ? (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', borderRadius: 9999,
                      padding: '3px 11px', fontSize: '0.7rem', fontWeight: 700,
                      letterSpacing: '0.05em', textTransform: 'uppercase',
                      background: 'rgba(46,205,167,0.14)', color: '#0a6e5a',
                    }}>Activa</span>
                  ) : (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', borderRadius: 9999,
                      padding: '3px 11px', fontSize: '0.7rem', fontWeight: 700,
                      letterSpacing: '0.05em', textTransform: 'uppercase',
                      background: 'rgba(90,116,120,0.10)', color: '#5a7478',
                    }}>Resuelta</span>
                  )}
                  <span className="text-[#5a7478]" style={{ fontSize: '0.7rem' }}>
                    Desde el {fmtLongDate(crisis.started_at)} Â· {daysSince(crisis.started_at)} dÃ­as
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Contexto */}
          {crisis?.ai_summary && (
            <div style={{ marginBottom: 40 }}>
              <SectionTitle>Contexto</SectionTitle>
              <Card>
                <p className="text-[#5a7478]" style={{ fontSize: '0.875rem', lineHeight: 1.75 }}>
                  {crisis.ai_summary}
                </p>
              </Card>
            </div>
          )}


          {/* Historia */}
          {crisis && <div style={{ marginBottom: 40 }}>
            <SectionTitle>Historia</SectionTitle>
            <Card>
              {history.length > 0 ? (
                <div className="flex flex-col">
                  {history.map((h, i) => {
                    const isLast = i === history.length - 1
                    return (
                      <div key={h.id} className="flex"
                        style={{ gap: 16, paddingBottom: 28, position: 'relative' }}>
                        {!isLast && (
                          <div style={{
                            position: 'absolute', left: 15, top: 34, bottom: 0,
                            width: 2, background: 'rgba(10,126,140,0.12)',
                          }} />
                        )}
                        <div className="rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ width: 32, height: 32, background: '#FFFFFF', border: '2px solid #0A7E8C', position: 'relative', zIndex: 1 }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#0A7E8C' }} />
                        </div>
                        <div className="flex-1" style={{ paddingTop: 4 }}>
                          <div style={{ fontSize: '0.7rem', color: '#5a7478', marginBottom: 3 }}>
                            {fmtLongDate(h.occurred_at)}
                          </div>
                          <div className="font-bold text-[#1A1A2E]" style={{ fontSize: '0.875rem', marginBottom: 3 }}>
                            {h.title}
                          </div>
                          {h.description && (
                            <div style={{ fontSize: '0.875rem', color: '#5a7478', lineHeight: 1.5 }}>
                              {h.description}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-[#5a7478] text-center" style={{ fontSize: '0.875rem', padding: '24px 0' }}>
                  Sin eventos en la historia todavia
                </p>
              )}
            </Card>
          </div>}

          {/* -- Loading skeleton ---------------------------------------- */}
          {loading && !crisis && (
            <div>
              {/* Header skeleton */}
              <div className="mb-10">
                <SkeletonText width="55%" style={{ height: 32, marginBottom: 16 }} />
                <div className="flex items-center gap-3">
                  <SkeletonBase width={52} height={22} style={{ borderRadius: 9999 }} />
                  <SkeletonText width={180} />
                </div>
              </div>

              {/* Context card skeleton */}
              <div className="mb-10">
                <SkeletonCard>
                  <div className="flex flex-col gap-3">
                    <SkeletonText width="90%" />
                    <SkeletonText width="80%" />
                    <SkeletonText width="60%" />
                  </div>
                </SkeletonCard>
              </div>

              {/* Historia timeline skeleton */}
              <SkeletonCard>
                <SkeletonText width="30%" style={{ marginBottom: 16 }} />
                <div className="flex gap-6">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-start gap-2 flex-1">
                      <SkeletonAvatar size={10} />
                      <div className="flex-1 flex flex-col gap-1.5">
                        <SkeletonText width="80%" />
                        <SkeletonText width="55%" />
                      </div>
                    </div>
                  ))}
                </div>
              </SkeletonCard>
            </div>
          )}
        </main>
      </div>
    </>
  )
}
