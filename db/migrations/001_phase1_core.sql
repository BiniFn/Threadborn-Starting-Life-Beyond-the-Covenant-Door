create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('user', 'admin', 'owner');
  end if;
end $$;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  username text not null unique,
  password_hash text not null,
  role user_role not null default 'user',
  avatar_url text,
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  csrf_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reading_progress (
  user_id uuid not null references users(id) on delete cascade,
  novel_id text not null,
  volume_id text not null,
  chapter_id text not null,
  scroll_position double precision not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, novel_id)
);

create table if not exists bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  novel_id text not null,
  volume_id text not null,
  chapter_id text not null,
  scroll_position double precision not null default 0,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_settings (
  user_id uuid primary key references users(id) on delete cascade,
  settings_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists reading_analytics (
  user_id uuid not null references users(id) on delete cascade,
  novel_id text not null,
  volume_id text not null,
  chapter_id text not null,
  time_spent integer not null default 0,
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, novel_id, chapter_id)
);

create index if not exists idx_users_username on users (username);
create index if not exists idx_users_created_at on users (created_at desc);
create index if not exists idx_sessions_user_id on sessions (user_id);
create index if not exists idx_sessions_expires_at on sessions (expires_at);
create index if not exists idx_reading_progress_user_updated on reading_progress (user_id, updated_at desc);
create index if not exists idx_bookmarks_user_updated on bookmarks (user_id, updated_at desc);
create index if not exists idx_analytics_user_last_read on reading_analytics (user_id, last_read_at desc);
