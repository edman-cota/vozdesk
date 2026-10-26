import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import {
  Bell, ChevronRight, GripVertical, Layers, ListFilter, Mic, PanelRight, Plus, SlidersHorizontal, Star, UserRound,
} from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/context/WorkspaceContext'
import NewIssueDialog from '@/components/issues/NewIssueDialog'
import IssuesDashboard from '@/components/issues/IssuesDashboard'
import IssuesKanban from '@/components/issues/IssuesKanban'
import {
  PriorityIcon, STATUS_BY_ID, STATUSES, StatusIcon, TAB_STATUSES,
} from '@/components/issues/issue-meta'

const TABS = [
  { id: 'active', label: 'Active' },
  { id: 'backlog', label: 'Backlog' },
  { id: 'all', label: 'All issues' },
  { id: 'kanban', label: 'Kanban' },
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
      className="grid size-7 place-items-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-subtle hover:bg-accent hover:text-foreground"
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
        <div className="absolute left-0 top-6 z-50 w-44 animate-fade-in rounded-lg border border-subtle bg-popover p-1 shadow-2xl shadow-black/80">
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

function IssueRow({ issue, teamKey, onStatusChange, dragHandleProps }) {
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
      className="group flex h-11 cursor-default items-center gap-2 rounded-md pl-2 pr-5 transition-colors hover:bg-white/[0.035] focus:outline-none focus:bg-white/[0.035]"
    >
      <button
        type="button"
        {...dragHandleProps}
        onClick={(e) => e.stopPropagation()}
        className="grid size-6 place-items-center rounded text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity cursor-grab active:cursor-grabbing"
        title="Drag to reorder"
      >
        <GripVertical className="size-3.5" />
      </button>
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
        <span className={cn('rounded-full border px-1.5 py-0.5 text-[11px]', overdue ? 'border-red-500/30 text-red-400' : 'border-subtle text-muted-foreground')}>
          {fmtDate(issue.due_date)}
        </span>
      )}
      <Avatar person={issue.assignee} />
      <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">{fmtDate(issue.created_at)}</span>
    </div>
  )
}

function SortableIssueRow({ issue, teamKey, onStatusChange, activeDragId }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: issue.id,
    data: {
      type: 'issue',
      issue,
    },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? undefined : transition,
  }

  const showDropIndicator = isOver && activeDragId && activeDragId !== issue.id

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="flex h-11 items-center rounded-md border border-dashed border-subtle bg-white/[0.015] px-6 text-xs text-muted-foreground/60 opacity-40 select-none"
      >
        <span>Dragging {teamKey}-{issue.number}</span>
      </div>
    )
  }

  return (
    <div ref={setNodeRef} style={style} className="relative select-none">
      {showDropIndicator && (
        <div className="pointer-events-none absolute -top-1 left-4 right-4 z-20 flex items-center">
          <div className="size-2 rounded-full bg-foreground shadow-sm shadow-black" />
          <div className="h-0.5 flex-1 rounded-full bg-foreground shadow-sm shadow-black" />
        </div>
      )}
      <IssueRow
        issue={issue}
        teamKey={teamKey}
        onStatusChange={onStatusChange}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  )
}

