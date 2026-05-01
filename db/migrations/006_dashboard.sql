-- Dashboard Configuration Table (stores notifications, countdowns, etc.)
create table if not exists dashboard_config (
    id serial primary key,
    key text unique not null,
    value jsonb not null default '{}'::jsonb,
    updated_at timestamp with time zone default now()
);

-- Dashboard Art Table (dynamic art gallery)
create table if not exists dashboard_art (
    id uuid primary key default gen_random_uuid(),
    character_name text not null,
    url text not null,
    label text,
    created_at timestamp with time zone default now()
);

-- Initial config row for notifications and countdowns
insert into dashboard_config (key, value)
values ('global_settings', '{"notification": "", "countdown": {"title": "", "target_date": ""}}'::jsonb)
on conflict (key) do nothing;
