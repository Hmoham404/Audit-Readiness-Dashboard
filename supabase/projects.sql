-- Additive setup: existing audit_points and audit_settings stay untouched.
-- Run once in the SQL Editor of the EXISTING Supabase project.
begin;
create table if not exists public.audit_projects (
  id text primary key,
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  created_at timestamptz not null default now(),
  deadlines jsonb not null,
  sources jsonb not null default '{}'::jsonb
);
create table if not exists public.audit_project_points (
  project_id text not null references public.audit_projects(id) on delete cascade,
  id bigint not null,
  num integer not null check (num > 0),
  audit text not null check (audit in ('GMP', 'SMETA')),
  title text not null,
  description text not null default '',
  owner text not null default '',
  department text not null default '',
  status integer not null default 0 check (status in (0, 1)),
  applicable boolean not null default true,
  due date not null,
  requirements jsonb not null default '[]'::jsonb,
  comments jsonb not null default '[]'::jsonb,
  details jsonb,
  primary key (project_id, id)
);
create index if not exists audit_project_points_audit_idx on public.audit_project_points (project_id, audit, num);
alter table public.audit_projects enable row level security;
alter table public.audit_project_points enable row level security;
-- Preserve the existing application's no-login access model.
drop policy if exists "Public projects" on public.audit_projects;
create policy "Public projects" on public.audit_projects for all to anon, authenticated using (true) with check (true);
drop policy if exists "Public project points" on public.audit_project_points;
create policy "Public project points" on public.audit_project_points for all to anon, authenticated using (true) with check (true);
grant select, insert, update on public.audit_projects to anon, authenticated;
grant select, insert, update, delete on public.audit_project_points to anon, authenticated;

-- Header + imported points are created in one transaction. Reloads never overwrite a live project.
create or replace function public.create_audit_project(p_project jsonb) returns void
language plpgsql security invoker set search_path = public as $$
begin
  insert into public.audit_projects(id, name, description, created_at, deadlines, sources)
  values(p_project->>'id', p_project->>'name', coalesce(p_project->>'description', ''),
    coalesce((p_project->>'created_at')::timestamptz, now()), p_project->'deadlines', coalesce(p_project->'sources', '{}'::jsonb))
  on conflict (id) do nothing;
  if not found then return; end if;
  insert into public.audit_project_points(project_id, id, num, audit, title, description, owner, department, status, applicable, due, requirements, comments, details)
  select p_project->>'id', p.id, p.num, p.audit, p.title, coalesce(p.description, ''), coalesce(p.owner, ''),
    coalesce(p.department, ''), p.status, p.applicable, p.due, coalesce(p.requirements, '[]'::jsonb), coalesce(p.comments, '[]'::jsonb), p.details
  from jsonb_to_recordset(coalesce(p_project->'points', '[]'::jsonb)) as p(
    id bigint, num integer, audit text, title text, description text, owner text, department text,
    status integer, applicable boolean, due date, requirements jsonb, comments jsonb, details jsonb);
end $$;

create or replace function public.set_audit_project_deadline(p_project_id text, p_audit text, p_due date) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if p_audit not in ('GMP', 'SMETA') or p_due is null then raise exception 'Invalid audit or deadline'; end if;
  update public.audit_projects set deadlines = jsonb_set(deadlines, array[p_audit], to_jsonb(p_due::text)) where id = p_project_id;
  if not found then raise exception 'Project not found'; end if;
end $$;
revoke all on function public.create_audit_project(jsonb) from public;
revoke all on function public.set_audit_project_deadline(text, text, date) from public;
grant execute on function public.create_audit_project(jsonb) to anon, authenticated;
grant execute on function public.set_audit_project_deadline(text, text, date) to anon, authenticated;
do $$ declare table_name text; begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach table_name in array array['audit_projects', 'audit_project_points'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name) then
        execute format('alter publication supabase_realtime add table public.%I', table_name);
      end if;
    end loop;
  end if;
end $$;
commit;