function StatusGroup({ status, issues, teamKey, onAdd, onStatusChange, activeDragId }) {
  const [open, setOpen] = useState(true)
  const meta = STATUS_BY_ID[status]
  const issueIds = useMemo(() => issues.map((i) => i.id), [issues])

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
        <SortableContext items={issueIds} strategy={verticalListSortingStrategy}>
          <div>
            {issues.map((i) => (
              <SortableIssueRow
                key={i.id}
                issue={i}
                teamKey={teamKey}
                onStatusChange={onStatusChange}
                activeDragId={activeDragId}
              />
            ))}
          </div>
        </SortableContext>
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
    const { data } = await supabase
      .from('issues')
      .select(SELECT)
      .eq('team_id', team.id)
      .order('sort_order', { ascending: true })
      .order('number', { ascending: false })
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
      .order('sort_order', { ascending: true })
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

  const [activeListDragItem, setActiveListDragItem] = useState(null)

  const listSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 3 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const groups = useMemo(() => {
    if (tab === 'dashboard' || tab === 'kanban') return []
    const visible = TAB_STATUSES[tab] ?? TAB_STATUSES.active
    const savedOrder = team?.status_order
    const orderedStatuses = savedOrder && Array.isArray(savedOrder) && savedOrder.length > 0
      ? [...savedOrder.filter((s) => visible.includes(s)), ...visible.filter((s) => !savedOrder.includes(s))]
      : visible

    return orderedStatuses
      .map((s) => ({ status: s, items: issues.filter((i) => i.status === s) }))
      .filter((g) => g.items.length > 0)
  }, [issues, tab, team?.status_order])

  function handleListDragStart(event) {
    setActiveListDragItem(event.active.data.current)
  }

  function handleListDragEnd(event) {
    const { active, over } = event
    setActiveListDragItem(null)
    if (!over) return

    const activeId = active.id
    const activeData = active.data.current
    const overData = over.data.current
    if (activeData?.type !== 'issue') return

    const activeIssue = activeData.issue
    let targetStatus = null
    let targetIssueId = null

    if (overData?.type === 'issue') {
      targetStatus = overData.issue.status
      targetIssueId = over.id
    } else {
      const found = issues.find((i) => i.id === over.id)
      if (found) {
        targetStatus = found.status
        targetIssueId = found.id
      }
    }

    if (!targetStatus) return

    const colIssues = issues.filter((i) => i.status === targetStatus && i.id !== activeId)
    let insertIdx = colIssues.length
    if (targetIssueId && targetIssueId !== activeId) {
      const idx = colIssues.findIndex((i) => i.id === targetIssueId)
      if (idx !== -1) insertIdx = idx
    }

    const updatedCol = [...colIssues]
    updatedCol.splice(insertIdx, 0, { ...activeIssue, status: targetStatus })

    let calculatedSortOrder = 1000
    if (updatedCol.length === 1) {
      calculatedSortOrder = 1000
    } else if (insertIdx === 0) {
      const nextIssue = updatedCol[1]
      calculatedSortOrder = (nextIssue.sort_order ?? 1000) - 1000
    } else if (insertIdx === updatedCol.length - 1) {
      const prevIssue = updatedCol[updatedCol.length - 2]
      calculatedSortOrder = (prevIssue.sort_order ?? 0) + 1000
    } else {
      const prevIssue = updatedCol[insertIdx - 1]
      const nextIssue = updatedCol[insertIdx + 1]
      const prevSort = prevIssue.sort_order ?? 0
      const nextSort = nextIssue.sort_order ?? (prevSort + 2000)
      calculatedSortOrder = (prevSort + nextSort) / 2
      if (calculatedSortOrder === prevSort) calculatedSortOrder = prevSort + 0.5
    }

    handleStatusChange(activeId, targetStatus, calculatedSortOrder)
  }

  async function handleStatusChange(id, status, sortOrder) {
    const updates = {}
    if (status !== undefined) updates.status = status
    if (sortOrder !== undefined) updates.sort_order = sortOrder

    setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)))
    const { error } = await supabase.from('issues').update(updates).eq('id', id)
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
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-subtle px-4">
        <div className="flex items-center gap-1.5 text-[13px]">
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
                    ? 'border-subtle bg-white/[0.06] text-foreground'
                    : 'border-subtle text-muted-foreground hover:bg-white/[0.03] hover:text-foreground',
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

      {/* Contenido / Kanban / Dashboard / Lista */}
      <div className={cn('min-h-0 flex-1', tab === 'kanban' ? 'flex overflow-hidden' : 'overflow-y-auto pb-6')}>
        {loading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => <div key={i} className="h-9 animate-pulse rounded-md bg-white/[0.03]" />)}
          </div>
        ) : tab === 'kanban' ? (
          <IssuesKanban
            issues={issues}
            team={team}
            onStatusChange={handleStatusChange}
            onOpenNew={openNew}
          />
        ) : tab === 'dashboard' ? (
          <IssuesDashboard
            issues={issues}
            team={team}
          />
        ) : groups.length === 0 ? (
          <div className="grid h-full place-items-center">
            <div className="max-w-sm text-center animate-fade-in">
              <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl border border-subtle bg-white/[0.03]">
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
          <DndContext
            sensors={listSensors}
            collisionDetection={closestCorners}
            onDragStart={handleListDragStart}
            onDragEnd={handleListDragEnd}
            onDragCancel={() => setActiveListDragItem(null)}
          >
            {groups.map((g) => (
              <StatusGroup
                key={g.status}
                status={g.status}
                issues={g.items}
                teamKey={team.key}
                onAdd={openNew}
                onStatusChange={handleStatusChange}
                activeDragId={activeListDragItem?.issue?.id}
              />
            ))}
            <DragOverlay dropAnimation={null}>
              {activeListDragItem?.type === 'issue' && (
                <div className="rounded-md border border-foreground/20 bg-card p-1 shadow-2xl shadow-black/90">
                  <IssueRow
                    issue={activeListDragItem.issue}
                    teamKey={team.key}
                    onStatusChange={() => {}}
                  />
                </div>
              )}
            </DragOverlay>
          </DndContext>
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
