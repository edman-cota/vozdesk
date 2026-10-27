import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  pointerWithin,
  closestCorners,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Check,
  GitBranch,
  GripVertical,
  Link2,
  MoreHorizontal,
  Plus,
  Trash2,
  UserRound,
} from 'lucide-react'
import { STATUS_BY_ID, STATUSES, StatusIcon } from '@/components/issues/issue-meta'
import { PopoverDropdown } from '@/components/ui/popover-dropdown'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

function getInitialColumns(savedColumns) {
  const all = STATUSES.map((s) => s.id)
  if (!savedColumns || !Array.isArray(savedColumns) || savedColumns.length === 0) {
    return all
  }
  const merged = savedColumns.filter((id) => all.includes(id))
  all.forEach((id) => {
    if (!merged.includes(id)) merged.push(id)
  })
  return merged
}

function isOverdue(dueDate, status) {
  if (!dueDate || ['done', 'canceled'].includes(status)) return false
  return new Date(`${dueDate}T23:59:59`).getTime() < Date.now()
}

const fmtDate = (d) =>
  new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

function Avatar({ person }) {
  if (!person) {
    return <UserRound className="size-3.5 rounded-full border border-dashed border-muted-foreground/50 p-px text-muted-foreground/70" />
  }
  if (person.avatar_url) {
    return <img src={person.avatar_url} alt={person.full_name ?? ''} className="size-3.5 rounded-full object-cover" referrerPolicy="no-referrer" />
  }
  return (
    <span className="grid size-3.5 place-items-center rounded-full bg-emerald-600 text-[7px] font-semibold text-white">
      {(person.full_name ?? '?')[0].toUpperCase()}
    </span>
  )
}


function CardOptionsDropdown({ issue, teamKey, onDelete }) {
  const [open, setOpen] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedBranch, setCopiedBranch] = useState(false)

  function copyIssueUrl(e) {
    e.stopPropagation()
    const url = `${window.location.origin}/team/${teamKey}/issue/${teamKey}-${issue.number}`
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    setTimeout(() => {
      setCopiedLink(false)
      setOpen(false)
    }, 1200)
  }

  function copyBranchName(e) {
    e.stopPropagation()
    const slug = (issue?.title || 'task')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40)
    const branch = `${teamKey?.toLowerCase()}-${issue?.number}-${slug}`
    navigator.clipboard.writeText(branch)
    setCopiedBranch(true)
    setTimeout(() => {
      setCopiedBranch(false)
      setOpen(false)
    }, 1200)
  }

  async function handleDelete(e) {
    e.stopPropagation()
    setOpen(false)
    const confirmed = window.confirm('¿Seguro que deseas eliminar este issue?')
    if (!confirmed) return
    onDelete?.(issue.id)
  }

  return (
    <PopoverDropdown
      open={open}
      onOpenChange={setOpen}
      align="right"
      trigger={
        <button
          type="button"
          aria-label="Más opciones"
          className="grid size-6 place-items-center rounded text-muted-foreground opacity-80 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-white/10 hover:text-foreground transition-all"
        >
          <MoreHorizontal className="size-3.5" />
        </button>
      }
    >
      <button
        type="button"
        onClick={copyIssueUrl}
        className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-[12px] text-foreground/90 hover:bg-accent hover:text-foreground transition-colors"
      >
        {copiedLink ? <Check className="size-3.5 text-emerald-400" /> : <Link2 className="size-3.5 text-muted-foreground" />}
        {copiedLink ? '¡Copiado!' : 'Copiar enlace'}
      </button>
      <button
        type="button"
        onClick={copyBranchName}
        className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-[12px] text-foreground/90 hover:bg-accent hover:text-foreground transition-colors"
      >
        {copiedBranch ? <Check className="size-3.5 text-emerald-400" /> : <GitBranch className="size-3.5 text-muted-foreground" />}
        {copiedBranch ? '¡Copiado!' : 'Copiar nombre de branch'}
      </button>
      <div className="my-1 h-px bg-white/[0.06]" />
      <button
        type="button"
        onClick={handleDelete}
        className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-[12px] text-destructive hover:bg-destructive/15 transition-colors"
      >
        <Trash2 className="size-3.5" />
        Eliminar issue
      </button>
    </PopoverDropdown>
  )
}

