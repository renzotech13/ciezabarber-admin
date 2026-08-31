-- El toggle "Respondo yo" en ChatThread.tsx hace un update directo a
-- conversaciones.estado ('activa' <-> 'escalada'), pero la tabla solo tenía
-- policy de SELECT para staff (0004_rls_security_fix_and_media.sql) — nunca
-- de UPDATE. Postgres con RLS activado y sin policy de update para ese
-- comando simplemente no actualiza ninguna fila (no lanza error), así que
-- el toggle parecía funcionar (el código muestra el toast de éxito sin
-- comprobar filas afectadas) pero el estado real nunca cambiaba.
create policy "Staff can update conversaciones"
on conversaciones for update to authenticated using (is_staff()) with check (is_staff());
