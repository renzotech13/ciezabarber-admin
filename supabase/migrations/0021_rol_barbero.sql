-- 0021 — Rol `barbero`: cada barbero entra al panel con su propio usuario y
-- ve ÚNICAMENTE su agenda, nunca la de sus compañeros.
--
-- Se ejecuta de una sola vez en el SQL editor.
--
-- Criterio de diseño: desde el navegador el barbero solo LEE. Todo cambio
-- (crear, cancelar, reagendar, marcar completada) pasa por el bot, que corre
-- con la service role key y valida en código que la cita sea suya —  así
-- Google Calendar y los avisos por WhatsApp nunca se saltan, y no hace falta
-- darle UPDATE sobre citas (que no se puede limitar por columna sin afectar
-- también al staff, porque ambos son el mismo rol de Postgres).

-- 1. El rol y a qué barbero corresponde la cuenta ---------------------------
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('staff', 'alumna', 'superadmin', 'barbero'));

-- Une la cuenta con su identidad de barbero. Mismos tres nombres que el
-- CHECK de citas.barbero, config/business.ts del bot y booking.js de la web
-- (no hay tabla `barberos` todavía; si se agrega uno, se tocan los 4 sitios).
alter table profiles add column if not exists barbero text
  check (barbero is null or barbero in ('Cieza', 'Nilton', 'Bryan'));

-- 2. Funciones de rol -------------------------------------------------------
-- Un barbero NO es staff: is_staff() sigue devolviendo false para él, así que
-- todo lo que ya estaba protegido (conversaciones, comisiones, costos, otras
-- citas) le queda cerrado sin tocar una sola policy existente.
create or replace function is_barbero()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.profiles where id = auth.uid() and role = 'barbero'
  );
$$;
revoke execute on function is_barbero() from public;
revoke execute on function is_barbero() from anon;

/** A qué barbero corresponde la sesión actual ('Cieza' | 'Nilton' | 'Bryan'). */
create or replace function mi_barbero()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select barbero from public.profiles where id = auth.uid() and role = 'barbero';
$$;
revoke execute on function mi_barbero() from public;
revoke execute on function mi_barbero() from anon;

-- Datos de catálogo que cualquiera del equipo necesita para trabajar y que no
-- son sensibles entre compañeros: la carta, el horario del local, los
-- bloqueos y los productos (los COSTOS de proveedor viven en otra tabla, solo
-- del superadmin — por eso se separaron en la 0019).
create or replace function es_del_equipo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role in ('staff', 'superadmin', 'barbero')
  );
$$;
revoke execute on function es_del_equipo() from public;
revoke execute on function es_del_equipo() from anon;

-- 3. Sus citas, y solo las suyas -------------------------------------------
drop policy if exists "Barbero ve solo sus citas" on citas;
create policy "Barbero ve solo sus citas"
on citas for select to authenticated
using (is_barbero() and barbero is not distinct from mi_barbero());

-- 4. Sus clientes, y solo los suyos ----------------------------------------
-- Puede ver la ficha (preferencias, alergias, notas) de un cliente solo si
-- ese cliente tiene al menos una cita asignada a él. Nada de navegar la
-- cartera completa del negocio.
drop policy if exists "Barbero ve solo sus clientes" on clientes;
create policy "Barbero ve solo sus clientes"
on clientes for select to authenticated
using (
  is_barbero()
  and exists (
    select 1 from public.citas c
    where c.cliente_id = clientes.id and c.barbero is not distinct from mi_barbero()
  )
);

-- 5. Catálogo compartido ----------------------------------------------------
drop policy if exists "Equipo ve services" on services;
create policy "Equipo ve services" on services for select to authenticated using (es_del_equipo());

drop policy if exists "Equipo ve products" on products;
create policy "Equipo ve products" on products for select to authenticated using (es_del_equipo());

drop policy if exists "Equipo ve business_hours" on business_hours;
create policy "Equipo ve business_hours" on business_hours for select to authenticated using (es_del_equipo());

drop policy if exists "Equipo ve bloqueos" on bloqueos;
create policy "Equipo ve bloqueos" on bloqueos for select to authenticated using (es_del_equipo());

-- 6. Registrar la venta de un producto -------------------------------------
-- El barbero que vende una pomada la registra desde su celular, sin pedirle
-- a nadie que lo haga en la tablet. Sigue sin poder LEER ventas_productos
-- (eso es solo del superadmin, en Control): registra a ciegas, igual que el
-- staff de mostrador desde la 0018.
drop policy if exists "Staff inserts ventas_productos" on ventas_productos;
drop policy if exists "Equipo registra ventas_productos" on ventas_productos;
create policy "Equipo registra ventas_productos"
on ventas_productos for insert to authenticated
with check (es_del_equipo() and registrado_por = auth.uid());

-- 7. Cómo dar de alta a un barbero -----------------------------------------
-- Crear el usuario en Authentication → Users (con "Auto confirm user"), y:
--   update profiles
--   set role = 'barbero', barbero = 'Nilton', phone = '51999888777'
--   where id = (select id from auth.users where email = 'nilton@ciezabarber.com');
--
-- `phone` es el celular personal al que le llega el aviso de WhatsApp de una
-- cita nueva suya (formato internacional sin +, igual que clientes.telefono).
