-- =============================================================================
-- Migration: Add status_order to teams and sort_order to issues
-- General-purpose workflow ordering for all views (Active, Backlog, All, Kanban).
-- =============================================================================

-- 1. Add sort_order to issues for manual / fractional ordering across all views
alter table public.issues
  add column if not exists sort_order double precision not null default 0;

-- Index for instant indexed ordering by team, status, and sort_order
create index if not exists issues_team_sort_order_idx
  on public.issues (team_id, status, sort_order);

-- 2. Add status_order to teams for team-wide status workflow ordering across all views
alter table public.teams
  add column if not exists status_order text[] default null;

-- 3. Policy to allow workspace members to update team status workflow configuration
drop policy if exists "teams: miembros actualizan configuracion" on public.teams;
create policy "teams: miembros actualizan configuracion"
  on public.teams for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
