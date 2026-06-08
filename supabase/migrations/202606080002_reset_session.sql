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

create or replace function public.reset_voting_session(p_session_id uuid)
returns public.voting_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  reset_session public.voting_sessions%rowtype;
begin
  select *
  into reset_session
  from public.voting_sessions
  where id = p_session_id;

  if reset_session.id is null then
    raise exception 'Sesi voting tidak ditemukan.';
  end if;

  perform set_config('app.allow_vote_delete', 'on', true);

  delete from public.votes
  where session_id = p_session_id;

  update public.voting_devices_state
  set session_id = null,
      participant_id = null,
      status = 'idle',
      updated_at = now()
  where session_id = p_session_id;

  update public.voting_sessions
  set status = 'belum_dibuka',
      started_at = null,
      ended_at = null
  where id = p_session_id
  returning * into reset_session;

  return reset_session;
end;
$$;

revoke all on function public.reset_voting_session(uuid) from public;
grant execute on function public.reset_voting_session(uuid) to service_role;

notify pgrst, 'reload schema';
