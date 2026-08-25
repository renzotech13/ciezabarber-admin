-- Bot de WhatsApp — Fase 2: clientes, horario comercial, bloqueos, citas
-- (con protección real contra doble-reserva vía EXCLUDE constraint),
-- conversaciones y mensajes.

create extension if not exists btree_gist;

create table clientes (
  id uuid primary key default gen_random_uuid(),
  telefono text not null unique,
  nombre text,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clientes_telefono_idx on clientes (telefono);

create table business_hours (
  id uuid primary key default gen_random_uuid(),
  weekday int not null check (weekday between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  constraint business_hours_valid_range check (closes_at > opens_at)
);

create table bloqueos (
  id uuid primary key default gen_random_uuid(),
  inicio_utc timestamptz not null,
  fin_utc timestamptz not null,
  motivo text not null,
  created_at timestamptz not null default now()
);

create type cita_estado as enum ('confirmada','cancelada','completada','no_asistio');
create type cita_origen as enum ('bot','humano');

create table citas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  servicio_id text not null references services(id),
  inicio_utc timestamptz not null,
  fin_utc timestamptz not null,
  estado cita_estado not null default 'confirmada',
  google_event_id text,
  creada_por cita_origen not null default 'bot',
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  periodo tstzrange generated always as (tstzrange(inicio_utc, fin_utc, '[)')) stored,
  constraint citas_fin_despues_inicio check (fin_utc > inicio_utc),
  exclude using gist (periodo with &&) where (estado <> 'cancelada')
);
create index citas_inicio_estado_idx on citas (inicio_utc, estado);

create trigger citas_set_updated_at
before update on citas
for each row execute function set_updated_at();

create trigger clientes_set_updated_at
before update on clientes
for each row execute function set_updated_at();

create table conversaciones (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  ultimo_mensaje_at timestamptz not null default now(),
  estado text not null default 'activa' check (estado in ('activa','escalada','cerrada')),
  created_at timestamptz not null default now()
);

create table mensajes (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references conversaciones(id),
  rol text not null check (rol in ('user','assistant')),
  contenido text not null,
  wa_message_id text,
  created_at timestamptz not null default now()
);
create index mensajes_conversacion_idx on mensajes (conversacion_id, created_at);

-- RLS: estas tablas son solo para el backend del bot (usa la service role
-- key, que ignora RLS por diseño de Supabase). Se habilita RLS sin
-- políticas para anon — deny-all — y solo lectura para authenticated
-- (panel admin futuro), sin escritura todavía.
alter table clientes enable row level security;
alter table business_hours enable row level security;
alter table bloqueos enable row level security;
alter table citas enable row level security;
alter table conversaciones enable row level security;
alter table mensajes enable row level security;

create policy "Authenticated can view clientes" on clientes for select to authenticated using (true);
create policy "Authenticated can view business_hours" on business_hours for select to authenticated using (true);
create policy "Authenticated can view bloqueos" on bloqueos for select to authenticated using (true);
create policy "Authenticated can view citas" on citas for select to authenticated using (true);
create policy "Authenticated can view conversaciones" on conversaciones for select to authenticated using (true);
create policy "Authenticated can view mensajes" on mensajes for select to authenticated using (true);
