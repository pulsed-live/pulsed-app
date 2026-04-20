-- Pulsed: Porchfest Pilot Schema
-- Run this in your Supabase SQL editor

create table if not exists venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lat float8 not null,
  lng float8 not null,
  address text not null,
  created_at timestamptz default now()
);

create table if not exists acts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  genre text not null,
  created_at timestamptz default now()
);

create table if not exists sets (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid references venues(id) on delete cascade not null,
  act_id uuid references acts(id) on delete cascade not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'running_late', 'cancelled')),
  created_at timestamptz default now()
);

-- Allow public read access (attendees see the map without auth)
alter table venues enable row level security;
alter table acts enable row level security;
alter table sets enable row level security;

create policy "Public read venues" on venues for select using (true);
create policy "Public read acts" on acts for select using (true);
create policy "Public read sets" on sets for select using (true);

-- Admin writes via service role key (used in API routes, not client)
create policy "Service role full access venues" on venues using (auth.role() = 'service_role');
create policy "Service role full access acts" on acts using (auth.role() = 'service_role');
create policy "Service role full access sets" on sets using (auth.role() = 'service_role');
