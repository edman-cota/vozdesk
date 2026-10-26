import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowUp,
  Bell,
  Check,
  ChevronRight,
  Folder,
  GitBranch,
  Link2,
  ListTree,
  Mic,
  MoreHorizontal,
  Paperclip,
  Plus,
  SlidersHorizontal,
  Star,
  Tag,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { useWorkspace } from '@/context/WorkspaceContext'
import {
  PRIORITIES,
  PriorityIcon,
  STATUS_BY_ID,
  STATUSES,
  StatusIcon,
} from '@/components/issues/issue-meta'

const DEFAULT_LABELS = [
  { id: 'feature', name: 'Feature', color: '#8b5cf6' },
  { id: 'bug', name: 'Bug', color: '#ef4444' },
  { id: 'improvement', name: 'Improvement', color: '#3b82f6' },
  { id: 'voice', name: 'Voice Agent', color: '#d946ef' },
  { id: 'docs', name: 'Documentation', color: '#10b981' },
]

function timeAgo(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

function Avatar({ person, size = 'sm' }) {
  const sizeClasses = size === 'sm' ? 'size-4 text-[8px]' : 'size-5 text-[9px]'
  if (!person) {
    return (
      <UserRound
        className={cn(
          sizeClasses,
          'rounded-full border border-dashed border-muted-foreground/50 p-px text-muted-foreground/70',
        )}
      />
    )
  }
  if (person.avatar_url) {
    return (
      <img
        src={person.avatar_url}
        alt={person.full_name ?? ''}
        className={cn(sizeClasses, 'rounded-full object-cover')}
        referrerPolicy="no-referrer"
      />
    )
  }
  const initial = (person.full_name || person.email || '?')[0].toUpperCase()
  return (
    <span
      className={cn(
        sizeClasses,
        'grid place-items-center rounded-full bg-emerald-600 font-semibold text-white shrink-0',
      )}
    >
      {initial}
    </span>
  )
}

function PopoverDropdown({ trigger, children, open, onOpenChange, align = 'left', className }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const handleClick = (e) => !ref.current?.contains(e.target) && onOpenChange(false)
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, onOpenChange])

  return (
    <div ref={ref} className="relative">
      <div onClick={() => onOpenChange(!open)}>{trigger}</div>
      {open && (
        <div
          className={cn(
            'absolute top-full z-50 mt-1 min-w-[180px] animate-fade-in rounded-lg border border-subtle bg-popover p-1 shadow-2xl shadow-black/70 backdrop-blur-md',
            align === 'right' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export default function IssueDetailPage() {
  const { teamKey: urlTeamKey, issueIdentifier } = useParams()
  const navigate = useNavigate()
  const { teams } = useWorkspace()
  const { user } = useAuth()

  // Parse identifier (e.g. "WUD-7", "7", or UUID)
  const match = issueIdentifier?.match(/^([A-Za-z0-9]+)-(\d+)$/)
  const parsedTeamKey = match ? match[1].toUpperCase() : urlTeamKey
  const parsedNumber = match
    ? parseInt(match[2], 10)
    : !isNaN(parseInt(issueIdentifier, 10)) && String(parseInt(issueIdentifier, 10)) === issueIdentifier
      ? parseInt(issueIdentifier, 10)
      : null
  const parsedId = !match && !parsedNumber ? issueIdentifier : null

  const [issue, setIssue] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Editable fields
  const [title, setTitle] = useState('')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [description, setDescription] = useState('')
  const [isEditingDesc, setIsEditingDesc] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [comments, setComments] = useState([])
  const [subIssues, setSubIssues] = useState([])
  const [newSubIssueTitle, setNewSubIssueTitle] = useState('')
  const [addingSubIssue, setAddingSubIssue] = useState(false)
  const [selectedLabels, setSelectedLabels] = useState([])
  const [isSubscribed, setIsSubscribed] = useState(true)
  const [isFavorite, setIsFavorite] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  // Team members & Projects
  const [teamMembers, setTeamMembers] = useState([])
  const [projects, setProjects] = useState([])

  // Dropdown states
  const [statusOpen, setStatusOpen] = useState(false)
  const [priorityOpen, setPriorityOpen] = useState(false)
  const [assigneeOpen, setAssigneeOpen] = useState(false)
  const [projectOpen, setProjectOpen] = useState(false)
  const [labelsOpen, setLabelsOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const activeTeam = useMemo(() => {
    if (issue?.team) return issue.team
    const key = parsedTeamKey || urlTeamKey
    return teams.find((t) => t.key.toUpperCase() === key?.toUpperCase()) || null
  }, [issue, parsedTeamKey, urlTeamKey, teams])

  // Load persistent metadata from localStorage (sub-issues, comments, labels)
  const loadStoredMeta = useCallback((issueId) => {
    try {
      const raw = localStorage.getItem(`vozdesk:issue:${issueId}`)
      if (raw) {
        const parsedData = JSON.parse(raw)
        if (Array.isArray(parsedData.comments)) setComments(parsedData.comments)
        if (Array.isArray(parsedData.subIssues)) setSubIssues(parsedData.subIssues)
        if (Array.isArray(parsedData.labels)) setSelectedLabels(parsedData.labels)
        if (typeof parsedData.isSubscribed === 'boolean') setIsSubscribed(parsedData.isSubscribed)
        if (typeof parsedData.isFavorite === 'boolean') setIsFavorite(parsedData.isFavorite)
      }
    } catch {
      // ignore
    }
  }, [])

  const saveStoredMeta = useCallback((issueId, updates) => {
    try {
      const key = `vozdesk:issue:${issueId}`
      const prev = JSON.parse(localStorage.getItem(key) || '{}')
      localStorage.setItem(key, JSON.stringify({ ...prev, ...updates }))
    } catch {
      // ignore
    }
  }, [])

  const [reloadTick, setReloadTick] = useState(0)

  // Fetch issue
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        setLoading(true)
        setError(null)

        let query = supabase.from('issues').select(`
          *,
          assignee:profiles!issues_assignee_id_fkey(id, full_name, avatar_url, email),
          creator:profiles!issues_creator_id_fkey(id, full_name, avatar_url, email),
          project:projects(id, name),
          team:teams(id, name, key)
        `)

        if (parsedId) {
          query = query.eq('id', parsedId)
        } else if (parsedNumber) {
          const targetTeam = teams.find(
            (t) => t.key.toUpperCase() === (parsedTeamKey || urlTeamKey)?.toUpperCase(),
          )
          if (targetTeam) {
            query = query.eq('team_id', targetTeam.id).eq('number', parsedNumber)
          } else {
            const { data: teamData } = await supabase
              .from('teams')
              .select('id')
              .eq('key', parsedTeamKey || urlTeamKey)
              .maybeSingle()
            if (!teamData) throw new Error('Equipo no encontrado')
            query = query.eq('team_id', teamData.id).eq('number', parsedNumber)
          }
        }

        const { data, error: fetchErr } = await query.single()
        if (cancelled) return
        if (fetchErr) throw fetchErr
        if (!data) throw new Error('Issue no encontrado')

        setIssue(data)
        setTitle(data.title || '')
        setDescription(data.description || '')
        loadStoredMeta(data.id)

        if (data.team_id) {
          supabase
            .from('team_members')
            .select('user_id, role, profile:profiles(id, full_name, avatar_url, email)')
            .eq('team_id', data.team_id)
            .then(({ data: tm }) => {
              if (!cancelled && tm) setTeamMembers(tm.map((m) => m.profile).filter(Boolean))
            })

          supabase
            .from('projects')
            .select('id, name')
            .eq('team_id', data.team_id)
            .then(({ data: prjs }) => {
              if (!cancelled && prjs) setProjects(prjs)
            })
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Error al cargar el issue')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [parsedId, parsedNumber, parsedTeamKey, urlTeamKey, teams, loadStoredMeta, reloadTick])

  // Realtime subscription for issue changes
  useEffect(() => {
    if (!issue?.id) return
    const channel = supabase
      .channel(`issue:${issue.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'issues', filter: `id=eq.${issue.id}` },
        (payload) => {
          setIssue((prev) => (prev ? { ...prev, ...payload.new } : prev))
          if (payload.new.title) setTitle(payload.new.title)
          if (payload.new.description !== undefined) setDescription(payload.new.description || '')
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [issue?.id])

  // Update handlers
  async function updateIssueField(field, value) {
    if (!issue) return
    setIssue((prev) => ({ ...prev, [field]: value }))
    const { error: err } = await supabase.from('issues').update({ [field]: value }).eq('id', issue.id)
    if (err) {
      console.error(`Error updating ${field}:`, err)
      setReloadTick((t) => t + 1)
    }
  }

  async function handleTitleSave() {
    setIsEditingTitle(false)
    if (!title.trim() || title === issue?.title) return
    await updateIssueField('title', title.trim())
  }

  async function handleDescSave() {
    setIsEditingDesc(false)
    if (description === issue?.description) return
    await updateIssueField('description', description.trim() || null)
  }

  function handleAddComment(e) {
    e?.preventDefault()
    if (!newComment.trim() || !issue) return
    const commentObj = {
      id: crypto.randomUUID(),
      content: newComment.trim(),
      created_at: new Date().toISOString(),
      author: {
        id: user?.id,
        full_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Tú',
        avatar_url: user?.user_metadata?.avatar_url,
      },
    }
    const updated = [...comments, commentObj]
    setComments(updated)
    saveStoredMeta(issue.id, { comments: updated })
    setNewComment('')
  }

  function handleAddSubIssue(e) {
    e?.preventDefault()
    if (!newSubIssueTitle.trim() || !issue) return
    const subObj = {
      id: crypto.randomUUID(),
      title: newSubIssueTitle.trim(),
      completed: false,
      created_at: new Date().toISOString(),
    }
    const updated = [...subIssues, subObj]
    setSubIssues(updated)
    saveStoredMeta(issue.id, { subIssues: updated })
    setNewSubIssueTitle('')
    setAddingSubIssue(false)
  }

  function toggleSubIssue(subId) {
    if (!issue) return
    const updated = subIssues.map((s) => (s.id === subId ? { ...s, completed: !s.completed } : s))
    setSubIssues(updated)
    saveStoredMeta(issue.id, { subIssues: updated })
  }

  function removeSubIssue(subId) {
    if (!issue) return
    const updated = subIssues.filter((s) => s.id !== subId)
    setSubIssues(updated)
    saveStoredMeta(issue.id, { subIssues: updated })
  }

  function toggleLabel(labelId) {
    if (!issue) return
    const updated = selectedLabels.includes(labelId)
      ? selectedLabels.filter((l) => l !== labelId)
      : [...selectedLabels, labelId]
    setSelectedLabels(updated)
    saveStoredMeta(issue.id, { labels: updated })
  }

  function toggleSubscribe() {
    if (!issue) return
    const updated = !isSubscribed
    setIsSubscribed(updated)
    saveStoredMeta(issue.id, { isSubscribed: updated })
  }

  function toggleFavorite() {
    if (!issue) return
    const updated = !isFavorite
    setIsFavorite(updated)
    saveStoredMeta(issue.id, { isFavorite: updated })
  }

  async function handleDeleteIssue() {
    if (!issue) return
    const confirmed = window.confirm('¿Seguro que deseas eliminar este issue?')
    if (!confirmed) return
    const { error: delErr } = await supabase.from('issues').delete().eq('id', issue.id)
    if (!delErr) {
      navigate(`/team/${activeTeam?.key || 'WUD'}/issues/active`)
    }
  }

  function copyIssueUrl() {
    navigator.clipboard.writeText(window.location.href)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  function copyBranchName() {
    const slug = (issue?.title || 'task')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40)
    const branch = `${activeTeam?.key?.toLowerCase()}-${issue?.number}-${slug}`
    navigator.clipboard.writeText(branch)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const teamKey = activeTeam?.key || 'WUD'
  const issueKey = `${teamKey}-${issue?.number ?? ''}`

  if (loading) {
    return (
      <div className="flex flex-1 flex-col p-6 animate-pulse space-y-4">
        <div className="h-6 w-48 rounded bg-white/[0.05]" />
        <div className="h-10 w-3/4 rounded bg-white/[0.05]" />
        <div className="h-32 w-full rounded bg-white/[0.03]" />
      </div>
    )
  }

  if (error || !issue) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <p className="text-lg font-medium text-destructive">{error || 'Issue no encontrado'}</p>
        <Link
          to={`/team/${teamKey}/issues/active`}
          className="mt-4 inline-flex h-8 items-center rounded-md bg-white/10 px-3 text-xs font-medium hover:bg-white/15"
        >
          Volver a Issues
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Top Breadcrumb & Actions Bar */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-subtle px-2 sm:px-4">
        {/* Left: Breadcrumbs & Back */}
        <div className="flex min-w-0 items-center gap-1 sm:gap-1.5 text-[13px]">
          <Link
            to={`/team/${teamKey}/issues/active`}
            className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground shrink-0"
            aria-label="Volver a issues"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <span className="hidden sm:inline-flex items-center gap-1.5 shrink-0">
            <span className="grid size-4 place-items-center rounded bg-primary/20 text-[9px] font-bold text-primary">
              {teamKey.slice(0, 2)}
            </span>
            <span className="font-medium text-foreground">{activeTeam?.name || 'VozDesk'}</span>
            <ChevronRight className="size-3 text-muted-foreground" />
            <Link
              to={`/team/${teamKey}/issues/active`}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Issues
            </Link>
            <ChevronRight className="size-3 text-muted-foreground" />
          </span>
          <span className="text-muted-foreground shrink-0 font-medium">{issueKey}</span>
          <span className="truncate max-w-[140px] sm:max-w-md font-medium text-foreground">
            {issue.title}
          </span>

          {/* Favorite */}
          <button
            type="button"
            aria-label="Favorito"
            onClick={toggleFavorite}
            className={cn(
              'ml-0.5 sm:ml-1 grid size-6 place-items-center rounded transition-colors shrink-0',
              isFavorite
                ? 'text-yellow-400 hover:bg-accent'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <Star className={cn('size-3.5', isFavorite && 'fill-yellow-400')} />
          </button>
        </div>

        {/* Right action icons */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="hidden sm:flex items-center gap-1">
            <button
              type="button"
              aria-label="Copiar link"
              title={copiedLink ? '¡Copiado!' : 'Copiar enlace'}
              onClick={copyIssueUrl}
              className="grid size-7 place-items-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-subtle hover:bg-accent hover:text-foreground"
            >
              {copiedLink ? <Check className="size-3.5 text-emerald-400" /> : <Link2 className="size-3.5" />}
            </button>
            <button
              type="button"
              aria-label="Copiar branch"
              title="Copiar branch git"
              onClick={copyBranchName}
              className="grid size-7 place-items-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-subtle hover:bg-accent hover:text-foreground"
            >
              <GitBranch className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Opciones de vista"
              className="grid size-7 place-items-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-subtle hover:bg-accent hover:text-foreground"
            >
              <SlidersHorizontal className="size-3.5" />
            </button>
          </div>
          {/* More options dropdown */}
          <PopoverDropdown
            open={moreOpen}
            onOpenChange={setMoreOpen}
            trigger={
              <button
                type="button"
                aria-label="Más opciones"
                className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <MoreHorizontal className="size-3.5" />
              </button>
            }
          >
            <button
              type="button"
              onClick={() => {
                copyIssueUrl()
                setMoreOpen(false)
              }}
              className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] hover:bg-accent"
            >
              <Link2 className="size-3.5" /> Copiar enlace
            </button>
            <button
              type="button"
              onClick={() => {
                copyBranchName()
                setMoreOpen(false)
              }}
              className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] hover:bg-accent"
            >
              <GitBranch className="size-3.5" /> Copiar nombre de branch
            </button>
            <div className="my-1 h-px bg-white/[0.06]" />
            <button
              type="button"
              onClick={() => {
                handleDeleteIssue()
                setMoreOpen(false)
              }}
              className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] text-destructive hover:bg-destructive/15"
            >
              <Trash2 className="size-3.5" /> Eliminar issue
            </button>
          </PopoverDropdown>
        </div>
      </header>

      {/* Main Container: 2 Columns on desktop, single smooth scroll on mobile */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        {/* Left Column: Title, Description, Sub-issues, Activity */}
        <div className="w-full lg:min-h-0 lg:flex-1 lg:overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-12 lg:py-8">
          <div className="max-w-3xl space-y-6">
            {/* Issue Title */}
            <div>
              {isEditingTitle ? (
                <input
                  type="text"
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTitleSave()
                    if (e.key === 'Escape') {
                      setTitle(issue.title || '')
                      setIsEditingTitle(false)
                    }
                  }}
                  className="w-full bg-transparent text-2xl font-bold tracking-tight outline-none border-b border-primary/50 pb-1"
                />
              ) : (
                <h1
                  onClick={() => setIsEditingTitle(true)}
                  className="cursor-pointer text-2xl font-bold tracking-tight text-foreground hover:opacity-90 rounded px-1 -mx-1 transition-colors hover:bg-white/[0.02]"
                >
                  {issue.title}
                </h1>
              )}
            </div>

            {/* Description */}
            <div className="min-h-[72px]">
              {isEditingDesc ? (
                <div className="space-y-2">
                  <textarea
                    autoFocus
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add description..."
                    rows={4}
                    className="w-full resize-none rounded-md border border-subtle bg-white/[0.02] p-3 text-sm text-foreground outline-none focus:border-subtle placeholder:text-muted-foreground/50"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDescSave}
                      className="rounded bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDescription(issue.description || '')
                        setIsEditingDesc(false)
                      }}
                      className="rounded px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setIsEditingDesc(true)}
                  className={cn(
                    'cursor-pointer rounded-md p-2 -m-2 text-sm transition-colors hover:bg-white/[0.02]',
                    issue.description
                      ? 'text-foreground/90 whitespace-pre-wrap leading-relaxed'
                      : 'text-muted-foreground/60 hover:text-muted-foreground',
                  )}
                >
                  {issue.description || 'Add description...'}
                </div>
              )}
            </div>

            {/* Sub-issues Section */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Sub-issues icon"
                  className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-white/5 hover:text-foreground"
                >
                  <ListTree className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Attachments icon"
                  className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-white/5 hover:text-foreground"
                >
                  <Paperclip className="size-3.5" />
                </button>
              </div>

              {/* Sub-issues List */}
              {subIssues.length > 0 && (
                <div className="space-y-1.5 pl-1">
                  {subIssues.map((sub) => (
                    <div
                      key={sub.id}
                      className="group flex items-center gap-2 rounded-md py-1 px-2 hover:bg-white/[0.03]"
                    >
                      <button
                        type="button"
                        onClick={() => toggleSubIssue(sub.id)}
                        className={cn(
                          'grid size-4 place-items-center rounded border transition-colors',
                          sub.completed
                            ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                            : 'border-subtle hover:border-foreground/30',
                        )}
                      >
                        {sub.completed && <Check className="size-3" />}
                      </button>
                      <span
                        className={cn(
                          'flex-1 text-[13px]',
                          sub.completed && 'line-through text-muted-foreground',
                        )}
                      >
                        {sub.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeSubIssue(sub.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {addingSubIssue ? (
                <form onSubmit={handleAddSubIssue} className="flex items-center gap-2 pl-1">
                  <input
                    type="text"
                    autoFocus
                    value={newSubIssueTitle}
                    onChange={(e) => setNewSubIssueTitle(e.target.value)}
                    placeholder="Título del sub-issue..."
                    className="flex-1 rounded-md border border-subtle bg-white/[0.03] px-2.5 py-1 text-xs outline-none focus:border-subtle"
                  />
                  <button
                    type="submit"
                    className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddingSubIssue(false)}
                    className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingSubIssue(true)}
                  className="flex items-center gap-1.5 rounded-md px-1 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Plus className="size-3.5" />
                  Add sub-issues
                </button>
              )}
            </div>

            {/* Activity Section */}
            <div className="border-t border-subtle pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-semibold text-foreground">Activity</h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleSubscribe}
                    className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
                  >
                    <Bell className="size-3.5" />
                    {isSubscribed ? 'Unsubscribe' : 'Subscribe'}
                  </button>
                  <span className="grid size-5 place-items-center rounded-full bg-emerald-600 text-[9px] font-bold text-white">
                    {teamKey.slice(0, 2)}
                  </span>
                </div>
              </div>

              {/* Activity Timeline Feed */}
              <div className="space-y-3">
                {/* Issue creation event */}
                <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
                  <Avatar person={issue.creator} size="md" />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-foreground">
                      {issue.creator?.full_name || issue.creator?.email || activeTeam?.name || 'Wudlet AI'}
                    </span>
                    <span>created the issue</span>
                    <span>·</span>
                    <span>{timeAgo(issue.created_at)}</span>
                    {issue.source === 'voice' && (
                      <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-1.5 py-0.5 text-[10px] text-fuchsia-300">
                        <Mic className="size-2.5" /> voz
                      </span>
                    )}
                  </div>
                </div>

                {/* Status changes or comments */}
                {comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2.5 text-xs">
                    <Avatar person={c.author} size="md" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="font-medium text-foreground">{c.author.full_name}</span>
                        <span>·</span>
                        <span>{timeAgo(c.created_at)}</span>
                      </div>
                      <p className="text-foreground/90 whitespace-pre-wrap">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Leave a comment container */}
              <div className="mt-4 rounded-xl border border-subtle bg-white/[0.02] p-3 transition-colors focus-within:border-subtle">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleAddComment()
                    }
                  }}
                  placeholder="Leave a comment..."
                  rows={2}
                  className="w-full resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                />
                <div className="mt-2 flex items-center justify-between border-t border-subtle pt-2">
                  <button
                    type="button"
                    aria-label="Adjuntar archivo"
                    className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  >
                    <Paperclip className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Enviar comentario"
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    className={cn(
                      'grid size-7 place-items-center rounded-full transition-colors',
                      newComment.trim()
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'bg-white/5 text-muted-foreground/40 cursor-not-allowed',
                    )}
                  >
                    <ArrowUp className="size-3.5" strokeWidth={2.2} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Properties */}
        <aside className="w-full shrink-0 lg:w-72 lg:overflow-y-auto border-t lg:border-t-0 lg:border-l border-subtle p-4 sm:p-5 space-y-5">
          {/* Properties Header */}
          <div className="text-[13px] font-medium text-muted-foreground">Properties</div>

          {/* Properties Grid */}
          <div className="space-y-1 text-[13px]">
            {/* Status */}
            <PopoverDropdown
              open={statusOpen}
              onOpenChange={setStatusOpen}
              trigger={
                <button
                  type="button"
                  className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left transition-colors hover:bg-white/[0.04]"
                >
                  <StatusIcon status={issue.status} />
                  <span className="font-medium text-foreground">
                    {STATUS_BY_ID[issue.status]?.label || 'Backlog'}
                  </span>
                </button>
              }
            >
              <div className="py-1">
                {STATUSES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      updateIssueField('status', s.id)
                      setStatusOpen(false)
                    }}
                    className={cn(
                      'flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] hover:bg-accent',
                      s.id === issue.status && 'bg-accent/60',
                    )}
                  >
                    <StatusIcon status={s.id} />
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </PopoverDropdown>

            {/* Priority */}
            <PopoverDropdown
              open={priorityOpen}
              onOpenChange={setPriorityOpen}
              trigger={
                <button
                  type="button"
                  className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left transition-colors hover:bg-white/[0.04]"
                >
                  <PriorityIcon priority={issue.priority} />
                  <span className={cn('text-foreground', !issue.priority && 'text-muted-foreground')}>
                    {PRIORITIES.find((p) => p.id === issue.priority)?.label || 'Set priority'}
                  </span>
                </button>
              }
            >
              <div className="py-1">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      updateIssueField('priority', p.id)
                      setPriorityOpen(false)
                    }}
                    className={cn(
                      'flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] hover:bg-accent',
                      p.id === issue.priority && 'bg-accent/60',
                    )}
                  >
                    <PriorityIcon priority={p.id} />
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            </PopoverDropdown>

            {/* Assignee */}
            <PopoverDropdown
              open={assigneeOpen}
              onOpenChange={setAssigneeOpen}
              trigger={
                <button
                  type="button"
                  className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left transition-colors hover:bg-white/[0.04]"
                >
                  <Avatar person={issue.assignee} size="sm" />
                  <span className={cn('text-foreground', !issue.assignee && 'text-muted-foreground')}>
                    {issue.assignee?.full_name || issue.assignee?.email || 'Assign'}
                  </span>
                </button>
              }
            >
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    updateIssueField('assignee_id', null)
                    setAssigneeOpen(false)
                  }}
                  className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <UserRound className="size-3.5" />
                  <span>Unassigned</span>
                </button>
                {teamMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => {
                      updateIssueField('assignee_id', member.id)
                      setIssue((prev) => ({ ...prev, assignee: member }))
                      setAssigneeOpen(false)
                    }}
                    className={cn(
                      'flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] hover:bg-accent',
                      member.id === issue.assignee_id && 'bg-accent/60',
                    )}
                  >
                    <Avatar person={member} size="sm" />
                    <span className="truncate">{member.full_name || member.email}</span>
                  </button>
                ))}
              </div>
            </PopoverDropdown>
          </div>

          {/* Labels Section */}
          <div className="space-y-2">
            <div className="text-[13px] font-medium text-muted-foreground">Labels</div>
            <div className="flex flex-wrap gap-1.5">
              {selectedLabels.map((lId) => {
                const label = DEFAULT_LABELS.find((l) => l.id === lId) || { name: lId, color: '#888' }
                return (
                  <span
                    key={lId}
                    style={{ borderColor: `${label.color}40`, backgroundColor: `${label.color}15`, color: label.color }}
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
                  >
                    <span className="size-1.5 rounded-full" style={{ backgroundColor: label.color }} />
                    {label.name}
                    <button
                      type="button"
                      onClick={() => toggleLabel(lId)}
                      className="ml-0.5 hover:opacity-75"
                    >
                      <X className="size-2.5" />
                    </button>
                  </span>
                )
              })}
              <PopoverDropdown
                open={labelsOpen}
                onOpenChange={setLabelsOpen}
                trigger={
                  <button
                    type="button"
                    className="flex h-6 items-center gap-1 rounded-md border border-dashed border-subtle px-2 text-xs text-muted-foreground hover:border-subtle hover:text-foreground"
                  >
                    <Tag className="size-3" />
                    Add label
                  </button>
                }
              >
                <div className="py-1">
                  {DEFAULT_LABELS.map((lbl) => (
                    <button
                      key={lbl.id}
                      type="button"
                      onClick={() => toggleLabel(lbl.id)}
                      className="flex h-7 w-full items-center justify-between rounded-md px-2 text-[13px] hover:bg-accent"
                    >
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ backgroundColor: lbl.color }} />
                        {lbl.name}
                      </span>
                      {selectedLabels.includes(lbl.id) && <Check className="size-3 text-muted-foreground" />}
                    </button>
                  ))}
                </div>
              </PopoverDropdown>
            </div>
          </div>

          {/* Project Section */}
          <div className="space-y-2">
            <div className="text-[13px] font-medium text-muted-foreground">Project</div>
            <PopoverDropdown
              open={projectOpen}
              onOpenChange={setProjectOpen}
              trigger={
                <button
                  type="button"
                  className="flex h-7 items-center gap-1.5 rounded-md text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Folder className="size-3.5" />
                  <span>{issue.project?.name || 'Add to project'}</span>
                </button>
              }
            >
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    updateIssueField('project_id', null)
                    setIssue((prev) => ({ ...prev, project: null }))
                    setProjectOpen(false)
                  }}
                  className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="size-3" /> Sin proyecto
                </button>
                {projects.map((proj) => (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => {
                      updateIssueField('project_id', proj.id)
                      setIssue((prev) => ({ ...prev, project: proj }))
                      setProjectOpen(false)
                    }}
                    className={cn(
                      'flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] hover:bg-accent',
                      proj.id === issue.project_id && 'bg-accent/60',
                    )}
                  >
                    <Folder className="size-3.5 text-muted-foreground" />
                    <span>{proj.name}</span>
                  </button>
                ))}
              </div>
            </PopoverDropdown>
          </div>

          {/* Due date */}
          <div className="space-y-2">
            <div className="text-[13px] font-medium text-muted-foreground">Due date</div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={issue.due_date || ''}
                onChange={(e) => updateIssueField('due_date', e.target.value || null)}
                className="h-7 rounded border border-subtle bg-white/[0.03] px-2 text-xs text-foreground outline-none focus:border-subtle"
              />
              {issue.due_date && (
                <button
                  type="button"
                  title="Quitar fecha"
                  onClick={() => updateIssueField('due_date', null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
