/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

const WorkspaceContext = createContext(null)
const STORAGE_KEY = 'vozdesk:workspace'

export function WorkspaceProvider({ children }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [workspaces, setWorkspaces] = useState([])
  const [teams, setTeams] = useState([])
  const [workspaceId, setWorkspaceId] = useState(() => localStorage.getItem(STORAGE_KEY))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Perfil + workspaces del usuario
  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const [{ data: prof }, { data: ws, error: wsErr }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('workspaces').select('id, name, slug, owner_id').order('created_at'),
      ])
      if (cancelled) return
      if (wsErr) setError(wsErr.message)
      setProfile(prof)
      setWorkspaces(ws ?? [])
      setWorkspaceId((current) =>
        ws?.some((w) => w.id === current) ? current : (ws?.[0]?.id ?? null),
      )
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user])

  // Teams del workspace activo
  useEffect(() => {
    if (!workspaceId) return
    localStorage.setItem(STORAGE_KEY, workspaceId)
    supabase
      .from('teams')
      .select('id, name, key, issue_counter, status_order')
      .eq('workspace_id', workspaceId)
      .order('created_at')
      .then(({ data }) => setTeams(data ?? []))
  }, [workspaceId])

  const switchWorkspace = useCallback((id) => setWorkspaceId(id), [])

  const value = useMemo(
    () => ({
      profile,
      workspaces,
      workspace: workspaces.find((w) => w.id === workspaceId) ?? null,
      teams,
      loading,
      error,
      switchWorkspace,
    }),
    [profile, workspaces, workspaceId, teams, loading, error, switchWorkspace],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace debe usarse dentro de <WorkspaceProvider>')
  return ctx
}
