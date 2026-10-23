import { useState } from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { PRIORITIES, PriorityIcon, STATUSES, StatusIcon } from '@/components/issues/issue-meta'
import { cn } from '@/lib/utils'

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs transition-colors',
        active ? 'border-primary/50 bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

export default function NewIssueDialog({ open, onOpenChange, team, defaultStatus = 'backlog', onCreated }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState(defaultStatus)
  const [priority, setPriority] = useState(0)
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Sincroniza el estado inicial cada vez que se abre
  const [lastOpen, setLastOpen] = useState(open)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setTitle(''); setDescription(''); setStatus(defaultStatus); setPriority(0); setDueDate(''); setError(null)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim() || !team) return
    setSaving(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('issues')
      .insert({
        team_id: team.id,
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        due_date: dueDate || null,
        source: 'manual',
      })
      .select('*, assignee:profiles!issues_assignee_id_fkey(id, full_name, avatar_url)')
      .single()
    setSaving(false)
    if (err) return setError(err.message)
    onCreated?.(data)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-popover sm:max-w-xl">
        <form onSubmit={handleSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[11px] font-semibold text-primary">{team?.key}</span>
              New issue
            </DialogTitle>
            <DialogDescription className="sr-only">Crear un nuevo issue en {team?.name}</DialogDescription>
          </DialogHeader>

          <input
            id="new-issue-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Issue title"
            className="bg-transparent text-lg font-semibold outline-none placeholder:text-muted-foreground/60"
          />
          <textarea
            id="new-issue-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add description…"
            rows={4}
            className="resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <Chip key={s.id} active={status === s.id} onClick={() => setStatus(s.id)}>
                  <StatusIcon status={s.id} /> {s.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Priority</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRIORITIES.map((p) => (
                <Chip key={p.id} active={priority === p.id} onClick={() => setPriority(p.id)}>
                  <PriorityIcon priority={p.id} /> {p.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="grid max-w-[200px] gap-2">
            <Label htmlFor="new-issue-due" className="text-xs text-muted-foreground">Due date</Label>
            <Input id="new-issue-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-8" />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter className="border-t pt-4">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button id="new-issue-submit" type="submit" size="sm" disabled={saving || !title.trim()}>
              {saving ? 'Creating…' : 'Create issue'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
