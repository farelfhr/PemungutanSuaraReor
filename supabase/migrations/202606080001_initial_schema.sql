create extension if not exists pgcrypto;

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  gender text not null check (gender in ('putra', 'putri')),
  division text,
  dormitory text,
  generation text,
  attendance_status text not null default 'belum_hadir'
    check (attendance_status in ('belum_hadir', 'hadir', 'tidak_hadir')),
  is_candidate boolean not null default false,
  is_voter boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  eligible_gender text not null check (eligible_gender in ('all', 'putra', 'putri')),
  order_number integer not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid references public.participants(id) on delete set null,
  name text not null,
  gender text check (gender in ('putra', 'putri')),
  position_id uuid not null references public.positions(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint candidates_position_name_unique unique (position_id, name)
);

create table if not exists public.voting_sessions (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null unique references public.positions(id) on delete cascade,
  status text not null default 'belum_dibuka'
    check (status in ('belum_dibuka', 'berjalan', 'ditutup', 'hasil_diumumkan')),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.voting_sessions(id) on delete restrict,
  participant_id uuid not null references public.participants(id) on delete restrict,
  candidate_id uuid not null references public.candidates(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint votes_session_participant_unique unique (session_id, participant_id)
);

create table if not exists public.voting_devices_state (
  id uuid primary key default gen_random_uuid(),
  device_type text not null unique check (device_type in ('putra', 'putri')),
  session_id uuid references public.voting_sessions(id) on delete set null,
  participant_id uuid references public.participants(id) on delete set null,
  status text not null default 'idle' check (status in ('idle', 'voting')),
  updated_at timestamptz not null default now()
);

insert into public.positions (name, eligible_gender, order_number)
values
  ('Ketua Umum', 'all', 1),
  ('Wakil Ketua Putra 1', 'putra', 2),
  ('Wakil Ketua Putri 1', 'putri', 3),
  ('Wakil Ketua Putri 2', 'putri', 4)
on conflict (name) do update
set eligible_gender = excluded.eligible_gender,
    order_number = excluded.order_number;

insert into public.voting_sessions (position_id, status)
select id, 'belum_dibuka'
from public.positions
on conflict (position_id) do nothing;

insert into public.voting_devices_state (device_type)
values ('putra'), ('putri')
on conflict (device_type) do nothing;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_voting_sessions_updated_at on public.voting_sessions;
create trigger set_voting_sessions_updated_at
before update on public.voting_sessions
for each row execute function public.touch_updated_at();

create or replace function public.validate_vote_row()
returns trigger
language plpgsql
as $$
declare
  session_record record;
  participant_record record;
  candidate_record record;
begin
  select vs.id, vs.status, p.id as position_id, p.eligible_gender
  into session_record
  from public.voting_sessions vs
  join public.positions p on p.id = vs.position_id
  where vs.id = new.session_id;

  if session_record.id is null then
    raise exception 'Sesi voting tidak ditemukan.';
  end if;

  if session_record.status <> 'berjalan' then
    raise exception 'Sesi voting tidak sedang berjalan.';
  end if;

  select *
  into participant_record
  from public.participants
  where id = new.participant_id;

  if participant_record.id is null then
    raise exception 'Peserta tidak ditemukan.';
  end if;

  if participant_record.is_voter is not true then
    raise exception 'Peserta tidak memiliki hak suara.';
  end if;

  if participant_record.attendance_status <> 'hadir' then
    raise exception 'Peserta belum berstatus hadir.';
  end if;

  if session_record.eligible_gender <> 'all'
     and participant_record.gender <> session_record.eligible_gender then
    raise exception 'Peserta tidak berhak memilih pada sesi ini.';
  end if;

  select *
  into candidate_record
  from public.candidates
  where id = new.candidate_id;

  if candidate_record.id is null then
    raise exception 'Kandidat tidak ditemukan.';
  end if;

  if candidate_record.position_id <> session_record.position_id then
    raise exception 'Kandidat tidak sesuai dengan sesi voting.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_vote_before_insert on public.votes;
create trigger validate_vote_before_insert
before insert on public.votes
for each row execute function public.validate_vote_row();

create or replace function public.prevent_vote_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Data suara tidak dapat diubah atau dihapus setelah tersimpan.';
end;
$$;

drop trigger if exists prevent_vote_update on public.votes;
create trigger prevent_vote_update
before update on public.votes
for each row execute function public.prevent_vote_mutation();

drop trigger if exists prevent_vote_delete on public.votes;
create trigger prevent_vote_delete
before delete on public.votes
for each row execute function public.prevent_vote_mutation();

create or replace function public.submit_vote(
  p_session_id uuid,
  p_participant_id uuid,
  p_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.votes (session_id, participant_id, candidate_id)
  values (p_session_id, p_participant_id, p_candidate_id);

  update public.voting_sessions
  set updated_at = now()
  where id = p_session_id;

  return jsonb_build_object('ok', true, 'message', 'Suara berhasil direkam.');
exception
  when unique_violation then
    raise exception 'Peserta sudah memilih pada sesi ini.';
end;
$$;

create or replace function public.open_voting_session(p_session_id uuid)
returns public.voting_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  target_session public.voting_sessions%rowtype;
  target_order integer;
  blocked_previous integer;
  running_count integer;
begin
  select *
  into target_session
  from public.voting_sessions
  where id = p_session_id;

  select p.order_number
  into target_order
  from public.positions p
  join public.voting_sessions vs on vs.position_id = p.id
  where vs.id = p_session_id;

  if target_session.id is null then
    raise exception 'Sesi voting tidak ditemukan.';
  end if;

  if target_session.status <> 'belum_dibuka' then
    raise exception 'Sesi ini tidak bisa dibuka dari status saat ini.';
  end if;

  select count(*)
  into running_count
  from public.voting_sessions
  where status = 'berjalan';

  if running_count > 0 then
    raise exception 'Masih ada sesi lain yang sedang berjalan.';
  end if;

  select count(*)
  into blocked_previous
  from public.voting_sessions vs
  join public.positions p on p.id = vs.position_id
  where p.order_number < target_order
    and vs.status not in ('ditutup', 'hasil_diumumkan');

  if blocked_previous > 0 then
    raise exception 'Sesi sebelumnya harus ditutup terlebih dahulu.';
  end if;

  update public.voting_sessions
  set status = 'berjalan',
      started_at = now(),
      ended_at = null
  where id = p_session_id
  returning * into target_session;

  return target_session;
end;
$$;

create or replace function public.close_voting_session(p_session_id uuid)
returns public.voting_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_session public.voting_sessions%rowtype;
begin
  update public.voting_sessions
  set status = 'ditutup',
      ended_at = coalesce(ended_at, now())
  where id = p_session_id
    and status = 'berjalan'
  returning * into updated_session;

  if updated_session.id is null then
    raise exception 'Sesi hanya dapat ditutup ketika sedang berjalan.';
  end if;

  return updated_session;
end;
$$;

create or replace function public.announce_session_results(p_session_id uuid)
returns public.voting_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_session public.voting_sessions%rowtype;
begin
  update public.voting_sessions
  set status = 'hasil_diumumkan'
  where id = p_session_id
    and status in ('ditutup', 'hasil_diumumkan')
  returning * into updated_session;

  if updated_session.id is null then
    raise exception 'Hasil hanya dapat diumumkan setelah sesi ditutup.';
  end if;

  return updated_session;
end;
$$;

alter table public.participants enable row level security;
alter table public.positions enable row level security;
alter table public.candidates enable row level security;
alter table public.voting_sessions enable row level security;
alter table public.votes enable row level security;
alter table public.voting_devices_state enable row level security;

drop policy if exists "Public read participants" on public.participants;
create policy "Public read participants"
on public.participants for select
to anon, authenticated
using (true);

drop policy if exists "Public read positions" on public.positions;
create policy "Public read positions"
on public.positions for select
to anon, authenticated
using (true);

drop policy if exists "Public read candidates" on public.candidates;
create policy "Public read candidates"
on public.candidates for select
to anon, authenticated
using (true);

drop policy if exists "Public read sessions" on public.voting_sessions;
create policy "Public read sessions"
on public.voting_sessions for select
to anon, authenticated
using (true);

drop policy if exists "Public read device state" on public.voting_devices_state;
create policy "Public read device state"
on public.voting_devices_state for select
to anon, authenticated
using (true);

revoke all on function public.open_voting_session(uuid) from public;
revoke all on function public.close_voting_session(uuid) from public;
revoke all on function public.announce_session_results(uuid) from public;
grant execute on function public.open_voting_session(uuid) to service_role;
grant execute on function public.close_voting_session(uuid) to service_role;
grant execute on function public.announce_session_results(uuid) to service_role;

revoke all on function public.submit_vote(uuid, uuid, uuid) from public;
grant execute on function public.submit_vote(uuid, uuid, uuid) to anon, authenticated, service_role;

do $$
begin
  alter publication supabase_realtime add table public.participants;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.positions;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.candidates;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.voting_sessions;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.voting_devices_state;
exception when duplicate_object then null;
end $$;
