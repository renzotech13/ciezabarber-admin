-- 0023 — Abrir y cerrar caja (arqueo del turno).
--
-- Se ejecuta de una sola vez en el SQL editor.

create table if not exists caja_sesiones (
  id uuid primary key default gen_random_uuid(),
  -- Con cuánto efectivo arranca el turno (el fondo o sencillo de la caja).
  monto_inicial numeric not null default 0 check (monto_inicial >= 0),
  abierta_at timestamptz not null default now(),
  abierta_por uuid references auth.users(id) on delete set null,
  -- Lo que se contó de verdad al cerrar. null = la caja sigue abierta.
  monto_contado numeric check (monto_contado >= 0),
  cerrada_at timestamptz,
  cerrada_por uuid references auth.users(id) on delete set null,
  nota text,
  created_at timestamptz not null default now(),
  -- O está abierta (sin cerrar nada) o está cerrada del todo: una caja a
  -- medio cerrar no significa nada para un arqueo.
  constraint caja_cierre_completo check (
    (cerrada_at is null and monto_contado is null and cerrada_por is null)
    or (cerrada_at is not null and monto_contado is not null)
  )
);

-- Una sola caja abierta a la vez: si no, dos turnos solapados se reparten
-- las mismas ventas y ninguno cuadra.
create unique index if not exists caja_una_abierta_idx
  on caja_sesiones ((cerrada_at is null))
  where cerrada_at is null;

create index if not exists caja_sesiones_abierta_idx on caja_sesiones (abierta_at desc);

alter table caja_sesiones enable row level security;

-- Solo el dueño: la caja vive en Control, junto al resto del dinero.
drop policy if exists "Superadmin manages caja" on caja_sesiones;
create policy "Superadmin manages caja"
on caja_sesiones for all to authenticated
using (is_superadmin()) with check (is_superadmin());
