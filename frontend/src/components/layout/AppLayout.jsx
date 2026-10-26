import { Outlet, useNavigate } from 'react-router-dom'
import { Send } from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import { HistoryIcon } from '@/components/icons'
import { SidebarProvider, useSidebar } from '@/context/SidebarContext'
import { cn } from '@/lib/utils'

function BottomBar() {
  const navigate = useNavigate()
  return (
    <footer className="flex h-9 shrink-0 items-center justify-end gap-1 pr-16 md:pr-3 text-[12px] text-muted-foreground pb-[max(env(safe-area-inset-bottom),0px)]">
      <span className="mr-3 hidden sm:inline">Di &quot;crear issue…&quot; para dictar una tarea</span>
      <button
        id="bottom-agent"
        type="button"
        onClick={() => navigate('/agent')}
        className="flex h-7 items-center gap-1.5 rounded-md px-2 transition-colors hover:bg-accent hover:text-foreground"
      >
        <Send className="size-3.5" strokeWidth={1.8} />
        Agent
      </button>
      <button
        id="bottom-history"
        type="button"
        aria-label="Historial"
        title="Historial"
        onClick={() => navigate('/history')}
        className="grid size-7 place-items-center rounded-md transition-colors hover:bg-accent hover:text-foreground"
      >
        <HistoryIcon className="size-3.5" />
      </button>
    </footer>
  )
}

function LayoutContent() {
  const { isOpen, close } = useSidebar()

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* Desktop Sidebar (pinned) */}
        <div className="hidden md:flex shrink-0">
          <Sidebar />
        </div>

        {/* Mobile Drawer Backdrop */}
        {isOpen && (
          <div
            onClick={close}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs transition-opacity md:hidden animate-fade-in"
            aria-hidden="true"
          />
        )}

        {/* Mobile Sidebar (Slide-over Drawer) */}
        <div
          className={cn(
            'fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] transform bg-sidebar shadow-2xl transition-transform duration-250 ease-out md:hidden',
            isOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
          )}
        >
          <Sidebar onClose={close} className="w-full" />
        </div>

        {/* Floating Main Panel (full-width on mobile, floating rounded card on desktop) */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-card sm:mt-2 sm:mr-2 sm:rounded-xl sm:border sm:border-subtle sm:shadow-[0_0_0_1px_rgba(0,0,0,0.4),0_8px_30px_rgba(0,0,0,0.35)]">
          <Outlet />
        </main>
      </div>

      {/* Bottom Bar outside floating card */}
      <BottomBar />
    </div>
  )
}

export default function AppLayout() {
  return (
    <SidebarProvider>
      <LayoutContent />
    </SidebarProvider>
  )
}
