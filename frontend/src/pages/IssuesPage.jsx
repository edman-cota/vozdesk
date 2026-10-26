import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import {
  Bell, ChevronRight, Layers, ListFilter, Mic, PanelRight, Plus, SlidersHorizontal, Star, UserRound,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/context/WorkspaceContext'
import NewIssueDialog from '@/components/issues/NewIssueDialog'
import IssuesDashboard from '@/components/issues/IssuesDashboard'
import {
  PriorityIcon, STATUS_BY_ID, STATUSES, StatusIcon, TAB_STATUSES,
} from '@/components/issues/issue-meta'

const TABS = [
  { id: 'active', label: 'Active' },
  { id: 'backlog', label: 'Backlog' },
  { id: 'all', label: 'All issues' },
  { id: 'dashboard', label: 'Dashboard' },
]

const SELECT = '*, assignee:profiles!issues_assignee_id_fkey(id, full_name, avatar_url)'

const fmtDate = (d) =>
  new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

function IconButton({ label, children, onClick }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-white/10 hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  )
}

function StatusMenu({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={ref} className={cn('relative', open && 'z-50')} onClick={(e) => e.stopPropagation()}>
      <button type="button" aria-label="Cambiar estado" onClick={() => setOpen((o) => !o)} className="grid size-5 place-items-center rounded hover:bg-white/5">
        <StatusIcon status={value} />
      </button>
      {open && (
        <div className="absolute left-0 top-6 z-50 w-44 animate-fade-in rounded-lg border border-white/10 bg-popover p-1 shadow-2xl shadow-black/80">
          {STATUSES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => { onChange(s.id); setOpen(false) }}
              className={cn('flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] hover:bg-accent', s.id === value && 'bg-accent/60')}
            >
              <StatusIcon status={s.id} /> {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Avatar({ person }) {
  if (!person) {
    return <UserRound className="size-4 rounded-full border border-dashed border-muted-foreground/50 p-px text-muted-foreground/70" />
  }
  if (person.avatar_url) {
    return <img src={person.avatar_url} alt={person.full_name ?? ''} className="size-4 rounded-full object-cover" referrerPolicy="no-referrer" />
  }
  return (
    <span className="grid size-4 place-items-center rounded-full bg-emerald-600 text-[8px] font-semibold text-white">
      {(person.full_name ?? '?')[0].toUpperCase()}
    </span>
  )
}

function isOverdue(dueDate, status) {
  if (!dueDate || ['done', 'canceled'].includes(status)) return false
  return new Date(`${dueDate}T23:59:59`).getTime() < Date.now()
}

function IssueRow({ issue, teamKey, onStatusChange }) {
  const navigate = useNavigate()
  const overdue = isOverdue(issue.due_date, issue.status)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/team/${teamKey}/issue/${teamKey}-${issue.number}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(`/team/${teamKey}/issue/${teamKey}-${issue.number}`)
        }
      }}
      className="group flex h-11 cursor-default items-center gap-3 rounded-md pl-6 pr-5 transition-colors hover:bg-white/[0.035] focus:outline-none focus:bg-white/[0.035]"
    >
      <PriorityIcon priority={issue.priority} />
      <span className="w-14 shrink-0 text-[13px] tabular-nums text-muted-foreground">{teamKey}-{issue.number}</span>
      <StatusMenu value={issue.status} onChange={(s) => onStatusChange(issue.id, s)} />
      <span className={cn('min-w-0 flex-1 truncate text-[13px] font-medium text-foreground/90 group-hover:text-foreground', issue.status === 'canceled' && 'text-muted-foreground line-through')}>
        {issue.title}
      </span>
      {issue.source === 'voice' && (
        <span title="Creado por voz" className="flex items-center gap-1 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-1.5 py-0.5 text-[10px] font-medium text-fuchsia-300">
          <Mic className="size-2.5" /> voz
        </span>
      )}
      {issue.due_date && (
        <span className={cn('rounded-full border px-1.5 py-0.5 text-[11px]', overdue ? 'border-red-500/30 text-red-400' : 'border-white/10 text-muted-foreground')}>
          {fmtDate(issue.due_date)}
        </span>
      )}
      <Avatar person={issue.assignee} />
      <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">{fmtDate(issue.created_at)}</span>
    </div>
  )
}

function StatusGroup({ status, issues, teamKey, onAdd, onStatusChange }) {
  const [open, setOpen] = useState(true)
  const meta = STATUS_BY_ID[status]
  return (
    <section className="mx-2">
      <div className="sticky top-0 z-10 mt-2 flex h-9 items-center gap-2 rounded-md bg-white/[0.04] pl-2 pr-2 backdrop-blur">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex flex-1 items-center gap-2 text-left">
          <ChevronRight className={cn('size-3 text-muted-foreground transition-transform', open && 'rotate-90')} />
          <StatusIcon status={status} />
          <span className="text-[13px] font-medium">{meta.label}</span>
          <span className="text-[13px] text-muted-foreground">{issues.length}</span>
        </button>
        <button type="button" aria-label={`Nuevo issue en ${meta.label}`} onClick={() => onAdd(status)} className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-white/5 hover:text-foreground">
          <Plus className="size-3.5" />
        </button>
      </div>
      {open && (
        <div>
          {issues.map((i) => <IssueRow key={i.id} issue={i} teamKey={teamKey} onStatusChange={onStatusChange} />)}
        </div>
      )}
    </section>
  )
}

export default function IssuesPage() {
  const { teamKey, tab = 'active' } = useParams()
  const navigate = useNavigate()
  const { teams, workspace } = useWorkspace()
  const team = teams.find((t) => t.key === teamKey)

  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState({ open: false, status: 'backlog' })

  const load = useCallback(async () => {
    if (!team) return
    const { data } = await supabase.from('issues').select(SELECT).eq('team_id', team.id).order('number', { ascending: false })
    setIssues(data ?? [])
    setLoading(false)
  }, [team])

  useEffect(() => {
    if (!team) return
    let active = true
    supabase
      .from('issues')
      .select(SELECT)
      .eq('team_id', team.id)
      .order('number', { ascending: false })
      .then(({ data }) => {
        if (active) {
          setIssues(data ?? [])
          setLoading(false)
        }
      })

    // Realtime: refresca cuando cambie cualquier issue del team (p.ej. creado por voz)
    const channel = supabase
      .channel(`issues:${team.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issues', filter: `team_id=eq.${team.id}` }, load)
      .subscribe()
    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [team, load])

  const groups = useMemo(() => {
    if (tab === 'dashboard') return []
    const visible = TAB_STATUSES[tab] ?? TAB_STATUSES.active
    return visible
      .map((s) => ({ status: s, items: issues.filter((i) => i.status === s) }))
      .filter((g) => g.items.length > 0)
  }, [issues, tab])

  async function handleStatusChange(id, status) {
    setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)))
    const { error } = await supabase.from('issues').update({ status }).eq('id', id)
    if (error) load()
  }

  const openNew = (status) =>
    setDialog({ open: true, status: status ?? (tab === 'active' ? 'todo' : 'backlog') })

  if (!team) {
    return (
      <div className="grid flex-1 place-items-center text-muted-foreground">
        {teams.length ? 'Team no encontrado' : 'Cargando…'}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-white/[0.06] px-4">
        <div className="flex items-center gap-1.5 text-[13px]">
          <span className="grid size-4 place-items-center rounded bg-primary/20 text-[9px] font-bold text-primary">{team.key.slice(0, 2)}</span>
          <span className="text-muted-foreground">{team.name}</span>
          <ChevronRight className="size-3 text-muted-foreground" />
          <span className="font-medium">Issues</span>
          <button type="button" aria-label="Favorito" className="ml-1 grid size-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-yellow-400">
            <Star className="size-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <IconButton label="Notificaciones"><Bell className="size-3.5" /></IconButton>
          <button
            id="new-issue-button"
            type="button"
            onClick={() => openNew()}
            className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Plus className="size-3.5" /> New issue
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex h-11 shrink-0 items-center justify-between px-3">
        <div className="flex items-center gap-1">
          {TABS.map((t) => (
            <NavLink
              key={t.id}
              id={`tab-${t.id}`}
              to={`/team/${team.key}/issues/${t.id}`}
              className={() =>
                cn(
                  'flex h-7 items-center rounded-full border px-3 text-[13px] transition-colors',
                  tab === t.id
                    ? 'border-white/10 bg-white/[0.08] text-foreground'
                    : 'border-white/[0.06] text-muted-foreground hover:bg-white/[0.04] hover:text-foreground',
                )
              }
            >
              {t.label}
            </NavLink>
          ))}
          <IconButton label="Nueva vista" onClick={() => navigate('/views')}><Layers className="size-3.5" /></IconButton>
        </div>
        <div className="flex items-center gap-1">
          <IconButton label="Filtrar"><ListFilter className="size-3.5" /></IconButton>
          <IconButton label="Opciones de vista"><SlidersHorizontal className="size-3.5" /></IconButton>
          <IconButton label="Panel lateral"><PanelRight className="size-3.5" /></IconButton>
        </div>
      </div>

      {/* Contenido / Dashboard / Lista */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => <div key={i} className="h-9 animate-pulse rounded-md bg-white/[0.03]" />)}
          </div>
        ) : tab === 'dashboard' ? (
          <IssuesDashboard
            issues={issues}
            team={team}
          />
        ) : groups.length === 0 ? (
          <div className="grid h-full place-items-center">
            <div className="max-w-sm text-center animate-fade-in">
              <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl border border-white/10 bg-white/[0.03]">
                <Mic className="size-5 text-fuchsia-300" />
              </div>
              <p className="font-medium">No hay issues aquí</p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Crea uno manualmente o díctalo al Agent de {workspace?.name ?? 'VozDesk'}.
              </p>
              <button type="button" onClick={() => openNew()} className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-primary/90">
                <Plus className="size-3.5" /> New issue
              </button>
            </div>
          </div>
        ) : (
          groups.map((g) => (
            <StatusGroup
              key={g.status}
              status={g.status}
              issues={g.items}
              teamKey={team.key}
              onAdd={openNew}
              onStatusChange={handleStatusChange}
            />
          ))
        )}
      </div>

      <NewIssueDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        team={team}
        defaultStatus={dialog.status}
        onCreated={(issue) => setIssues((prev) => [issue, ...prev.filter((i) => i.id !== issue.id)])}
      />
    </div>
  )
}
