-- Fase 3: catálogo de servicios (categorías + servicios) y productos, leído por
-- salon.html, reserva.html e index.html en vez de arreglos hardcodeados.

create table service_categories (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  icon text not null,
  title text not null,
  description text not null,
  images text[] not null default '{}',
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table services (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- Debe coincidir con los valores ya guardados en bookings.service_ids (Fase 1);
  -- nunca reutilizar ni renombrar ids de servicios existentes.
  category_id text not null references service_categories(id) on delete restrict,
  booking_group text not null check (booking_group in ('Principales', 'Complementarios', 'Opcionales')),
  name text not null,
  duration text not null default '—',
  price text not null,
  description text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index services_category_id_idx on services (category_id);
create index services_booking_group_idx on services (booking_group);
create index services_active_idx on services (active);

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric not null,
  description text not null default '',
  image_url text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_active_idx on products (active);

create trigger service_categories_set_updated_at
before update on service_categories
for each row execute function set_updated_at();

create trigger services_set_updated_at
before update on services
for each row execute function set_updated_at();

create trigger products_set_updated_at
before update on products
for each row execute function set_updated_at();

alter table service_categories enable row level security;
alter table services enable row level security;
alter table products enable row level security;

-- Público (clave anon): solo lectura, y solo filas activas.
create policy "Public can view active service categories"
on service_categories for select to anon using (active = true);
create policy "Public can view active services"
on services for select to anon using (active = true);
create policy "Public can view active products"
on products for select to anon using (active = true);

-- Panel admin (autenticado): control total, incluidas filas archivadas.
create policy "Authenticated can manage service categories"
on service_categories for all to authenticated using (true) with check (true);
create policy "Authenticated can manage services"
on services for all to authenticated using (true) with check (true);
create policy "Authenticated can manage products"
on products for all to authenticated using (true) with check (true);
