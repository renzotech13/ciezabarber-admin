-- 0030 — La columna `clientes.email` que el código daba por existente.
--
-- Nunca se creó, pero varias partes la usan: el login con Google busca la
-- ficha del cliente por correo (y reventaba con "internal_error"), la ficha
-- de Reservas y el panel de Conversaciones la piden en su SELECT (y al no
-- existir fallaba la consulta entera: preferencias, alergias y notas no
-- cargaban), y la herramienta de agendar del bot intenta guardarla cuando el
-- cliente la da.
--
-- Se ejecuta de una sola vez en el SQL editor.

alter table clientes add column if not exists email text;

-- Se busca siempre en minúsculas: un correo es el mismo con o sin mayúsculas.
create index if not exists clientes_email_idx on clientes (lower(email));
