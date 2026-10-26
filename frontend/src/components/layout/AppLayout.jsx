import { Outlet, useNavigate } from 'react-router-dom'
import { Send } from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import { HistoryIcon } from '@/components/icons'

function BottomBar() {
  const navigate = useNavigate()
  return (
    <footer className="flex h-9 shrink-0 items-center justify-end gap-1 pr-3 text-[12px] text-muted-foreground">
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

export default function AppLayout() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        {/* Panel principal flotante */}
        <main className="mt-2 mr-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-subtle bg-card shadow-[0_0_0_1px_rgba(0,0,0,0.4),0_8px_30px_rgba(0,0,0,0.35)]">
          <Outlet />
        </main>
      </div>
      {/* Barra inferior fuera del panel */}
      <BottomBar />
    </div>
  )
}
