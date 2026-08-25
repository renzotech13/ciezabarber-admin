-- Fase 0/1: tabla de reservas reales (reemplaza la confirmación falsa de reserva.html)

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

create trigger bookings_set_updated_at
before update on bookings
for each row execute function set_updated_at();

alter table bookings enable row level security;

-- El sitio público (clave anon) solo puede crear reservas, nunca leerlas ni modificarlas.
create policy "Public can create bookings"
on bookings for insert
to anon
with check (true);

-- Solo un usuario autenticado (el panel admin) puede ver y actualizar el estado.
create policy "Authenticated can view bookings"
on bookings for select
to authenticated
using (true);

create policy "Authenticated can update bookings"
on bookings for update
to authenticated
using (true)
with check (true);
