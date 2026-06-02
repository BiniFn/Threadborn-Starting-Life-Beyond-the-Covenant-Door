alter table users
  add column if not exists community_banned_until timestamptz,
  add column if not exists community_ban_reason text;

alter table posts
  drop constraint if exists posts_category_check;

alter table posts
  add constraint posts_category_check
  check (category in ('chat', 'fan_art', 'theory', 'spoiler')) not valid;

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists likes (
  user_id uuid not null references users(id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index if not exists idx_comments_post_created
  on comments(post_id, created_at asc);

create index if not exists idx_comments_user_created
  on comments(user_id, created_at desc);

create index if not exists idx_likes_post
  on likes(post_id);
