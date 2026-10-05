-- MYC Audit Readiness — shared, no-login database setup.
-- Run in the Supabase SQL Editor for the project used by this dashboard.
create table if not exists public.audit_points (
  id integer primary key,
  audit text not null check (audit in ('GMP', 'SMETA')),
  title text not null,
  description text not null default '',
  owner text not null default '',
  department text not null default '',
  status integer not null default 0 check (status in (0, 1)),
  applicable boolean not null default true,
  due date not null,
  requirements jsonb not null default '[]'::jsonb,
  comments jsonb not null default '[]'::jsonb
);
create table if not exists public.audit_settings (
  audit text primary key check (audit in ('GMP', 'SMETA')),
  due date not null
);
alter table public.audit_settings enable row level security;
drop policy if exists "Public can read audit settings" on public.audit_settings;
drop policy if exists "Public can add audit settings" on public.audit_settings;
drop policy if exists "Public can update audit settings" on public.audit_settings;
create policy "Public can read audit settings" on public.audit_settings for select to anon, authenticated using (true);
create policy "Public can add audit settings" on public.audit_settings for insert to anon, authenticated with check (true);
create policy "Public can update audit settings" on public.audit_settings for update to anon, authenticated using (true) with check (true);
grant select, insert, update on public.audit_settings to anon, authenticated;
insert into public.audit_settings (audit, due) values ('GMP', '2026-10-09'), ('SMETA', '2026-10-16') on conflict (audit) do nothing;
alter table public.audit_points enable row level security;
drop policy if exists "Public can read audit points" on public.audit_points;
drop policy if exists "Public can add audit points" on public.audit_points;
drop policy if exists "Public can update audit points" on public.audit_points;
drop policy if exists "Public can delete audit points" on public.audit_points;
create policy "Public can read audit points" on public.audit_points for select to anon, authenticated using (true);
create policy "Public can add audit points" on public.audit_points for insert to anon, authenticated with check (true);
create policy "Public can update audit points" on public.audit_points for update to anon, authenticated using (true) with check (true);
create policy "Public can delete audit points" on public.audit_points for delete to anon, authenticated using (true);
grant select, insert, update, delete on public.audit_points to anon, authenticated;
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'audit_points') then
    alter publication supabase_realtime add table public.audit_points;
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'audit_settings') then
    alter publication supabase_realtime add table public.audit_settings;
  end if;
end $$;

