-- De dónde salió un mensaje del negocio. Hoy solo 'whatsapp_business_app': lo escribió el equipo desde el celular del
-- negocio (coexistencia) y el panel lo rotula «Equipo · celular». Idempotente. El bot funciona sin esta columna (guarda el
-- mensaje igual, sin rótulo): se puede correr antes o después de publicar.
alter table mensajes add column if not exists via text;
