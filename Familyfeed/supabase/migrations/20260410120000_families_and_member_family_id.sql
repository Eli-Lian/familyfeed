-- Families + link members to a family (onboarding)
create extension if not exists pgcrypto;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists families_created_by_idx on public.families (created_by);

alter table public.members
  add column if not exists family_id uuid references public.families (id) on delete cascade;

create index if not exists members_family_id_idx on public.members (family_id);

alter table public.families enable row level security;

do $$
begin
  execute 'drop policy if exists "families_select_authenticated" on public.families';
  execute 'drop policy if exists "families_insert_authenticated" on public.families';
  execute 'drop policy if exists "families_update_authenticated" on public.families';
  execute 'drop policy if exists "families_delete_authenticated" on public.families';

  execute 'create policy "families_select_authenticated" on public.families for select to authenticated using (true)';
  execute 'create policy "families_insert_authenticated" on public.families for insert to authenticated with check (true)';
  execute 'create policy "families_update_authenticated" on public.families for update to authenticated using (true) with check (true)';
  execute 'create policy "families_delete_authenticated" on public.families for delete to authenticated using (true)';
end $$;

alter table public.families replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'families'
  ) then
    alter publication supabase_realtime add table public.families;
  end if;
end $$;
