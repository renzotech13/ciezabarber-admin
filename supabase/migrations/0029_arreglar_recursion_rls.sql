-- 0029 — Arreglar la recursión infinita que dejó la 0028.
--
-- URGENTE: mientras esto no corra, el panel no puede leer citas ni clientes.
--
-- Qué pasó: la 0028 puso en `citas` una policy que consulta `clientes`, y en
-- `clientes` ya existía desde la 0021 una (la del barbero) que consulta
-- `citas`. Postgres evalúa una, que dispara la otra, que dispara la primera:
-- detecta el ciclo y ABORTA la consulta con error 42P17. No es que devuelva
-- menos filas — revienta, y se lleva puesto todo lo que lea esas dos tablas
-- con sesión iniciada. Control, Reservas y las fichas quedaron en blanco.
--
-- El arreglo: que las policies del cliente no crucen de tabla. Una función
-- SECURITY DEFINER resuelve "quién soy" saltándose RLS —igual que
-- is_staff() o mi_barbero(), que existen por esta misma razón— y las
-- policies pasan a comparar contra un valor, sin subconsulta.
--
-- Se ejecuta de una sola vez en el SQL editor.

create or replace function mi_cliente_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.clientes where auth_user_id = auth.uid() limit 1;
$$;
revoke execute on function mi_cliente_id() from public;
revoke execute on function mi_cliente_id() from anon;

-- Las tres policies de la 0028 que cruzaban a `clientes`, sin cruzar.
drop policy if exists "Cliente ve sus citas" on citas;
create policy "Cliente ve sus citas"
on citas for select to authenticated
using (cliente_id = mi_cliente_id());

drop policy if exists "Cliente ve su credito" on creditos_cliente;
create policy "Cliente ve su credito"
on creditos_cliente for select to authenticated
using (cliente_id = mi_cliente_id());

drop policy if exists "Cliente ve sus canjes" on recompensas_canjeadas;
create policy "Cliente ve sus canjes"
on recompensas_canjeadas for select to authenticated
using (cliente_id = mi_cliente_id());

-- La de `clientes` no cruza a ninguna tabla, así que no entra en el ciclo y
-- se queda como está: auth_user_id = auth.uid().
