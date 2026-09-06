-- 0027 — La caja también se cierra por día, no solo por mes de caja.
--
-- El arqueo diario es el operativo (contar el cajón antes de bajar la
-- cortina); el del 16 al 15 es el de liquidación del periodo. Son dos
-- lecturas del mismo dinero, así que viven en la misma tabla con un `tipo`
-- que dice cuál es, en vez de duplicar el esquema.
--
-- Se ejecuta de una sola vez en el SQL editor.

-- `ciclo` guardaba el día en que abre el periodo. Ahora ese día puede ser el
-- 16 (mes de caja) o cualquier otro (caja de un día), así que el nombre
-- viejo mentía. Postgres arrastra solo el índice y el check al renombrar.
alter table caja_sesiones rename column ciclo to periodo;

alter table caja_sesiones add column if not exists tipo text not null default 'ciclo'
  check (tipo in ('dia', 'ciclo'));

-- El día 16 sigue siendo obligatorio, pero solo para el mes de caja.
alter table caja_sesiones drop constraint if exists caja_ciclo_dia_16;
alter table caja_sesiones add constraint caja_periodo_valido
  check (tipo <> 'ciclo' or extract(day from periodo) = 16);

-- Una sola caja por periodo Y tipo: el mismo día puede tener su arqueo
-- diario y estar dentro del mes de caja abierto, sin pisarse.
drop index if exists caja_ciclo_idx;
create unique index if not exists caja_periodo_idx on caja_sesiones (tipo, periodo);
