-- =============================================================================
-- REFERENCIA: estado actual del esquema de VozDesk.
-- NO ejecutar directamente: los cambios se aplican con archivos en supabase/migrations/.
-- Mantener sincronizado con la última migración.
-- =============================================================================

-- =============================================================================
-- VozDesk Â· MigraciÃ³n inicial
-- profiles, workspaces, workspace_members, teams, team_members, projects, issues
-- + RLS + numeraciÃ³n secuencial de issues por team + alta automÃ¡tica de usuario
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- workspaces
-- -----------------------------------------------------------------------------
create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  slug        text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,47}$'),
  owner_id    uuid not null references public.profiles (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- workspace_members
-- -----------------------------------------------------------------------------
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_idx on public.workspace_members (user_id);

-- -----------------------------------------------------------------------------
-- teams  (key = prefijo de los issues, p.ej. "WUD" -> WUD-5)
-- -----------------------------------------------------------------------------
create table public.teams (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 80),
  key            text not null check (key ~ '^[A-Z][A-Z0-9]{1,6}$'),
  issue_counter  integer not null default 0 check (issue_counter >= 0),
  status_order   text[] default null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (workspace_id, key)
);

create index teams_workspace_idx on public.teams (workspace_id);

create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- team_members
-- -----------------------------------------------------------------------------
create table public.team_members (
  team_id     uuid not null references public.teams (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        text not null default 'member' check (role in ('lead', 'member')),
  created_at  timestamptz not null default now(),
  primary key (team_id, user_id)
);

create index team_members_user_idx on public.team_members (user_id);

-- -----------------------------------------------------------------------------
-- projects
-- -----------------------------------------------------------------------------
create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  team_id       uuid references public.teams (id) on delete set null,
  name          text not null check (char_length(name) between 1 and 120),
  description   text,
  status        text not null default 'planned'
                check (status in ('backlog', 'planned', 'in_progress', 'paused', 'completed', 'canceled')),
  lead_id       uuid references public.profiles (id) on delete set null,
  start_date    date,
  target_date   date,
  created_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index projects_workspace_idx on public.projects (workspace_id);
create index projects_team_idx on public.projects (team_id);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- issues
-- priority: 0 = sin prioridad, 1 = urgente, 2 = alta, 3 = media, 4 = baja
-- source:   'manual' (UI) | 'voice' (Custumu)
-- -----------------------------------------------------------------------------
create table public.issues (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  team_id       uuid not null references public.teams (id) on delete cascade,
  project_id    uuid references public.projects (id) on delete set null,
  number        integer not null,
  title         text not null check (char_length(title) between 1 and 500),
  description   text,
  status        text not null default 'backlog'
                check (status in ('backlog', 'todo', 'in_progress', 'in_review', 'done', 'canceled')),
  priority      smallint not null default 0 check (priority between 0 and 4),
  assignee_id   uuid references public.profiles (id) on delete set null,
  creator_id    uuid references public.profiles (id) on delete set null default auth.uid(),
  due_date      date,
  source        text not null default 'manual' check (source in ('manual', 'voice')),
  sort_order    double precision not null default 0,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (team_id, number)
);

create index issues_workspace_idx on public.issues (workspace_id);
create index issues_team_status_idx on public.issues (team_id, status);
create index issues_team_sort_order_idx on public.issues (team_id, status, sort_order);
create index issues_assignee_idx on public.issues (assignee_id);
create index issues_project_idx on public.issues (project_id);

create trigger issues_set_updated_at
  before update on public.issues
  for each row execute function public.set_updated_at();

-- NumeraciÃ³n secuencial por team (atÃ³mica: el UPDATE bloquea la fila del team)
create or replace function public.assign_issue_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace uuid;
begin
  update public.teams
     set issue_counter = issue_counter + 1
   where id = new.team_id
  returning issue_counter, workspace_id into new.number, v_workspace;

  if new.number is null then
    raise exception 'Team % no existe', new.team_id;
  end if;

  new.workspace_id := v_workspace;
  return new;
end;
$$;

create trigger issues_assign_number
  before insert on public.issues
  for each row execute function public.assign_issue_number();

-- Evita cambiar team/nÃºmero tras la creaciÃ³n y gestiona completed_at
create or replace function public.guard_issue_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.team_id <> old.team_id or new.number <> old.number or new.workspace_id <> old.workspace_id then
    raise exception 'No se puede cambiar team_id, number ni workspace_id de un issue';
  end if;

  if new.status in ('done', 'canceled') and old.status not in ('done', 'canceled') then
    new.completed_at := now();
  elsif new.status not in ('done', 'canceled') then
    new.completed_at := null;
  end if;

  return new;
end;
$$;

create trigger issues_guard_update
  before update on public.issues
  for each row execute function public.guard_issue_update();

-- -----------------------------------------------------------------------------
-- Helpers de RLS (security definer para evitar recursiÃ³n entre polÃ­ticas)
-- -----------------------------------------------------------------------------
create or replace function public.is_workspace_member(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members
     where workspace_id = p_workspace and user_id = (select auth.uid())
  );
$$;

create or replace function public.is_workspace_admin(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members
     where workspace_id = p_workspace
       and user_id = (select auth.uid())
       and role in ('owner', 'admin')
  );
$$;

create or replace function public.team_workspace(p_team uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select workspace_id from public.teams where id = p_team;
$$;

create or replace function public.shares_workspace_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.workspace_members a
      join public.workspace_members b on a.workspace_id = b.workspace_id
     where a.user_id = (select auth.uid()) and b.user_id = p_user
  );
$$;

-- Al crear un workspace, el owner pasa a ser miembro 'owner'
create or replace function public.add_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (workspace_id, user_id) do update set role = 'owner';
  return new;
end;
$$;

create trigger workspaces_add_owner
  after insert on public.workspaces
  for each row execute function public.add_workspace_owner();

-- Al crear un team desde la app, quien lo crea pasa a ser 'lead'
create or replace function public.add_team_creator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    insert into public.team_members (team_id, user_id, role)
    values (new.id, auth.uid(), 'lead')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger teams_add_creator
  after insert on public.teams
  for each row execute function public.add_team_creator();

-- -----------------------------------------------------------------------------
-- Alta de usuario: perfil + workspace + team por defecto
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name      text;
  v_base      text;
  v_slug      text;
  v_key       text;
  v_workspace uuid;
  v_team      uuid;
begin
  v_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(new.email, '@', 1),
    'Usuario'
  );

  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    v_name,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );

  -- slug Ãºnico: base alfanumÃ©rica + sufijo aleatorio
  v_base := lower(regexp_replace(coalesce(split_part(new.email, '@', 1), 'workspace'), '[^a-zA-Z0-9]+', '-', 'g'));
  v_base := trim(both '-' from left(v_base, 32));
  if char_length(v_base) < 2 then
    v_base := 'workspace';
  end if;
  v_slug := v_base || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  insert into public.workspaces (name, slug, owner_id)
  values (v_name, v_slug, new.id)
  returning id into v_workspace;
  -- (el trigger workspaces_add_owner inserta la membresÃ­a 'owner')

  -- key del team: 3 primeras letras del nombre en mayÃºsculas
  v_key := upper(left(regexp_replace(v_name, '[^a-zA-Z]', '', 'g'), 3));
  if char_length(v_key) < 2 then
    v_key := 'TEAM';
  end if;

  insert into public.teams (workspace_id, name, key)
  values (v_workspace, v_name, v_key)
  returning id into v_team;

  insert into public.team_members (team_id, user_id, role)
  values (v_team, new.id, 'lead')
  on conflict do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.teams             enable row level security;
