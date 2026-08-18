-- À coller dans Supabase → SQL Editor → New query → Run

create table if not exists app_db (
  id int primary key default 1,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists push_subscriptions (
  affiliate_id text primary key,
  subscription jsonb not null,
  updated_at timestamptz not null default now()
);

alter table app_db enable row level security;
alter table push_subscriptions enable row level security;

create table if not exists postback_daily_stats (
  code text not null,
  date date not null,
  clicks int not null default 0,
  signups int not null default 0,
  ftd int not null default 0,
  deposits numeric not null default 0,
  revenue numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (code, date)
);

create table if not exists postback_log (
  id bigint generated always as identity primary key,
  code text,
  type text,
  amount numeric,
  raw jsonb,
  received_at timestamptz not null default now()
);

alter table postback_daily_stats enable row level security;
alter table postback_log enable row level security;
