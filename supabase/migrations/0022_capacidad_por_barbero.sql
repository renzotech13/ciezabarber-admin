-- 0022 — Tres sillas en paralelo, no una.
--
-- Se ejecuta de una sola vez en el SQL editor.
--
-- Hasta ahora el EXCLUDE constraint impedía dos citas solapadas en TODO el
-- local, sin mirar el barbero: si Cieza tenía cliente a las 3pm, nadie podía
-- reservar a las 3pm con Nilton ni con Bryan. Con tres barberos atendiendo a
-- la vez, eso desperdiciaba dos tercios de la capacidad real del negocio.
--
-- A partir de acá el choque es por (barbero, horario): cada barbero tiene su
-- propia línea de tiempo.

-- El operador `=` sobre text dentro de un índice GIST necesita btree_gist
-- (el `&&` de tstzrange ya lo trae GIST de fábrica; la igualdad no).
create extension if not exists btree_gist;

alter table citas drop constraint if exists citas_periodo_excl;

-- `barbero is not null` en el WHERE: una cita sin barbero asignado no puede
-- competir por una silla concreta (NULL nunca es igual a NULL en el operador
-- `=`, así que ni siquiera chocaría consigo misma). Las citas heredadas sin
-- asignar quedan fuera del constraint; el código las trata como si ocuparan
-- a todos (criterio conservador: mejor bloquear de más que doble-reservar
-- una silla que en realidad está ocupada).
alter table citas add constraint citas_periodo_excl
  exclude using gist (barbero with =, periodo with &&)
  where (estado <> 'cancelada' and estado <> 'expirada' and barbero is not null);
