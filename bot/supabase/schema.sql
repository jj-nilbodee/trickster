-- Run once in Supabase: SQL Editor > New query > paste > Run

create table if not exists public.members (
  guild_id   text        not null,          -- Discord server id
  user_id    text        not null,          -- Discord user id
  name       text        not null,          -- character name in game
  char_id    text        not null,          -- bunny, dragon, fox, ...
  job        text        not null,          -- Priest, Dark Lord, ...
  level      integer     not null check (level between 1 and 999),
  updated_at timestamptz not null default now(),
  primary key (guild_id, user_id)
);

-- One character name per server, ignoring upper/lower case
create unique index if not exists members_guild_name on public.members (guild_id, lower(name));
create index if not exists members_guild_level on public.members (guild_id, level desc);

-- The bot uses the service role key, which skips RLS.
-- RLS stays on with no policies so the public anon key cannot read or change anything.
-- When the guild web app is built, add read policies here.
alter table public.members enable row level security;
