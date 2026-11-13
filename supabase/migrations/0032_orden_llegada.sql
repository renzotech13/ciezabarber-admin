-- Campaña «atención por orden de llegada»: mientras esté encendida nadie elige hora (ni la web, ni el bot).
-- Se enciende y apaga desde el panel (Disponibilidad). Idempotente. El bot y la web funcionan sin estas columnas
-- (modo apagado), así que se puede correr antes o después de publicar.
alter table configuracion add column if not exists orden_llegada boolean not null default false;
-- Texto que se le dice a la clienta; vacío = el mensaje por defecto del bot.
alter table configuracion add column if not exists orden_llegada_mensaje text;
