-- 0014 — Valores de enum para el flujo de adelanto (stand-by).
--
-- IMPORTANTE: ejecutar ESTE archivo solo, y recién después el 0015.
-- Postgres no permite usar un valor de enum recién agregado dentro de la
-- misma transacción que lo creó, y el SQL editor de Supabase envuelve cada
-- ejecución en una transacción. Si se corren juntos, el 0015 falla con
-- "unsafe use of new value ... of enum type".

-- Una cita con adelanto pendiente NO está agendada: ocupa el horario
-- (stand-by) pero no cuenta como confirmada hasta que llegue el
-- comprobante. 'expirada' es la que se liberó sola por no recibirlo.
alter type cita_estado add value if not exists 'pendiente_pago';
alter type cita_estado add value if not exists 'expirada';
