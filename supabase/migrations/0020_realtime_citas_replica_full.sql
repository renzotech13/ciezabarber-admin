-- 0020 — REPLICA IDENTITY FULL en citas: necesario para el aviso en vivo de
-- reservas nuevas en el panel.
--
-- Se ejecuta de una sola vez en el SQL editor.

-- Por defecto, Postgres solo manda la primary key en el "old record" de un
-- UPDATE de replicación lógica (que es lo que usa Supabase Realtime). El
-- panel necesita comparar old.estado vs new.estado para distinguir "esta
-- cita recién se confirmó" de "se editó algo más en una cita que ya estaba
-- confirmada" (p. ej. reasignar el barbero) — sin esto, el segundo caso
-- también dispararía el aviso de "nueva cita" por error.
--
-- Costo: cada UPDATE en citas manda la fila completa por el stream de
-- replicación en vez de solo el id — a la escala de una barbería (decenas de
-- citas al día) es insignificante.
alter table citas replica identity full;