alter table public.team_members      enable row level security;
alter table public.projects          enable row level security;
alter table public.issues            enable row level security;

-- profiles
create policy "profiles: ver propio o compaÃ±eros"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_workspace_with(id));

create policy "profiles: actualizar propio"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- workspaces
create policy "workspaces: ver si es miembro"
  on public.workspaces for select to authenticated
  using (public.is_workspace_member(id) or owner_id = (select auth.uid()));

create policy "workspaces: crear como owner"
  on public.workspaces for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "workspaces: admins actualizan"
  on public.workspaces for update to authenticated
  using (public.is_workspace_admin(id))
  with check (public.is_workspace_admin(id));

create policy "workspaces: owner elimina"
  on public.workspaces for delete to authenticated
  using (owner_id = (select auth.uid()));

-- workspace_members
create policy "workspace_members: ver miembros del workspace"
  on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "workspace_members: admins aÃ±aden"
  on public.workspace_members for insert to authenticated
  with check (public.is_workspace_admin(workspace_id));

create policy "workspace_members: admins actualizan"
  on public.workspace_members for update to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

create policy "workspace_members: admins eliminan o salir"
  on public.workspace_members for delete to authenticated
  using (public.is_workspace_admin(workspace_id) or user_id = (select auth.uid()));

-- teams
create policy "teams: ver si es miembro del workspace"
  on public.teams for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "teams: miembros crean"
  on public.teams for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "teams: admins actualizan"
  on public.teams for update to authenticated
  using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

