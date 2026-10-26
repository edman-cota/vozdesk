import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { Box, CircleDot, Inbox, Layers, Send } from 'lucide-react'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { WorkspaceProvider, useWorkspace } from '@/context/WorkspaceContext'
import AppLayout from '@/components/layout/AppLayout'
import { HistoryIcon, VozDeskLogo } from '@/components/icons'
import LoginPage from '@/pages/LoginPage'
import IssuesPage from '@/pages/IssuesPage'
import IssueDetailPage from '@/pages/IssueDetailPage'
import PlaceholderPage from '@/pages/PlaceholderPage'

function FullScreenLoader() {
  return (
    <div className="grid h-full place-items-center">
      <VozDeskLogo className="size-10 animate-pulse" />
    </div>
  )
}

function RequireAuth() {
  const { user, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (!user) return <Navigate to="/login" replace />
  return (
    <WorkspaceProvider>
      <Outlet />
    </WorkspaceProvider>
  )
}

/** Redirige al Issues del primer team del workspace */
function HomeRedirect() {
  const { teams, loading, error } = useWorkspace()
  if (error) return <div className="grid flex-1 place-items-center text-destructive">{error}</div>
  if (loading || teams.length === 0) {
    return <div className="grid flex-1 place-items-center text-muted-foreground">Preparando tu workspace…</div>
  }
  return <Navigate to={`/team/${teams[0].key}/issues/active`} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route index element={<HomeRedirect />} />
              <Route path="team/:teamKey/issues/:tab?" element={<IssuesPage />} />
              <Route path="team/:teamKey/issue/:issueIdentifier/:slug?" element={<IssueDetailPage />} />
              <Route path="team/:teamKey/issue/:issueIdentifier" element={<IssueDetailPage />} />
              <Route path="issue/:issueIdentifier" element={<IssueDetailPage />} />
              <Route path="team/:teamKey/home" element={<PlaceholderPage title="Home" description="Resumen del team próximamente." />} />
              <Route path="team/:teamKey/projects" element={<PlaceholderPage title="Projects" icon={Box} description="Los proyectos del team aparecerán aquí." />} />
              <Route path="team/:teamKey/views" element={<PlaceholderPage title="Views" icon={Layers} description="Guarda filtros como vistas." />} />
              <Route path="inbox" element={<PlaceholderPage title="Inbox" icon={Inbox} description="Notificaciones y menciones." />} />
              <Route path="my-issues" element={<PlaceholderPage title="My issues" icon={CircleDot} description="Issues asignados a ti." />} />
              <Route path="agent" element={<PlaceholderPage title="Agent" icon={Send} description="Aquí se conectará Custumu para crear y gestionar issues por voz." />} />
              <Route path="history" element={<PlaceholderPage title="Historial" icon={HistoryIcon} description="Historial de comandos de voz y actividad." />} />
              <Route path="projects" element={<PlaceholderPage title="Projects" icon={Box} description="Proyectos del workspace." />} />
              <Route path="views" element={<PlaceholderPage title="Views" icon={Layers} description="Vistas guardadas del workspace." />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
