-- Tabelle: Lernfortschritt pro Kind / Fach / Gesprächsrunde
-- In Supabase SQL Editor ausführen, falls noch nicht vorhanden.

create table if not exists fortschritt (
  id uuid default gen_random_uuid() primary key,
  kind_id uuid not null references profiles (id) on delete cascade,
  fach text not null,
  thema text,
  stufe int default 1 check (stufe >= 1 and stufe <= 5),
  created_at timestamptz default now()
);

create index if not exists fortschritt_kind_id_idx on fortschritt (kind_id);
create index if not exists fortschritt_kind_fach_idx on fortschritt (kind_id, fach);

alter table fortschritt enable row level security;

-- Lesen: nur Eltern des Kindes
create policy "Eltern lesen Fortschritt ihrer Kinder"
on fortschritt
for select
using (
  auth.uid() = (
    select parent_id from profiles
    where id = kind_id
  )
);

-- Einfügen: nur Eltern des Kindes
create policy "Eltern fuegen Fortschritt ein"
on fortschritt
for insert
with check (
  auth.uid() = (
    select parent_id from profiles
    where id = kind_id
  )
);

-- Löschen: nur Eltern des Kindes (optional)
create policy "Eltern loeschen Fortschritt"
on fortschritt
for delete
using (
  auth.uid() = (
    select parent_id from profiles
    where id = kind_id
  )
);
