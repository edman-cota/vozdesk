import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Box, Check, ChevronDown, Ellipsis, House, Import, Inbox,
  Layers, LogOut, Plus, Search, SquarePen, CircleDot, Copy, X, Send,
} from 'lucide-react'
import { GithubIcon } from '@/components/icons'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { useWorkspace } from '@/context/WorkspaceContext'

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || 'VD'
}

function NavItem({ to, icon: Icon, children, indent = false, end = false, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'group flex h-7 items-center gap-2 rounded-md px-2 text-[13px] text-sidebar-foreground/85 transition-colors',
          'hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground',
          indent && 'pl-7',
          isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
        )
      }
    >
      <Icon className="size-3.5 shrink-0 opacity-80" strokeWidth={1.8} />
      <span className="truncate">{children}</span>
    </NavLink>
  )
}

function ActionItem({ icon: Icon, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
    >
      <Icon className="size-3.5 shrink-0 opacity-80" strokeWidth={1.8} />
      <span className="truncate">{children}</span>
    </button>
  )
}

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-6 items-center gap-1 rounded px-2 text-xs font-medium text-muted-foreground hover:text-sidebar-foreground"
      >
        {title}
        <ChevronDown className={cn('size-3 transition-transform', !open && '-rotate-90')} />
      </button>
      {open && <div className="mt-0.5 space-y-px animate-fade-in">{children}</div>}
    </div>
  )
}

function TeamGroup({ team, onClose }) {
  const [open, setOpen] = useState(true)
  const base = `/team/${team.key}`
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-[13px] text-sidebar-foreground/90 hover:bg-sidebar-accent/70"
      >
        <span className="grid size-4 place-items-center rounded bg-primary/20 text-[9px] font-bold text-primary">
          {team.key.slice(0, 2)}
        </span>
        <span className="truncate">{team.name}</span>
        <ChevronDown className={cn('size-3 text-muted-foreground transition-transform', !open && '-rotate-90')} />
      </button>
      {open && (
        <div className="space-y-px animate-fade-in">
          <NavItem to={`${base}/home`} icon={House} indent onClick={onClose}>Home</NavItem>
          <NavItem to={`${base}/issues`} icon={Copy} indent onClick={onClose}>Issues</NavItem>
          <NavItem to={`${base}/projects`} icon={Box} indent onClick={onClose}>Projects</NavItem>
          <NavItem to={`${base}/views`} icon={Layers} indent onClick={onClose}>Views</NavItem>
        </div>
      )}
    </div>
  )
}

function WorkspaceSwitcher() {
  const { workspace, workspaces, switchWorkspace, profile } = useWorkspace()
  const { signOut, user } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e) => !ref.current?.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const name = workspace?.name ?? 'VozDesk'

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        id="workspace-switcher"
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 min-w-0 items-center gap-2 rounded-md px-1.5 hover:bg-sidebar-accent/70"
      >
        <span className="grid size-5 shrink-0 place-items-center rounded-[5px] bg-gradient-to-br from-fuchsia-500 to-violet-600 text-[9px] font-bold text-white">
          {initials(name)}
        </span>
        <span className="truncate text-[13px] font-semibold text-sidebar-accent-foreground">{name}</span>
        <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 top-9 z-50 w-64 animate-fade-in rounded-lg border bg-popover p-1 shadow-2xl shadow-black/60">
          <div className="truncate px-2 py-1.5 text-xs text-muted-foreground">
            {profile?.email ?? user?.email}
          </div>
          {workspaces.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => { switchWorkspace(w.id); setOpen(false) }}
              className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-[13px] hover:bg-accent"
            >
              <span className="grid size-5 place-items-center rounded-[5px] bg-gradient-to-br from-fuchsia-500 to-violet-600 text-[9px] font-bold text-white">
                {initials(w.name)}
              </span>
              <span className="flex-1 truncate text-left">{w.name}</span>
              {w.id === workspace?.id && <Check className="size-3.5 text-muted-foreground" />}
            </button>
          ))}
          <div className="my-1 h-px bg-border" />
          <button
            id="sign-out"
            type="button"
            onClick={signOut}
            className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <LogOut className="size-3.5" /> Log out
          </button>
        </div>
      )}
    </div>
  )
}

function WhatsNewCard() {
  const [visible, setVisible] = useState(() => localStorage.getItem('vozdesk:whatsnew') !== 'hidden')
  if (!visible) return null
  return (
    <div className="group relative mx-1 mb-1 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3 transition-colors hover:bg-sidebar-accent/60">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={() => { localStorage.setItem('vozdesk:whatsnew', 'hidden'); setVisible(false) }}
        className="absolute right-2 top-2 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
      >
        <X className="size-3" />
      </button>
      <p className="text-xs text-muted-foreground">What&apos;s new</p>
      <p className="mt-0.5 text-[13px] font-medium leading-snug text-sidebar-accent-foreground">
        Crea issues con tu voz desde el Agent
      </p>
    </div>
  )
}

export default function Sidebar({ className, onClose }) {
  const { teams } = useWorkspace()

  return (
    <aside className={cn('flex h-full w-[260px] md:w-[236px] shrink-0 flex-col px-2 pb-2 pt-2.5 bg-sidebar', className)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-1 pr-0.5">
        <WorkspaceSwitcher />
        <div className="flex items-center gap-0.5">
          <button type="button" aria-label="Buscar" className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
            <Search className="size-3.5" />
          </button>
          <button type="button" aria-label="Nuevo issue" className="grid size-7 place-items-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/80">
            <SquarePen className="size-3.5" />
          </button>
          {onClose && (
            <button
              type="button"
              aria-label="Cerrar menú"
              onClick={onClose}
              className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground md:hidden"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      <nav className="mt-3 flex-1 overflow-y-auto">
        <div className="space-y-px">
          <NavItem to="/inbox" icon={Inbox} onClick={onClose}>Inbox</NavItem>
          <NavItem to="/my-issues" icon={CircleDot} onClick={onClose}>My issues</NavItem>
          <NavItem to="/agent" icon={Send} onClick={onClose}>Agent</NavItem>
        </div>

        <Section title="Workspace">
          <NavItem to="/projects" icon={Box} onClick={onClose}>Projects</NavItem>
          <NavItem to="/views" icon={Layers} onClick={onClose}>Views</NavItem>
          <ActionItem icon={Ellipsis}>More</ActionItem>
        </Section>

        <Section title="Your teams">
          {teams.length === 0 && (
            <p className="px-2 py-1 text-xs text-muted-foreground">Sin teams todavía</p>
          )}
          {teams.map((t) => <TeamGroup key={t.id} team={t} onClose={onClose} />)}
        </Section>

        <Section title="Try">
          <ActionItem icon={Import}>Import issues</ActionItem>
          <ActionItem icon={Plus}>Invite people</ActionItem>
          <ActionItem icon={GithubIcon}>Connect GitHub</ActionItem>
        </Section>
      </nav>

      <WhatsNewCard />
    </aside>
  )
}
