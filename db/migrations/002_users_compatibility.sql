do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='users') then
    begin
      alter table users add column if not exists username text;
    exception when undefined_table then
      null;
    end;

    begin
      alter table users add column if not exists role user_role not null default 'user';
    exception when undefined_object then
      -- enum may not exist in legacy db yet
      null;
    end;

    alter table users add column if not exists verified boolean not null default false;
    alter table users add column if not exists avatar_url text;
    alter table users add column if not exists created_at timestamptz not null default now();
    alter table users add column if not exists updated_at timestamptz not null default now();
    alter table users add column if not exists password_hash text;
  end if;
end $$;

update users
set username = lower(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9_]', '_', 'g'))
where (username is null or username = '')
  and email is not null;

-- Keep usernames unique if generated duplicates appear.
with dupes as (
  select id, username,
         row_number() over (partition by username order by created_at, id) as rn
  from users
  where username is not null and username <> ''
)
update users u
set username = u.username || '_' || substring(u.id::text, 1, 6)
from dupes d
where u.id = d.id and d.rn > 1;

create unique index if not exists idx_users_username_unique on users(username);
