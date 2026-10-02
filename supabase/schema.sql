-- Pinky schema: tables, RLS, triggers, storage.
-- The RPC function bodies (check_in, create_pact, raise_doubt, etc.) live in the
-- Supabase project. Export everything with:  supabase db dump --schema public,private

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  color text not null default '#ff4f8b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now()
);

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references public.profiles(id) on delete cascade,
  addressee uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  check (requester <> addressee)
);
create unique index friendships_pair_idx on public.friendships (least(requester, addressee), greatest(requester, addressee));

create table public.pacts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  emoji text not null default '🤙',
  rules text check (char_length(rules) <= 500),
  goal_type text not null check (goal_type in ('daily','count','weekly')),
  target numeric check (target is null or target > 0),
  unit text check (char_length(unit) <= 20),
  stake_cents int not null default 500 check (stake_cents between 0 and 100000),
  escalating boolean not null default false,
  off_days_per_week int not null default 0 check (off_days_per_week between 0 and 6),
  pot_destination text check (char_length(pot_destination) <= 120),
  start_date date not null,
  end_date date not null,
  timezone text not null default 'America/Toronto',
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table public.pact_members (
  pact_id uuid not null references public.pacts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited','active')),
  invited_by uuid references public.profiles(id) on delete set null,
  starts_on date,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (pact_id, user_id)
);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  pact_id uuid not null references public.pacts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  status text not null check (status in ('kept','broke','off')),
  value numeric,
  note text check (char_length(note) <= 280),
  proof_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pact_id, user_id, day)
);

create table public.doubts (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references public.checkins(id) on delete cascade,
  pact_id uuid not null references public.pacts(id) on delete cascade,
  doubter_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'open' check (status in ('open','proved','confessed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (checkin_id, doubter_id)
);

create table public.reactions (
  checkin_id uuid not null references public.checkins(id) on delete cascade,
  pact_id uuid not null references public.pacts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('😂','🫡','💀','🫶','😤','🔥')),
  created_at timestamptz not null default now(),
  primary key (checkin_id, user_id, emoji)
);

create table public.nudges (
  id uuid primary key default gen_random_uuid(),
  pact_id uuid not null references public.pacts(id) on delete cascade,
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  seen boolean not null default false,
  created_at timestamptz not null default now(),
  unique (pact_id, from_user, to_user, day)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- private config (push secret), not exposed through the API
create schema if not exists private;
create table private.config (key text primary key, value text not null);

-- RLS: reads are scoped to your own pacts; all writes go through RPC functions,
-- except reactions (insert/delete own) and push subscriptions (delete own).
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.pacts enable row level security;
alter table public.pact_members enable row level security;
alter table public.checkins enable row level security;
alter table public.doubts enable row level security;
alter table public.reactions enable row level security;
alter table public.nudges enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "profiles readable by signed in users" on public.profiles for select to authenticated using (true);
create policy "update own profile" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "see own friendships" on public.friendships for select to authenticated using ((select auth.uid()) in (requester, addressee));
create policy "see pacts you are in" on public.pacts for select to authenticated using (public.can_see_pact(id));
create policy "see members of your pacts" on public.pact_members for select to authenticated using (public.can_see_pact(pact_id));
create policy "see checkins in your pacts" on public.checkins for select to authenticated using (public.is_pact_member(pact_id));
create policy "see doubts in your pacts" on public.doubts for select to authenticated using (public.is_pact_member(pact_id));
create policy "see reactions in your pacts" on public.reactions for select to authenticated using (public.is_pact_member(pact_id));
create policy "react in your pacts" on public.reactions for insert to authenticated with check (
  user_id = (select auth.uid()) and public.is_pact_member(pact_id)
  and exists (select 1 from public.checkins c where c.id = checkin_id and c.pact_id = reactions.pact_id));
create policy "remove own reactions" on public.reactions for delete to authenticated using (user_id = (select auth.uid()));
create policy "see your nudges" on public.nudges for select to authenticated using ((select auth.uid()) in (from_user, to_user));
create policy "see own push subs" on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy "delete own push subs" on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));

-- auth triggers: create profile from signup metadata; skip email confirmation
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create trigger on_auth_user_autoconfirm before insert on auth.users for each row execute function public.auto_confirm_user();

-- proof photos: private bucket, path = {pact_id}/{user_id}/{uuid}.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 5242880, array['image/jpeg','image/png','image/webp']);
create policy "pact members can view proofs" on storage.objects for select to authenticated using (
  bucket_id = 'proofs' and exists (select 1 from public.pact_members m
    where m.pact_id::text = (storage.foldername(name))[1] and m.user_id = (select auth.uid()) and m.status = 'active'));
create policy "members upload own proofs" on storage.objects for insert to authenticated with check (
  bucket_id = 'proofs' and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (select 1 from public.pact_members m
    where m.pact_id::text = (storage.foldername(name))[1] and m.user_id = (select auth.uid()) and m.status = 'active'));
