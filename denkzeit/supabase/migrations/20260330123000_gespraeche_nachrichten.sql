-- Gespräche (eine Zeile pro Lernrunde) + Nachrichten (alle Einzelmessages)
-- In Supabase SQL Editor ausführen, falls noch nicht vorhanden.

create table if not exists gespraeche (
  id uuid default gen_random_uuid() primary key,
  kind_id uuid not null references profiles (id) on delete cascade,
  fach text not null,
  thema text default 'Allgemein',
  gestartet_am timestamptz default now(),
  beendet_am timestamptz,
  anzahl_nachrichten int default 0,
  richtige_antworten int default 0,
  falsche_antworten int default 0,
  stufe_erreicht int default 1 check (stufe_erreicht >= 1 and stufe_erreicht <= 5)
);

create index if not exists gespraeche_kind_id_idx on gespraeche (kind_id);
create index if not exists gespraeche_kind_started_idx on gespraeche (kind_id, gestartet_am desc);

create table if not exists nachrichten (
  id uuid default gen_random_uuid() primary key,
  gespraech_id uuid not null references gespraeche (id) on delete cascade,
  rolle text not null check (rolle in ('user','assistant')),
  inhalt text not null,
  war_richtig boolean,
  created_at timestamptz default now()
);

create index if not exists nachrichten_gespraech_id_idx on nachrichten (gespraech_id);
create index if not exists nachrichten_gespraech_created_idx on nachrichten (gespraech_id, created_at asc);

alter table gespraeche enable row level security;
alter table nachrichten enable row level security;

-- SELECT: nur Eltern des Kindes (über profiles.parent_id)
create policy "Eltern lesen gespraeche ihrer Kinder"
on gespraeche
for select
using (
  auth.uid() = (
    select parent_id from profiles
    where id = kind_id
  )
);

create policy "Eltern lesen nachrichten ihrer Kinder"
on nachrichten
for select
using (
  auth.uid() = (
    select p.parent_id
    from gespraeche g
    join profiles p on p.id = g.kind_id
    where g.id = gespraech_id
  )
);

-- INSERT: nur Eltern des Kindes
create policy "Eltern fuegen gespraeche ein"
on gespraeche
for insert
with check (
  auth.uid() = (
    select parent_id from profiles
    where id = kind_id
  )
);

create policy "Eltern fuegen nachrichten ein"
on nachrichten
for insert
with check (
  auth.uid() = (
    select p.parent_id
    from gespraeche g
    join profiles p on p.id = g.kind_id
    where g.id = gespraech_id
  )
);

-- UPDATE: nur Eltern des Kindes (für Gespräch beenden)
create policy "Eltern updaten gespraeche"
on gespraeche
for update
using (
  auth.uid() = (
    select parent_id from profiles
    where id = kind_id
  )
)
with check (
  auth.uid() = (
    select parent_id from profiles
    where id = kind_id
  )
);

-- DELETE (optional): nur Eltern
create policy "Eltern loeschen gespraeche"
on gespraeche
for delete
using (
  auth.uid() = (
    select parent_id from profiles
    where id = kind_id
  )
);

create policy "Eltern loeschen nachrichten"
on nachrichten
for delete
using (
  auth.uid() = (
    select p.parent_id
    from gespraeche g
    join profiles p on p.id = g.kind_id
    where g.id = gespraech_id
  )
);

