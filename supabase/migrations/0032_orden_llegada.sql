-- 0032 — Tabla `configuracion` (ajustes del negocio, una sola fila) + campaña
-- «atención por orden de llegada».
--
-- La tabla `configuracion` la leían el panel (Disponibilidad → Recordatorios) y
-- el bot (`getRecordatorioHorasAntes`), pero ninguna migración la creaba: el bot
-- caía en silencio a la variable de entorno RECORDATORIO_HORAS_ANTES y el editor
-- de recordatorios del panel no tenía dónde guardar. Esta migración la crea.
--
-- Se ejecuta de una sola vez en el SQL editor y es idempotente (se puede correr
-- varias veces, y también si la tabla ya existía a medias).
--
-- Orden de llegada: mientras esté encendido nadie elige hora (ni la web ni el
-- bot). Se enciende y apaga desde el panel (Disponibilidad). El bot y la web
-- funcionan sin estas columnas (modo apagado), así que se puede correr antes o
-- después de publicar.

-- 1. La tabla (una sola fila: `id` solo puede ser true) ----------------------
create table if not exists configuracion (
  id boolean primary key default true check (id),
  -- Horas de antelación del recordatorio de cita. 1 = el mismo valor por
  -- defecto que usaba el bot (env RECORDATORIO_HORAS_ANTES). Si en Railway
  -- está en otro número, cámbialo luego en el panel (Disponibilidad).
  recordatorio_horas_antes int not null default 1 check (recordatorio_horas_antes >= 1),
  updated_at timestamptz not null default now()
);

insert into configuracion (id) values (true) on conflict (id) do nothing;

-- 2. Columnas de la campaña (por si la tabla ya existía sin ellas) -----------
alter table configuracion add column if not exists orden_llegada boolean not null default false;
-- Texto que se le dice a la clienta; vacío = el mensaje por defecto del bot.
alter table configuracion add column if not exists orden_llegada_mensaje text;

-- 3. updated_at automático ---------------------------------------------------
drop trigger if exists configuracion_set_updated_at on configuracion;
create trigger configuracion_set_updated_at
before update on configuracion
for each row execute function set_updated_at();

-- 4. Permisos ----------------------------------------------------------------
-- Desde el navegador: el equipo (staff + barberos) lee; solo el staff cambia.
-- El bot usa la service role key, que se salta RLS.
alter table configuracion enable row level security;

drop policy if exists "Equipo lee la configuracion" on configuracion;
create policy "Equipo lee la configuracion"
on configuracion for select to authenticated using (es_del_equipo());

drop policy if exists "Staff edita la configuracion" on configuracion;
create policy "Staff edita la configuracion"
on configuracion for update to authenticated using (is_staff()) with check (is_staff());

-- 5. Realtime (el panel se actualiza sin recargar) ---------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'configuracion'
     ) then
    alter publication supabase_realtime add table configuracion;
  end if;
end $$;
