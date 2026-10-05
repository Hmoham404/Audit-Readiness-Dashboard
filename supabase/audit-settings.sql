-- Run once in Supabase SQL Editor to store the shared GMP and SMETA audit dates.
create table if not exists public.audit_settings (
  audit text primary key check (audit in ('GMP', 'SMETA')),
  due date not null
);

alter table public.audit_settings enable row level security;
drop policy if exists "Public can read audit settings" on public.audit_settings;
drop policy if exists "Public can add audit settings" on public.audit_settings;
drop policy if exists "Public can update audit settings" on public.audit_settings;

create policy "Public can read audit settings" on public.audit_settings
  for select to anon, authenticated using (true);
create policy "Public can add audit settings" on public.audit_settings
  for insert to anon, authenticated with check (true);
create policy "Public can update audit settings" on public.audit_settings
  for update to anon, authenticated using (true) with check (true);

grant select, insert, update on public.audit_settings to anon, authenticated;

insert into public.audit_settings (audit, due) values
  ('GMP', '2026-10-09'),
  ('SMETA', '2026-10-16')
on conflict (audit) do nothing;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'audit_settings') then
    alter publication supabase_realtime add table public.audit_settings;
  end if;
end $$;
