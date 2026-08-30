-- Fase 7 del bot (sync bidireccional con Google Calendar): esta tabla y esta
-- columna nunca se migraron a este proyecto, por eso el bot loguea cada 5 min
-- "No se pudo registrar el canal inicial de webhooks de Google Calendar" con
-- err.code PGRST205 (tabla no encontrada). No bloquea reservas — el
-- calendario nunca es requisito para agendar — pero sin esto Google Calendar
-- no se entera de eventos agregados a mano fuera del bot.

-- Fila única (id=1), mismo patrón que site_content/bot_daily_usage: guarda el
-- syncToken de la sincronización incremental y los datos del canal de
-- webhooks activo (events.watch de Google, que expira cada ~7 días).
create table calendar_sync_state (
  id int primary key default 1 check (id = 1),
  sync_token text,
  channel_id text,
  resource_id text,
  channel_expira_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into calendar_sync_state (id) values (1);

create trigger calendar_sync_state_set_updated_at
before update on calendar_sync_state
for each row execute function set_updated_at();

alter table calendar_sync_state enable row level security;
-- Sin policies a propósito: solo el bot (service role) toca esta tabla: no
-- hay pantalla en el admin que la necesite, y el service role no pasa por
-- RLS de todos modos.

-- Vincula un bloqueo con el evento externo de Google Calendar que lo generó,
-- para poder borrar el bloqueo cuando ese evento se cancela del lado de
-- Google (routes/admin.ts también lo usa al borrar un bloqueo a mano: si
-- tiene google_event_id, borra el evento real, no solo la fila).
alter table bloqueos add column google_event_id text unique;
