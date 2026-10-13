-- CricketGeo persistent player question history and active game reservations.
-- Apply in the Supabase SQL editor or with the Supabase CLI.

create table if not exists public.player_question_history (
  player_id text not null,
  question_id text not null,
  first_played_at timestamptz not null default now(),
  game_id text not null check (char_length(game_id) between 8 and 128),
  last_played_at timestamptz not null default now(),
  cycle_number integer not null default 1,
  primary key (player_id, question_id, cycle_number)
);

create table if not exists public.active_game_reservations (
  player_id text not null,
  game_id text not null check (char_length(game_id) between 8 and 128),
  question_ids jsonb not null,
  cycle_number integer not null default 1,
  reserved_at timestamptz not null default now(),
  completed boolean not null default false,
  primary key (player_id, game_id)
);

create index if not exists player_history_player_idx on public.player_question_history (player_id, cycle_number);
create index if not exists active_reservations_player_idx on public.active_game_reservations (player_id, completed);

alter table public.player_question_history enable row level security;
alter table public.active_game_reservations enable row level security;
-- Server routes using the secret key bypass RLS. No public anon/authenticated policies.
