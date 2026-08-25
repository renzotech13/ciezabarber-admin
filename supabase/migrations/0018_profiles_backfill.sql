-- Backfill: el staff que ya existía antes de la tabla profiles no pasó por
-- el trigger on_auth_user_created. Sin esto, is_staff() le devolvería false
-- y perdería acceso al panel en cuanto se aplique la corrección de RLS.

insert into profiles (id, role)
values ('f26e9b1b-bdb0-4279-93d4-45989965a3c1', 'staff')
on conflict (id) do update set role = 'staff';
