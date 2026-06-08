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
