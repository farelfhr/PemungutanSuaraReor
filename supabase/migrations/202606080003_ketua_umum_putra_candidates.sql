create or replace function public.prevent_vote_mutation()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'DELETE'
     and current_setting('app.allow_vote_delete', true) = 'on' then
    return old;
  end if;

  raise exception 'Data suara tidak dapat diubah atau dihapus setelah tersimpan.';
end;
$$;

create or replace function public.validate_candidate_row()
returns trigger
language plpgsql
as $$
declare
  position_record public.positions%rowtype;
begin
  select *
  into position_record
  from public.positions
  where id = new.position_id;

  if position_record.id is null then
    raise exception 'Posisi kandidat tidak ditemukan.';
  end if;

  if position_record.name = 'Ketua Umum' and new.gender is distinct from 'putra' then
    raise exception 'Kandidat Ketua Umum wajib berjenis kelamin putra.';
  end if;

  if position_record.name <> 'Ketua Umum'
     and position_record.eligible_gender <> 'all'
     and new.gender is distinct from position_record.eligible_gender then
    raise exception 'Gender kandidat tidak sesuai dengan posisi.';
  end if;

  return new;
end;
$$;

select set_config('app.allow_vote_delete', 'on', true);

delete from public.votes
where candidate_id in (
  select c.id
  from public.candidates c
  join public.positions p on p.id = c.position_id
  where p.name = 'Ketua Umum'
    and c.gender is distinct from 'putra'
);

delete from public.candidates
where id in (
  select c.id
  from public.candidates c
  join public.positions p on p.id = c.position_id
  where p.name = 'Ketua Umum'
    and c.gender is distinct from 'putra'
);

drop trigger if exists validate_candidate_before_write on public.candidates;
create trigger validate_candidate_before_write
before insert or update on public.candidates
for each row execute function public.validate_candidate_row();

notify pgrst, 'reload schema';
