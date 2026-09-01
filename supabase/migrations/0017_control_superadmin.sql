-- 0017 — Sección Control (solo superadmin): comisiones de barberos y ventas
-- de productos con stock.
--
-- Se ejecuta de una sola vez en el SQL editor (no toca enums).

-- 1. Rol superadmin ----------------------------------------------------------
-- El dueño ve la parte financiera (comisiones, ventas, stock); el staff normal
-- no. El check original de profiles solo admitía 'staff' | 'alumna'.
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('staff', 'alumna', 'superadmin'));

-- Un superadmin ES staff con más poderes: is_staff() tiene que seguir dando
-- true para él, o al promover la cuenta perdería el acceso a todo el panel
-- (todas las policies del admin dependen de is_staff()).
create or replace function is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role in ('staff', 'superadmin')
  );
$$;

create or replace function is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.profiles where id = auth.uid() and role = 'superadmin'
  );
$$;
revoke execute on function is_superadmin() from public;
revoke execute on function is_superadmin() from anon;

-- Con el rol ya decidiendo quién ve el dinero, la policy de 0003 ("Users can
-- update own profile") se vuelve una escalada de privilegios: cualquier
-- cuenta autenticada podía hacer UPDATE de su propia fila COMPLETA, role
-- incluido, y autoascenderse a superadmin. El grant por columnas deja que
-- cada quien edite su nombre y teléfono, pero role solo se toca desde el SQL
-- editor (como postgres) — la policy de filas sigue igual.
revoke update on profiles from authenticated;
grant update (full_name, phone) on profiles to authenticated;

-- La cuenta inicial del negocio (la misma que 0006 promovió a staff) pasa a
-- superadmin. Para dar el rol a otra cuenta:
--   update profiles set role = 'superadmin'
--   where id = (select id from auth.users where email = 'correo@ejemplo.com');
do $$
begin
  update profiles set role = 'superadmin'
  where id = '587ef0fa-f0a3-47a4-98ba-bff2b9b05f0c';
  if not found then
    raise warning 'Ningún perfil con ese id: asigna el rol a mano (update profiles set role = ''superadmin'' where id = ...)';
  end if;
end $$;

-- 2. Stock de productos ------------------------------------------------------
alter table products add column if not exists stock int not null default 0;
-- Vender más de lo que hay debe fallar, no dejar inventario negativo: con el
-- CHECK, el descuento del trigger revienta y la venta entera se revierte.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_stock_no_negativo') then
    alter table products add constraint products_stock_no_negativo check (stock >= 0);
  end if;
end $$;

-- 3. Ventas de productos -----------------------------------------------------
-- Registro manual: la tienda no tiene pasarela (el pedido se cierra por
-- WhatsApp o en persona), así que cada venta la anota el superadmin y el
-- stock se descuenta solo. Anular la venta (delete) lo repone.
create table if not exists ventas_productos (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references products(id),
  cantidad int not null check (cantidad > 0),
  -- Se congela al vender: si mañana cambia el precio del catálogo, las ventas
  -- pasadas no se recalculan solas.
  precio_unitario numeric not null check (precio_unitario >= 0),
  vendido_at timestamptz not null default now(),
  nota text,
  registrado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists ventas_productos_fecha_idx on ventas_productos (vendido_at);
create index if not exists ventas_productos_producto_idx on ventas_productos (producto_id);

alter table ventas_productos enable row level security;

-- Sin policy de UPDATE a propósito: una venta es inmutable (editarle la
-- cantidad dejaría el stock desincronizado, porque el trigger solo cubre
-- INSERT y DELETE). Para corregir una venta: anular y registrar de nuevo.
drop policy if exists "Superadmin manages ventas_productos" on ventas_productos;
drop policy if exists "Superadmin reads ventas_productos" on ventas_productos;
create policy "Superadmin reads ventas_productos"
on ventas_productos for select to authenticated using (is_superadmin());
drop policy if exists "Superadmin inserts ventas_productos" on ventas_productos;
create policy "Superadmin inserts ventas_productos"
on ventas_productos for insert to authenticated with check (is_superadmin());
drop policy if exists "Superadmin deletes ventas_productos" on ventas_productos;
create policy "Superadmin deletes ventas_productos"
on ventas_productos for delete to authenticated using (is_superadmin());

-- El stock lo mantiene la base, no el cliente: dos escrituras separadas desde
-- el navegador podrían quedarse a medias; el trigger es atómico con la venta.
create or replace function aplicar_venta_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.products set stock = stock - new.cantidad where id = new.producto_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.products set stock = stock + old.cantidad where id = old.producto_id;
    return old;
  end if;
  return null;
end;
$$;
revoke execute on function aplicar_venta_stock() from public;
revoke execute on function aplicar_venta_stock() from anon;

drop trigger if exists ventas_productos_stock on ventas_productos;
create trigger ventas_productos_stock
after insert or delete on ventas_productos
for each row execute function aplicar_venta_stock();
