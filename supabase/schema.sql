create extension if not exists pgcrypto;

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  played_at timestamptz not null,
  target_score integer not null check (target_score in (11, 15, 18)),
  team_a_name text not null default 'Dein Team',
  team_a_players text[] not null check (cardinality(team_a_players) = 2),
  team_b_name text not null default 'Gegner',
  team_b_players text[] not null check (cardinality(team_b_players) = 2),
  rounds jsonb not null default '[]'::jsonb,
  final_total_a integer not null,
  final_total_b integer not null,
  winner_team text not null check (winner_team in ('A', 'B')),
  stake_amount numeric(12,2),
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists games_user_id_played_at_idx on public.games (user_id, played_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists games_set_updated_at on public.games;
create trigger games_set_updated_at
before update on public.games
for each row
execute function public.set_updated_at();

alter table public.games enable row level security;

drop policy if exists "games_select_own" on public.games;
create policy "games_select_own"
on public.games
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "games_insert_own" on public.games;
create policy "games_insert_own"
on public.games
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "games_update_own" on public.games;
create policy "games_update_own"
on public.games
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "games_delete_own" on public.games;
create policy "games_delete_own"
on public.games
for delete
to authenticated
using ((select auth.uid()) = user_id);
