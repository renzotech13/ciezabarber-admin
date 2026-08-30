-- Fase 6 del bot (CRM): el resto del esquema que faltaba. El panel de
-- Conversaciones consulta la vista `conversaciones_resumen` en vez de la
-- tabla `conversaciones` directa (para traer cliente + último mensaje en una
-- sola llamada) y CRM/ClientPanel usa `etiquetas`/`cliente_etiquetas` para
-- clasificar clientes y `notificaciones` para el historial de envíos — nada
-- de esto se había migrado a este proyecto, por eso el panel devolvía 404 en
-- silencio y mostraba "No hay conversaciones" aunque sí hubiera datos.

-- 1. notificaciones: historial de recordatorios/promociones enviados -------
create type tipo_notificacion as enum ('recordatorio_cita', 'promocion');
create type estado_notificacion as enum ('pendiente', 'enviada', 'fallida', 'cancelada');

create table notificaciones (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  cita_id uuid references citas(id),
  tipo tipo_notificacion not null,
  plantilla text not null,
  estado estado_notificacion not null default 'pendiente',
  programada_para timestamptz not null default now(),
  enviada_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);
-- Un barrido de recordatorios concurrente no puede reservar dos veces la
-- misma cita: el segundo choca acá (23505) y no manda nada, en vez de
-- necesitar un chequeo previo en el código.
create unique index notificaciones_cita_tipo_idx on notificaciones (cita_id, tipo) where cita_id is not null;
create index notificaciones_cliente_idx on notificaciones (cliente_id);

alter table notificaciones enable row level security;
create policy "Staff can view notificaciones"
on notificaciones for select to authenticated using (is_staff());
-- Sin policy de insert/update para authenticated: solo el bot (service
-- role) crea y actualiza notificaciones — el panel solo las lee.

-- 2. etiquetas + cliente_etiquetas: clasificación libre de clientes --------
create type etiqueta_color as enum ('slate', 'rose', 'amber', 'emerald', 'sky', 'violet');

create table etiquetas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  color etiqueta_color not null default 'slate',
  created_at timestamptz not null default now()
);

create table cliente_etiquetas (
  cliente_id uuid not null references clientes(id) on delete cascade,
  etiqueta_id uuid not null references etiquetas(id) on delete cascade,
  primary key (cliente_id, etiqueta_id)
);

alter table etiquetas enable row level security;
create policy "Staff can manage etiquetas"
on etiquetas for all to authenticated using (is_staff()) with check (is_staff());

alter table cliente_etiquetas enable row level security;
create policy "Staff can manage cliente_etiquetas"
on cliente_etiquetas for all to authenticated using (is_staff()) with check (is_staff());

-- 3. conversaciones_resumen: vista para el inbox del CRM --------------------
-- security_invoker es necesario: sin esto, Postgres evalúa la vista con los
-- permisos de quien la creó (el rol de las migraciones, que sí puede saltar
-- RLS) en vez de los del usuario que realmente hace la consulta — filtrar
-- por is_staff() en las tablas de abajo no serviría de nada.
create view conversaciones_resumen
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
  cv.ultimo_mensaje_at as actividad_at
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