create policy "teams: miembros actualizan configuracion"
  on public.teams for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "teams: admins eliminan"
  on public.teams for delete to authenticated
  using (public.is_workspace_admin(workspace_id));

-- team_members
create policy "team_members: ver si es miembro del workspace"
  on public.team_members for select to authenticated
  using (public.is_workspace_member(public.team_workspace(team_id)));

create policy "team_members: admins o unirse uno mismo"
  on public.team_members for insert to authenticated
  with check (
    public.is_workspace_admin(public.team_workspace(team_id))
    or (user_id = (select auth.uid()) and public.is_workspace_member(public.team_workspace(team_id)))
  );

create policy "team_members: admins actualizan"
  on public.team_members for update to authenticated
  using (public.is_workspace_admin(public.team_workspace(team_id)))
  with check (public.is_workspace_admin(public.team_workspace(team_id)));

create policy "team_members: admins eliminan o salir"
  on public.team_members for delete to authenticated
  using (
    public.is_workspace_admin(public.team_workspace(team_id))
    or user_id = (select auth.uid())
  );

-- projects
create policy "projects: ver si es miembro"
  on public.projects for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "projects: miembros crean"
  on public.projects for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "projects: miembros actualizan"
  on public.projects for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "projects: creador o admin elimina"
  on public.projects for delete to authenticated
  using (created_by = (select auth.uid()) or public.is_workspace_admin(workspace_id));

-- issues  (workspace_id lo fija el trigger a partir del team)
create policy "issues: ver si es miembro"
  on public.issues for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "issues: miembros crean"
  on public.issues for insert to authenticated
  with check (public.is_workspace_member(public.team_workspace(team_id)));

create policy "issues: miembros actualizan"
  on public.issues for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "issues: creador o admin elimina"
  on public.issues for delete to authenticated
  using (creator_id = (select auth.uid()) or public.is_workspace_admin(workspace_id));

-- -----------------------------------------------------------------------------
-- Permisos: las funciones internas no deben ser invocables por la API
-- -----------------------------------------------------------------------------
revoke execute on function public.handle_new_user()      from public, anon, authenticated;
revoke execute on function public.assign_issue_number()  from public, anon, authenticated;
revoke execute on function public.add_workspace_owner()  from public, anon, authenticated;
revoke execute on function public.add_team_creator()     from public, anon, authenticated;

-- Realtime para la lista de issues
alter publication supabase_realtime add table public.issues;
