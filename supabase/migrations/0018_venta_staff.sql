-- 0018 — El staff (no solo el superadmin) puede registrar una venta de
-- producto, sin ver plata: ni el libro de comisiones, ni el costo del
-- proveedor, ni el historial de ventas de otros.
--
-- Se ejecuta de una sola vez en el SQL editor.

-- INSERT para cualquier staff (is_staff() = staff o superadmin), no solo
-- superadmin. registrado_por queda forzado al propio uid en la policy: nadie
-- puede registrar una venta a nombre de otro usuario.
drop policy if exists "Superadmin inserts ventas_productos" on ventas_productos;
drop policy if exists "Staff inserts ventas_productos" on ventas_productos;
create policy "Staff inserts ventas_productos"
on ventas_productos for insert to authenticated
with check (is_staff() and registrado_por = auth.uid());

-- SELECT/UPDATE/DELETE siguen solo para superadmin (ya estaban así en 0017):
-- el staff registra "a ciegas" — inserta y no puede leer de vuelta el
-- historial ni anular nada, así que nunca ve cuánto vendió otro compañero ni
-- el total de ingresos. Es justo el mecanismo que impide que vea "los otros
-- precios": no tiene ningún SELECT sobre esta tabla.
