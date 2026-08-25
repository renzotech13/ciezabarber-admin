-- El motor de disponibilidad del bot necesita la duración en minutos como
-- número; `duration` sigue siendo texto libre para mostrar en el sitio
-- ("2h", "1h 30min", "—").
alter table services add column duration_minutes int;

update services set duration_minutes = 120 where id in
  ('microblading', 'micro-cejas', 'rejuvenecimiento', 'manicure', 'pestanas-pelo-a-pelo');
update services set duration_minutes = 180 where id = 'micro-labios';
update services set duration_minutes = 60 where id in
  ('delineado', 'hidralips', 'planing', 'lifting');
update services set duration_minutes = 90 where id in ('faciales', 'pedicure');
update services set duration_minutes = 30 where id in ('depilacion', 'henna', 'pestanas-1x1');