function KanbanCardView({ issue, teamKey, isOverlay = false, onDeleteIssue }) {
  const overdue = isOverdue(issue.due_date, issue.status)

  return (
    <div
      className={cn(
        'group relative flex flex-col gap-2 rounded-lg border border-subtle bg-card p-3 text-left transition-colors select-none',
        isOverlay
          ? 'shadow-2xl shadow-black/90 rotate-[1.5deg] scale-[1.02] border-foreground/20 cursor-grabbing bg-card/95 backdrop-blur-md'
          : 'hover:border-foreground/20 hover:bg-white/[0.03] cursor-pointer'
      )}
    >
      {/* Top row: Status, ID & Options */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <StatusIcon status={issue.status} />
          <span className="tabular-nums text-muted-foreground font-mono text-[11px]">
            {teamKey}-{issue.number}
          </span>
        </div>
        <CardOptionsDropdown issue={issue} teamKey={teamKey} onDelete={onDeleteIssue} />
      </div>

      {/* Title */}
      <p className={cn(
        'text-[13px] font-medium leading-snug line-clamp-2 text-foreground/90 group-hover:text-foreground',
        issue.status === 'canceled' && 'line-through text-muted-foreground'
      )}>
        {issue.title}
      </p>

      {/* Footer: Date & Assignee */}
      <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          {issue.due_date && (
            <span className={cn(
              'rounded border px-1.5 py-0.5 text-[10px] font-medium',
              overdue ? 'border-red-500/30 text-red-400 bg-red-500/10' : 'border-subtle text-muted-foreground'
            )}>
              {fmtDate(issue.due_date)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Avatar person={issue.assignee} />
        </div>
      </div>
    </div>
  )
}

function SortableIssueCard({ issue, teamKey, onNavigate, activeItem, onDeleteIssue }) {
  const isDraggingIssue = activeItem?.type === 'issue' && activeItem.issue?.id === issue.id

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
    disabled: activeItem?.type === 'column',
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? undefined : transition,
  }

  // Origin placeholder: exactly where it comes from
  if (isDragging || isDraggingIssue) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="flex h-20 w-full flex-col justify-between rounded-lg border border-dashed border-subtle bg-white/[0.015] p-3 opacity-40 select-none"
      >
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
          <StatusIcon status={issue.status} />
          <span className="font-mono text-[11px]">{teamKey}-{issue.number}</span>
        </div>
        <p className="line-clamp-1 text-xs text-muted-foreground/60">{issue.title}</p>
        <span className="text-[10px] text-muted-foreground/40">Dragging from here</span>
      </div>
    )
  }

  const showDropIndicator = isOver && activeItem?.type === 'issue' && activeItem.issue?.id !== issue.id

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onNavigate(issue)}
      className="relative select-none"
    >
      {/* Drop target indicator line: where it will be dropped */}
      {showDropIndicator && (
        <div className="pointer-events-none absolute -top-1.5 left-0 right-0 z-20 flex items-center">
          <div className="size-2 rounded-full bg-foreground shadow-sm shadow-black" />
          <div className="h-0.5 flex-1 rounded-full bg-foreground shadow-sm shadow-black" />
        </div>
      )}
      <KanbanCardView
        issue={issue}
        teamKey={teamKey}
        onDeleteIssue={onDeleteIssue}
      />
    </div>
  )
}

