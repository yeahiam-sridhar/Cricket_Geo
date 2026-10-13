-- CricketGeo global leaderboard. Apply in the Supabase SQL editor or with the Supabase CLI.
create table if not exists public.anonymous_players (
  player_id text primary key check (char_length(player_id) between 12 and 128),
  display_name text not null check (char_length(display_name) between 2 and 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_attempts (
  player_id text not null references public.anonymous_players(player_id) on delete cascade,
  game_id text not null check (char_length(game_id) between 8 and 128),
  round_date date not null,
  question_id text not null,
  score integer not null check (score between 0 and 100),
  recorded_at timestamptz not null default now(),
  primary key (player_id, game_id, question_id)
);

create table if not exists public.completed_games (
  player_id text not null references public.anonymous_players(player_id) on delete cascade,
  game_id text not null check (char_length(game_id) between 8 and 128),
  round_date date not null,
  score integer not null check (score between 0 and 500),
  question_ids jsonb not null,
  completed_at timestamptz not null default now(),
  primary key (player_id, game_id)
);

create index if not exists completed_games_day_score_idx on public.completed_games (round_date, score desc, completed_at asc);
create index if not exists completed_games_score_idx on public.completed_games (score desc, completed_at asc);

alter table public.anonymous_players enable row level security;
alter table public.game_attempts enable row level security;
alter table public.completed_games enable row level security;
-- Intentionally no anon/authenticated policies: only server routes using the
-- service-role key may read or write ranking records.
