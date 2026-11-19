-- 0034 — WhatsApp por QR (Baileys, NO oficial de Meta): vincular un número cualquiera desde el panel
-- (Conversaciones → WhatsApp por QR), además del número oficial del bot.
--
-- Se ejecuta de una sola vez en el SQL editor. Idempotente.

-- 1. La sesión del número vinculado ------------------------------------------------
-- Guarda las llaves de cifrado de la sesión de WhatsApp para que sobreviva a los reinicios y despliegues del bot.
-- RLS activa y SIN políticas: solo la service role (el bot) la lee o escribe; el panel y el navegador nunca la ven.
create table if not exists whatsapp_qr_sesion (
  clave text primary key,
  valor text not null,
  updated_at timestamptz not null default now()
);

alter table whatsapp_qr_sesion enable row level security;
revoke all on whatsapp_qr_sesion from anon, authenticated;

comment on table whatsapp_qr_sesion is
  'Sesión de WhatsApp vinculada por QR (Baileys): credenciales y llaves Signal. Solo la service role la usa; no crear políticas.';

-- 2. Por qué número escribió cada cliente -----------------------------------------
-- 'api' = el número oficial del bot; 'qr' = el vinculado por QR. La respuesta (bot o panel) sale por el mismo.
alter table conversaciones add column if not exists canal text not null default 'api';
alter table conversaciones drop constraint if exists conversaciones_canal_check;
alter table conversaciones add constraint conversaciones_canal_check check (canal in ('api', 'qr'));

-- 3. ¿El bot contesta en el número vinculado? -------------------------------------
-- Apagado por defecto: puede ser un número personal. Se cambia desde el panel.
alter table configuracion add column if not exists qr_bot_responde boolean not null default false;

-- 4. El inbox muestra por qué número escribió cada cliente --------------------------
-- Misma vista que la 0010, con `canal` al final (create or replace solo permite agregar columnas al final).
create or replace view conversaciones_resumen
with (security_invoker = true) as
select
  cv.id,
  cv.cliente_id,
  cv.estado,
  cv.created_at,
  c.nombre as cliente_nombre,
  c.telefono as cliente_telefono,
  m.contenido as ultimo_contenido,
  m.rol as ultimo_rol,
  cv.ultimo_mensaje_at,
  cv.ultimo_mensaje_at as actividad_at,
  cv.canal
from conversaciones cv
join clientes c on c.id = cv.cliente_id
left join lateral (
  select contenido, rol
  from mensajes
  where mensajes.conversacion_id = cv.id
  order by created_at desc
  limit 1
) m on true;

grant select on conversaciones_resumen to authenticated;
