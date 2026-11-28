-- Run once in Supabase: SQL Editor > New query > paste > Run

create table if not exists public.members (
  guild_id   text        not null,          -- Discord server id
  user_id    text        not null,          -- Discord user id
  name       text        not null,          -- character name in game
  char_id    text        not null,          -- bunny, dragon, fox, ...
  job        text        not null,          -- Priest, Dark Lord, ...
  level      integer     not null check (level between 1 and 999),
  build      text        not null default '',  -- สายที่เล่น
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

-- Parties made on the party web page (/party)
create table if not exists public.parties (
  id         uuid        primary key default gen_random_uuid(),
  guild_id   text        not null,
  name       text        not null,
  note       text        not null default '',
  members    text[]      not null default '{}',   -- Discord user ids, in slot order
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists parties_guild on public.parties (guild_id, created_at);
alter table public.parties enable row level security;

-- News relay: playtrickster.com/news -> Discord (/news picks the channel)
create table if not exists public.news_seen (url text primary key, seen_at timestamptz not null default now());
create table if not exists public.news_channels (guild_id text primary key, channel_id text not null);
create table if not exists public.app_secrets (name text primary key, value text not null);
alter table public.news_seen enable row level security;
alter table public.news_channels enable row level security;
alter table public.app_secrets enable row level security;
insert into public.app_secrets (name, value)
values ('news_cron', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (name) do nothing;

-- Every 10 minutes, call the bot (change the URL to your Vercel domain).
-- Vercel's free plan only runs its own crons once a day, so Supabase does the timing.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('trickster-news', '*/10 * * * *', $$
  select net.http_post(
    url := 'https://trickster-guild-bot.vercel.app/api/news-cron',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select value from public.app_secrets where name = 'news_cron')),
    body := '{}'::jsonb)
$$);

-- Optional fixed channel for party announcements (otherwise the channel the link came from)
create table if not exists public.party_channels (guild_id text primary key, channel_id text not null);
alter table public.party_channels enable row level security;

-- Dummy characters for the party page: stand-ins that aren't registered members.
-- A party slot holding one stores "dummy:<id>" in parties.members.
create table if not exists public.party_dummies (
  id         uuid        primary key default gen_random_uuid(),
  guild_id   text        not null,
  name       text        not null,
  char_id    text        not null,
  level      integer     not null check (level between 1 and 999),
  build      text        not null default '',
  created_at timestamptz not null default now()
);
create index if not exists party_dummies_guild on public.party_dummies (guild_id, created_at);
alter table public.party_dummies enable row level security;
