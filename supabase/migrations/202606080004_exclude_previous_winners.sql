create or replace function public.validate_vote_row()
returns trigger
language plpgsql
as $$
declare
  session_record record;
  participant_record record;
  candidate_record record;
  previous_session record;
  previous_winner record;
  tied_winner_count integer;
begin
  select vs.id, vs.status, p.id as position_id, p.eligible_gender, p.order_number
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

  for previous_session in
    select vs.id, vs.position_id
    from public.voting_sessions vs
    join public.positions p on p.id = vs.position_id
    where p.order_number < session_record.order_number
      and vs.status in ('ditutup', 'hasil_diumumkan')
    order by p.order_number
  loop
    select c.id,
           c.participant_id,
           c.name,
           count(v.id)::integer as votes
    into previous_winner
    from public.candidates c
    left join public.votes v
      on v.candidate_id = c.id
     and v.session_id = previous_session.id
    where c.position_id = previous_session.position_id
    group by c.id, c.participant_id, c.name
    order by count(v.id) desc, c.name
    limit 1;

    if previous_winner.id is not null and previous_winner.votes > 0 then
      select count(*)
      into tied_winner_count
      from (
        select c.id,
               count(v.id)::integer as votes
        from public.candidates c
        left join public.votes v
          on v.candidate_id = c.id
         and v.session_id = previous_session.id
        where c.position_id = previous_session.position_id
        group by c.id
      ) ranked
      where ranked.votes = previous_winner.votes;

      if tied_winner_count = 1
         and (
           (
             candidate_record.participant_id is not null
             and previous_winner.participant_id is not null
             and candidate_record.participant_id = previous_winner.participant_id
           )
           or lower(candidate_record.name) = lower(previous_winner.name)
         ) then
        raise exception 'Kandidat ini sudah terpilih pada sesi sebelumnya.';
      end if;
    end if;
  end loop;

  return new;
end;
$$;

notify pgrst, 'reload schema';