function KanbanColumn({
  columnId,
  issues,
  teamKey,
  onNavigate,
  onAddIssue,
  isOverColumn,
  activeItem,
  onDeleteIssue,
}) {
  const isDraggingColumn = activeItem?.type === 'column' && activeItem.columnId === columnId

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: columnId,
    data: {
      type: 'column',
      columnId,
    },
    disabled: activeItem?.type === 'issue',
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? undefined : transition,
  }

  const meta = STATUS_BY_ID[columnId] || { label: columnId, color: '#888' }
  const issueIds = useMemo(() => issues.map((i) => i.id), [issues])

  if (isDragging || isDraggingColumn) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="flex h-full min-h-[400px] sm:min-h-[500px] w-[84vw] max-w-[320px] sm:w-72 shrink-0 snap-center flex-col rounded-xl border border-dashed border-subtle bg-white/[0.01] opacity-40"
      />
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex h-full min-h-[400px] sm:min-h-[500px] w-[84vw] max-w-[320px] sm:w-72 shrink-0 snap-center flex-col rounded-xl border transition-colors',
        isOverColumn ? 'border-foreground/30 bg-white/[0.03]' : 'border-subtle bg-white/[0.015]'
      )}
    >
      {/* Column Header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-subtle px-3">
        <div className="flex items-center gap-2">
          {/* Column Drag Handle */}
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab text-muted-foreground/50 hover:text-foreground active:cursor-grabbing"
            title="Drag column to reorder"
          >
            <GripVertical className="size-3.5" />
          </button>
          <StatusIcon status={columnId} />
          <span className="text-[13px] font-semibold text-foreground">{meta.label}</span>
          <span className="grid size-4 place-items-center rounded-full bg-white/[0.05] text-[10px] font-medium text-muted-foreground">
            {issues.length}
          </span>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onAddIssue(columnId)}
            className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-white/5 hover:text-foreground"
            title={`Add issue to ${meta.label}`}
          >
            <Plus className="size-3.5" />
          </button>
          <button
            type="button"
            className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-white/5 hover:text-foreground"
            title="Column options"
          >
            <MoreHorizontal className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Cards Scroll Container */}
      <div className="flex-1 space-y-2.5 overflow-y-auto p-2.5">
        <SortableContext items={issueIds} strategy={verticalListSortingStrategy}>
          {issues.map((issue) => (
            <SortableIssueCard
              key={issue.id}
              issue={issue}
              teamKey={teamKey}
              onNavigate={onNavigate}
              activeItem={activeItem}
              onDeleteIssue={onDeleteIssue}
            />
          ))}
        </SortableContext>

        {/* Empty Column Drop Target Placeholder */}
        {issues.length === 0 && (
          <div className={cn(
            'grid h-24 place-items-center rounded-lg border border-dashed text-xs transition-colors',
            isOverColumn
              ? 'border-foreground/30 bg-foreground/[0.03] text-foreground font-medium'
              : 'border-subtle text-muted-foreground/60'
          )}>
            {isOverColumn ? `Drop task in ${meta.label}` : 'Drop task here'}
          </div>
        )}

        {/* Column Drop Indicator at bottom when column has issues */}
        {issues.length > 0 && isOverColumn && (
          <div className="flex h-9 items-center justify-center rounded-lg border border-dashed border-foreground/20 bg-foreground/[0.02] text-[11px] text-muted-foreground">
            Drop into {meta.label}
          </div>
        )}
      </div>

      {/* Column Footer: Quick Add button */}
      <div className="border-t border-subtle p-2">
        <button
          type="button"
          onClick={() => onAddIssue(columnId)}
          className="flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-white/[0.04] hover:text-foreground transition-colors"
        >
          <Plus className="size-3.5" /> Add issue
        </button>
      </div>
    </div>
  )
}

function findColumnForId(id, issuesList, columnIds) {
  if (!id) return null
  if (columnIds.includes(id)) return id
  const item = issuesList.find((i) => i.id === id)
  return item ? item.status : null
}

