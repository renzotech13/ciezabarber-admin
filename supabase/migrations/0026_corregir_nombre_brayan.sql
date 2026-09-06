-- 0026 — Corregir el nombre: es "Brayan", no "Bryan".
--
-- El nombre estaba mal escrito desde la 0011: no es solo una etiqueta de
-- pantalla, es el valor literal guardado en citas.barbero y profiles.barbero
-- (los CHECK que fijan los 3 nombres válidos), así que corregirlo en el
-- código sin tocar la base dejaría "Bryan" viviendo en la BD mientras el
-- panel y el bot ya hablan de "Brayan" — cero coincidencias, agenda vacía.
--
-- Se ejecuta de una sola vez en el SQL editor.

-- Los CHECK quedaron sin nombre explícito al crearse (0011 y 0021), así que
-- Postgres les puso el nombre por defecto <tabla>_<columna>_check.
alter table citas drop constraint if exists citas_barbero_check;
alter table profiles drop constraint if exists profiles_barbero_check;

-- Los datos ya cargados con el nombre mal escrito.
update citas set barbero = 'Brayan' where barbero = 'Bryan';
update profiles set barbero = 'Brayan' where barbero = 'Bryan';

alter table citas add constraint citas_barbero_check
  check (barbero in ('Cieza', 'Nilton', 'Brayan'));
alter table profiles add constraint profiles_barbero_check
  check (barbero is null or barbero in ('Cieza', 'Nilton', 'Brayan'));
