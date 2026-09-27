-- Color Hunt: core schema. All game state transitions go through RPCs (0003_rpcs.sql).

create type public.session_status as enum ('lobby', 'choosing_color', 'hunting', 'round_over', 'finished');
create type public.player_status as enum ('waiting', 'searching', 'safe', 'hunter', 'eliminated', 'left');
create type public.round_end_reason as enum ('caught', 'all_safe', 'timeout', 'hunter_left');

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 24),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are readable by signed in users"
  on public.profiles for select to authenticated using (true);

create policy "profiles are editable by their owner"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      'Player ' || left(new.id::text, 4)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Static catalog of colorable map objects (seeded from the client map generator)
-- ---------------------------------------------------------------------------
create table public.map_objects (
  id text primary key,
  kind text not null,
  x double precision not null,
  z double precision not null,
  weight double precision not null default 1
);

alter table public.map_objects enable row level security;

create policy "map objects are readable by signed in users"
  on public.map_objects for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Sessions, players, rounds
-- ---------------------------------------------------------------------------
create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  host_id uuid not null references auth.users (id) on delete cascade,
  status public.session_status not null default 'lobby',
  hunter_id uuid references auth.users (id) on delete set null,
  round_number integer not null default 0,
  current_round_id uuid,
  max_players integer not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index game_sessions_code_idx on public.game_sessions (code) where status <> 'finished';

create table public.session_players (
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  color_index integer not null,
  status public.player_status not null default 'waiting',
  last_seen_at timestamptz not null default now(),
  joined_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create index session_players_user_idx on public.session_players (user_id);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  round_number integer not null,
  hunter_id uuid not null references auth.users (id) on delete cascade,
  color_name text not null,
  color_hex text not null,
  hidden_object_id text not null references public.map_objects (id),
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  ended_at timestamptz,
  end_reason public.round_end_reason,
  caught_player_id uuid references auth.users (id) on delete set null,
  next_hunter_id uuid references auth.users (id) on delete set null
);

create index rounds_session_idx on public.rounds (session_id, round_number desc);

alter table public.game_sessions
  add constraint game_sessions_current_round_fk
  foreign key (current_round_id) references public.rounds (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Membership helper used by RLS, realtime policies and RPCs
-- ---------------------------------------------------------------------------
create function public.is_session_member(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.session_players sp
    where sp.session_id = p_session_id
      and sp.user_id = (select auth.uid())
  );
$$;

alter table public.game_sessions enable row level security;
alter table public.session_players enable row level security;
alter table public.rounds enable row level security;

create policy "members can read their session"
  on public.game_sessions for select to authenticated
  using (public.is_session_member(id));

create policy "members can read session players"
  on public.session_players for select to authenticated
  using (public.is_session_member(session_id));

create policy "members can read session rounds"
  on public.rounds for select to authenticated
  using (public.is_session_member(session_id));
