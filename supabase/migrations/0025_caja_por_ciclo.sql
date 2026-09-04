-- 0025 — La caja pasa a ser mensual: abre el 16 y cierra el 15.
--
-- El arqueo por turno suelto no servía para este negocio: el mes de caja va
-- del 16 al 15 del mes siguiente, y todo el Control se organiza así. `ciclo`
-- guarda el día en que abre ese periodo ("2026-08-16"), que lo identifica sin
-- ambigüedad y permite una sola caja por mes.
--
-- Se ejecuta de una sola vez en el SQL editor.

alter table caja_sesiones add column if not exists ciclo date;

-- Las cajas que ya existían quedan asignadas al ciclo en el que se abrieron:
-- del 16 en adelante es el ciclo de ese mes; del 1 al 15, el del mes anterior.
update caja_sesiones
   set ciclo = case
         when extract(day from (abierta_at at time zone 'America/Lima')) >= 16
           then (date_trunc('month', (abierta_at at time zone 'America/Lima')))::date + 15
         else (date_trunc('month', (abierta_at at time zone 'America/Lima')) - interval '1 month')::date + 15
       end
 where ciclo is null;

alter table caja_sesiones alter column ciclo set not null;

-- Una sola caja por mes de caja. Si alguien intenta abrir dos veces el mismo
-- ciclo, Postgres lo corta acá y el panel muestra la que ya existe.
create unique index if not exists caja_ciclo_idx on caja_sesiones (ciclo);

-- El día 16 tiene que caer dentro del ciclo que abre: sin esto una fecha
-- cualquiera colaría como ciclo y los totales del periodo no cuadrarían.
alter table caja_sesiones drop constraint if exists caja_ciclo_dia_16;
alter table caja_sesiones add constraint caja_ciclo_dia_16
  check (extract(day from ciclo) = 16);

-- Y se cae la regla de "una sola caja abierta": ahora los totales se calculan
-- por ventana del ciclo, no desde la apertura, así que dejar el mes pasado sin
-- cerrar no puede impedir abrir el nuevo el día 16.
drop index if exists caja_una_abierta_idx;
