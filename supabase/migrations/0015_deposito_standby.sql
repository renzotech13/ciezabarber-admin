-- 0015 — Adelanto del 50% con reserva en stand-by.
--
-- Requiere que el 0014 ya esté aplicado (y COMMITEADO, en una ejecución
-- aparte del SQL editor): acá se usan los valores 'pendiente_pago' y
-- 'expirada' del enum cita_estado.
--
-- Modelo: una cita con adelanto nace en 'pendiente_pago'. Ocupa el horario
-- igual que una confirmada (el EXCLUDE constraint la cuenta), así que nadie
-- más lo puede tomar, pero no está agendada de verdad. Si el comprobante no
-- llega dentro de la ventana, pasa a 'expirada' y el horario se libera.

-- 1. Columnas del comprobante -----------------------------------------------
-- Existen en producción desde la fase de comprobantes pero nunca tuvieron
-- archivo de migración; van acá idempotentes para que un ambiente nuevo
-- (o una restauración) quede igual que producción.
alter table citas add column if not exists comprobante_estado text not null default 'sin_comprobante';
alter table citas add column if not exists comprobante_path text;
alter table citas add column if not exists comprobante_monto_detectado numeric;
alter table citas add column if not exists comprobante_nota text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'citas_comprobante_estado_check') then
    alter table citas add constraint citas_comprobante_estado_check
      check (comprobante_estado in ('sin_comprobante','confirmado','en_revision'));
  end if;
end $$;

-- 2. Columnas del adelanto ---------------------------------------------------
-- deposito_esperado se congela al reservar: si mañana sube el precio del
-- servicio, el monto que se le pidió a este cliente no cambia debajo suyo.
alter table citas add column if not exists deposito_esperado numeric;
-- Arranca el reloj: aviso a los 5 min, liberación a los 10. Se pone en null
-- cuando el cliente sí mandó algo y quedó en revisión de un humano — desde
-- ese momento la cita ya no expira sola.
alter table citas add column if not exists deposito_solicitado_at timestamptz;
alter table citas add column if not exists deposito_aviso_at timestamptz;
alter table citas add column if not exists deposito_expirado_at timestamptz;

-- 3. El horario se libera al expirar -----------------------------------------
-- El EXCLUDE original excluía solo 'cancelada'. Una cita expirada tiene que
-- dejar el hueco libre igual que una cancelada, si no el stand-by bloquearía
-- el horario para siempre.
do $$
declare
  nombre text;
begin
  select conname into nombre
  from pg_constraint
  where conrelid = 'citas'::regclass and contype = 'x';

  if nombre is not null then
    execute format('alter table citas drop constraint %I', nombre);
  end if;
end $$;

alter table citas add constraint citas_periodo_excl
  exclude using gist (periodo with &&) where (estado <> 'cancelada' and estado <> 'expirada');

-- 4. Barrido cada minuto ------------------------------------------------------
create index if not exists citas_deposito_pendiente_idx
  on citas (deposito_solicitado_at)
  where estado = 'pendiente_pago';