export default function IssuesKanban({ issues = [], team, onStatusChange, onOpenNew, onDeleteIssue }) {
  const navigate = useNavigate()
  const location = useLocation()

  // Columns order state (allow rearranging columns left and right)
  const [columns, setColumns] = useState(() =>
    getInitialColumns(team?.status_order)
  )

  const [localIssues, setLocalIssues] = useState(issues)
  const [activeItem, setActiveItem] = useState(null)
  const [overColumnId, setOverColumnId] = useState(null)

  // Sync columns if team's saved status order changes or switches team
  useEffect(() => {
    if (team?.status_order) {
      setColumns(getInitialColumns(team.status_order))
    }
  }, [team?.id, team?.status_order])

  // Sync props issues when not dragging
  useEffect(() => {
    if (!activeItem) {
      setLocalIssues(issues)
    }
  }, [issues, activeItem])

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 3, // fast, instant 3px grab
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Map issues by status
  const issuesByColumn = useMemo(() => {
    const map = {}
    columns.forEach((colId) => {
      map[colId] = []
    })
    localIssues.forEach((issue) => {
      if (map[issue.status]) {
        map[issue.status].push(issue)
      } else if (map.backlog) {
        map.backlog.push(issue)
      }
    })
    return map
  }, [localIssues, columns])

  // Fast collision: checks pointer coordinates first (0ms), fallback to corners
  const collisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args)
    if (pointerCollisions.length > 0) {
      return pointerCollisions
    }
    return closestCorners(args)
  }

  function handleDragStart(event) {
    const { active } = event
    const activeData = active.data.current
    setActiveItem(activeData)
    if (activeData?.type === 'issue') {
      setOverColumnId(activeData.issue.status)
    }
  }

  function handleDragOver(event) {
    const { over } = event
    if (!over) {
      if (overColumnId) setOverColumnId(null)
      return
    }

    const activeData = activeItem
    if (activeData?.type !== 'issue') return

    const targetColumn = findColumnForId(over.id, localIssues, columns)
    if (targetColumn && targetColumn !== overColumnId) {
      setOverColumnId(targetColumn)
    }
  }

  function handleDragEnd(event) {
    const { active, over } = event
    const activeData = active.data.current
    const overData = over?.data.current

    setActiveItem(null)
    setOverColumnId(null)

    if (!over) return

    // 1. Column reordering
    if (activeData?.type === 'column') {
      const targetCol = overData?.type === 'column'
        ? over.id
        : findColumnForId(over.id, localIssues, columns)

      if (targetCol && active.id !== targetCol) {
        const oldIndex = columns.indexOf(active.id)
        const newIndex = columns.indexOf(targetCol)
        if (oldIndex !== -1 && newIndex !== -1) {
          const newOrder = arrayMove(columns, oldIndex, newIndex)
          setColumns(newOrder)

          // Persist column order to database asynchronously (fire-and-forget, zero lag)
          if (team?.id) {
            supabase
              .from('teams')
              .update({ status_order: newOrder })
              .eq('id', team.id)
              .then(({ error }) => {
                if (error) console.error('Error saving column order:', error)
              })
          }
        }
      }
      return
    }

    // 2. Issue dropped
    if (activeData?.type === 'issue') {
      const activeId = active.id
      const activeIssue = activeData.issue

      let targetStatus = null
      let targetIssueId = null

      if (overData?.type === 'column') {
        targetStatus = over.id
      } else if (overData?.type === 'issue') {
        targetStatus = overData.issue.status
        targetIssueId = over.id
      } else {
        targetStatus = findColumnForId(over.id, localIssues, columns)
      }

      if (!targetStatus) return

      let calculatedSortOrder = activeIssue.sort_order ?? 0

      // Update local issues order and status cleanly
      setLocalIssues((prev) => {
        const activeIdx = prev.findIndex((i) => i.id === activeId)
        if (activeIdx === -1) return prev

        const next = [...prev]
        const currentItem = next.splice(activeIdx, 1)[0]

        if (targetIssueId && targetIssueId !== activeId) {
          const targetIdx = next.findIndex((i) => i.id === targetIssueId)
          if (targetIdx !== -1) {
            next.splice(targetIdx, 0, { ...currentItem, status: targetStatus })
          } else {
            next.push({ ...currentItem, status: targetStatus })
          }
        } else {
          // Put at end of target column
          let insertIdx = next.length
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].status === targetStatus) {
              insertIdx = i + 1
              break
            }
          }
          next.splice(insertIdx, 0, { ...currentItem, status: targetStatus })
        }

        // Calculate fractional sort_order based on position within targetStatus
        const colIssues = next.filter((i) => i.status === targetStatus)
        const colIdx = colIssues.findIndex((i) => i.id === activeId)

        if (colIssues.length === 1) {
          calculatedSortOrder = 1000
        } else if (colIdx === 0) {
          const nextIssue = colIssues[1]
          calculatedSortOrder = (nextIssue.sort_order ?? 1000) - 1000
        } else if (colIdx === colIssues.length - 1) {
          const prevIssue = colIssues[colIssues.length - 2]
          calculatedSortOrder = (prevIssue.sort_order ?? 0) + 1000
        } else {
          const prevIssue = colIssues[colIdx - 1]
          const nextIssue = colIssues[colIdx + 1]
          const prevSort = prevIssue.sort_order ?? 0
          const nextSort = nextIssue.sort_order ?? (prevSort + 2000)
          calculatedSortOrder = (prevSort + nextSort) / 2
          if (calculatedSortOrder === prevSort) {
            calculatedSortOrder = prevSort + 0.5
          }
        }

        const finalActiveIdx = next.findIndex((i) => i.id === activeId)
        if (finalActiveIdx !== -1) {
          next[finalActiveIdx] = {
            ...next[finalActiveIdx],
            sort_order: calculatedSortOrder,
          }
        }

        return next
      })

      // Commit to parent & Supabase once on drop (updates status and sort_order in database)
      onStatusChange(activeId, targetStatus, calculatedSortOrder)
    }
  }

  function handleDragCancel() {
    setActiveItem(null)
    setOverColumnId(null)
    setLocalIssues(issues)
  }

  const handleCardClick = (issue) => {
    navigate(`/team/${team?.key}/issue/${team?.key}-${issue.number}`, {
      state: { from: location.pathname },
    })
  }

  async function handleDeleteIssue(id) {
    setLocalIssues((prev) => prev.filter((i) => i.id !== id))
    onDeleteIssue?.(id)
    await supabase.from('issues').delete().eq('id', id)
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex flex-1 items-start gap-3 sm:gap-4 overflow-x-auto p-3 sm:p-4 md:p-6 snap-x snap-mandatory scroll-smooth">
          <SortableContext items={columns} strategy={horizontalListSortingStrategy}>
            {columns.map((columnId) => (
              <KanbanColumn
                key={columnId}
                columnId={columnId}
                issues={issuesByColumn[columnId] || []}
                teamKey={team?.key}
                onNavigate={handleCardClick}
                onAddIssue={onOpenNew}
                isOverColumn={overColumnId === columnId}
                activeItem={activeItem}
                onDeleteIssue={handleDeleteIssue}
              />
            ))}
          </SortableContext>
        </div>

        {/* Drag Overlay: GPU-accelerated smooth floating card */}
        <DragOverlay dropAnimation={null}>
          {activeItem?.type === 'issue' && (
            <KanbanCardView issue={activeItem.issue} teamKey={team?.key} isOverlay />
          )}
          {activeItem?.type === 'column' && (
            <div className="flex h-80 w-72 flex-col rounded-xl border border-subtle bg-background/95 p-3 shadow-2xl shadow-black/80">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <StatusIcon status={activeItem.columnId} />
                {STATUS_BY_ID[activeItem.columnId]?.label}
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
