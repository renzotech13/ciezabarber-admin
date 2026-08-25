-- Clon de Raabta: reservas, catálogo de servicios/categorías y productos.
-- No incluye las migraciones específicas de academia/e-learning del proyecto
-- original — Cieza Barber no tiene ese módulo.

create type booking_status as enum ('pending', 'confirmed', 'cancelled', 'completed');

create table bookings (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  service_ids text[] not null default '{}',
  booking_date date not null,
  booking_time text not null,
  first_visit boolean,
  comment text,
  status booking_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bookings_status_idx on bookings (status);
create index bookings_date_idx on bookings (booking_date);

create function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

alter function public.set_updated_at() set search_path = '';

create trigger bookings_set_updated_at
before update on bookings
for each row execute function set_updated_at();

alter table bookings enable row level security;

create policy "Public can create bookings"
on bookings for insert to anon with check (true);

create policy "Authenticated can view bookings"
on bookings for select to authenticated using (true);

create policy "Authenticated can update bookings"
on bookings for update to authenticated using (true) with check (true);

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

create policy "Public can view active service categories"
on service_categories for select to anon using (active = true);
create policy "Public can view active services"
on services for select to anon using (active = true);
create policy "Public can view active products"
on products for select to anon using (active = true);

create policy "Authenticated can manage service categories"
on service_categories for all to authenticated using (true) with check (true);
create policy "Authenticated can manage services"
on services for all to authenticated using (true) with check (true);
create policy "Authenticated can manage products"
on products for all to authenticated using (true) with check (true);

alter table services add column deposit_amount numeric;
alter table services add column duration_minutes int;
