-- 0028 — Cuenta del cliente: login con Google, recompensas y crédito.
--
-- Se ejecuta de una sola vez en el SQL editor.

-- 1. Vincular la cuenta de Google con el cliente ----------------------------
-- Las citas cuelgan del TELÉFONO, no del correo, así que un login de Google
-- por sí solo no sabe qué citas son de quién. Sin verificar el número,
-- cualquiera podría escribir el de otro y ver su historial y cancelarle las
-- citas.
--
-- La verificación va al revés de lo habitual: en vez de mandarle nosotros un
-- código (que fuera de la ventana de 24h de Meta exigiría otra plantilla
-- aprobada), el cliente nos escribe por WhatsApp un código que le damos en
-- la web. El mensaje llega DESDE su número, que es justo la prueba que hace
-- falta, y de paso abre la ventana de conversación.
alter table clientes add column if not exists auth_user_id uuid unique
  references auth.users(id) on delete set null;

create table if not exists verificaciones_cliente (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  -- Se llena recién cuando llega el WhatsApp: al pedir el código todavía no
  -- se sabe (ni hace falta preguntar) desde qué número va a escribir.
  telefono text,
  codigo text not null,
  expira_at timestamptz not null,
  usado_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists verificaciones_cliente_user_idx
  on verificaciones_cliente (auth_user_id, created_at desc);
-- Un código vivo apunta a una sola cuenta: es lo que se busca cuando entra
-- el WhatsApp del cliente.
create unique index if not exists verificaciones_cliente_codigo_idx
  on verificaciones_cliente (codigo) where usado_at is null;
alter table verificaciones_cliente enable row level security;
-- Nadie la lee desde el navegador: la escribe y la valida el bot con la
-- service role key. Sin policies, RLS la deja cerrada para todos.

-- 2. Recompensas por cantidad de cortes -------------------------------------
create table if not exists recompensas (
  id uuid primary key default gen_random_uuid(),
  cortes_requeridos int not null unique check (cortes_requeridos > 0),
  titulo text not null,
  descripcion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into recompensas (cortes_requeridos, titulo, descripcion)
values
  (5,  'Mascarilla gratis', 'A los 5 cortes, una mascarilla facial de cortesía.'),
  (10, 'Corte gratis',      'A los 10 cortes, el siguiente corte va por cuenta de la casa.')
on conflict (cortes_requeridos) do nothing;

alter table recompensas enable row level security;
-- El cliente tiene que poder leerlas para ver su progreso, incluso antes de
-- entrar con Google: son la promesa pública del programa.
drop policy if exists "Cualquiera ve recompensas activas" on recompensas;
create policy "Cualquiera ve recompensas activas"
on recompensas for select to anon, authenticated using (activo);

drop policy if exists "Superadmin gestiona recompensas" on recompensas;
create policy "Superadmin gestiona recompensas"
on recompensas for all to authenticated
using (is_superadmin()) with check (is_superadmin());

-- Qué recompensa ya se entregó. Sin esto el panel del cliente diría "ganaste
-- la mascarilla" para siempre, aunque se la hayan dado hace un mes.
create table if not exists recompensas_canjeadas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  recompensa_id uuid not null references recompensas(id) on delete cascade,
  canjeada_at timestamptz not null default now(),
  registrada_por uuid references auth.users(id) on delete set null,
  unique (cliente_id, recompensa_id)
);
alter table recompensas_canjeadas enable row level security;

drop policy if exists "Staff gestiona canjes" on recompensas_canjeadas;
create policy "Staff gestiona canjes"
on recompensas_canjeadas for all to authenticated
using (is_staff()) with check (is_staff());

drop policy if exists "Cliente ve sus canjes" on recompensas_canjeadas;
create policy "Cliente ve sus canjes"
on recompensas_canjeadas for select to authenticated
using (exists (
  select 1 from public.clientes c
  where c.id = recompensas_canjeadas.cliente_id and c.auth_user_id = auth.uid()
));

-- 3. Crédito a favor --------------------------------------------------------
-- Cancelar deja el monto pagado como saldo, no como devolución. Se guarda
-- como movimientos y no como un número suelto: un saldo sin historia no se
-- puede auditar cuando el cliente reclama.
create table if not exists creditos_cliente (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id) on delete cascade,
  -- Positivo cuando se le acredita, negativo cuando lo usa.
  monto numeric not null check (monto <> 0),
  motivo text not null,
  cita_id uuid references citas(id) on delete set null,
  registrado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists creditos_cliente_idx on creditos_cliente (cliente_id, created_at desc);
alter table creditos_cliente enable row level security;

drop policy if exists "Staff gestiona creditos" on creditos_cliente;
create policy "Staff gestiona creditos"
on creditos_cliente for all to authenticated
using (is_staff()) with check (is_staff());

drop policy if exists "Cliente ve su credito" on creditos_cliente;
create policy "Cliente ve su credito"
on creditos_cliente for select to authenticated
using (exists (
  select 1 from public.clientes c
  where c.id = creditos_cliente.cliente_id and c.auth_user_id = auth.uid()
));

-- 4. Lo que el cliente puede ver de lo suyo ---------------------------------
-- Se suman a las policies del staff (se evalúan con OR), así que no le abren
-- nada a nadie más: cada una exige que la fila sea de quien está entrando.
drop policy if exists "Cliente ve su ficha" on clientes;
create policy "Cliente ve su ficha"
on clientes for select to authenticated using (auth_user_id = auth.uid());

drop policy if exists "Cliente ve sus citas" on citas;
create policy "Cliente ve sus citas"
on citas for select to authenticated
using (exists (
  select 1 from public.clientes c
  where c.id = citas.cliente_id and c.auth_user_id = auth.uid()
));

-- El cliente necesita el nombre y el precio del servicio de su cita. Sin
-- sesión la carta ya es pública (policy de la 0001), pero al entrar con
-- Google pasa a ser `authenticated`, y ahí la única policy que existía era
-- la del equipo — se quedaba sin ver ni el nombre de su propio servicio.
drop policy if exists "Cliente ve la carta" on services;
create policy "Cliente ve la carta"
on services for select to authenticated using (active);
