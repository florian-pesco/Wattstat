create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  email text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

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

alter table public.games
  add column if not exists team_a_player_1_profile_id uuid references auth.users (id) on delete set null,
  add column if not exists first_round_schlag_seat text check (first_round_schlag_seat in ('A1', 'B1', 'A2', 'B2')),
  add column if not exists first_round_trumpf_seat text check (first_round_trumpf_seat in ('A1', 'B1', 'A2', 'B2'));

create index if not exists games_user_id_played_at_idx on public.games (user_id, played_at desc);

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

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  order_index integer not null,
  winner_team text not null check (winner_team in ('A', 'B')),
  points_awarded integer not null,
  round_type text not null check (round_type in ('normal', 'penalty')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (game_id, order_index)
);

create index if not exists rounds_game_id_order_idx on public.rounds (game_id, order_index);

alter table public.rounds enable row level security;

drop policy if exists "rounds_select_own" on public.rounds;
create policy "rounds_select_own"
on public.rounds
for select
to authenticated
using (
  exists (
    select 1
    from public.games
    where public.games.id = public.rounds.game_id
      and public.games.user_id = (select auth.uid())
  )
);

drop policy if exists "rounds_insert_own" on public.rounds;
create policy "rounds_insert_own"
on public.rounds
for insert
to authenticated
with check (
  exists (
    select 1
    from public.games
    where public.games.id = public.rounds.game_id
      and public.games.user_id = (select auth.uid())
  )
);

drop policy if exists "rounds_update_own" on public.rounds;
create policy "rounds_update_own"
on public.rounds
for update
to authenticated
using (
  exists (
    select 1
    from public.games
    where public.games.id = public.rounds.game_id
      and public.games.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.games
    where public.games.id = public.rounds.game_id
      and public.games.user_id = (select auth.uid())
  )
);

drop policy if exists "rounds_delete_own" on public.rounds;
create policy "rounds_delete_own"
on public.rounds
for delete
to authenticated
using (
  exists (
    select 1
    from public.games
    where public.games.id = public.rounds.game_id
      and public.games.user_id = (select auth.uid())
  )
);

insert into public.rounds (id, game_id, order_index, winner_team, points_awarded, round_type, created_at)
select
  coalesce((entry.value ->> 'id')::uuid, gen_random_uuid()),
  g.id,
  coalesce((entry.value ->> 'orderIndex')::integer, entry.ordinality::integer),
  (entry.value ->> 'team')::text,
  coalesce((entry.value ->> 'pointsAwarded')::integer, 0),
  coalesce((entry.value ->> 'type')::text, 'normal'),
  coalesce((entry.value ->> 'createdAt')::timestamptz, g.played_at)
from public.games g
cross join lateral jsonb_array_elements(g.rounds) with ordinality as entry(value, ordinality)
on conflict (id) do nothing;
