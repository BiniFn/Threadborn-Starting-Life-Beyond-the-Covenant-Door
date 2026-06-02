-- Banner image and bio for user profiles
alter table users
  add column if not exists banner_url  text        not null default '',
  add column if not exists bio         text        not null default '',
  add column if not exists banner_crop jsonb       not null default '{}'::jsonb;
