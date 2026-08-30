-- Fase 6 (rol 'humano') y Fase 10 (biblioteca de multimedia) del bot: código
-- ya desplegado que asume estas columnas/tabla, pero nunca se migraron a
-- este proyecto de Supabase. Sin esto, CADA mensaje entrante rompe con
-- PGRST204 "Could not find the 'media_type' column of 'mensajes'" — el bot
-- recibe el mensaje (Meta ve 200 OK) pero nunca llega a responder porque el
-- guardado en `mensajes` truena antes de invocar al agente.

-- 1. `mensajes`: media adjunta + respuestas escritas por una persona -------
alter table mensajes add column media_url text;
alter table mensajes add column media_type text check (media_type in ('image','video','audio','document'));

alter table mensajes drop constraint if exists mensajes_rol_check;
alter table mensajes add constraint mensajes_rol_check check (rol in ('user','assistant','humano'));

-- 2. `plantillas_media`: catálogo de imagen/video/audio/documento que el
-- agente puede mandar por WhatsApp (tool `enviar_multimedia`), más lo que el
-- staff manda a mano desde el CRM. `descripcion_uso` es el contexto que lee
-- el agente para decidir CUÁNDO mandar cada una — se inyecta completo en el
-- system prompt en cada mensaje (buildSystemPrompt), por eso esta tabla
-- tiene que existir aunque esté vacía: sin ella, ni siquiera arma el prompt.
create table plantillas_media (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null check (tipo in ('image','video','audio','document')),
  storage_path text not null,
  descripcion_uso text not null,
  caption text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index plantillas_media_activo_idx on plantillas_media (activo);

create trigger plantillas_media_set_updated_at
before update on plantillas_media
for each row execute function set_updated_at();

alter table plantillas_media enable row level security;
create policy "Staff can manage plantillas_media"
on plantillas_media for all to authenticated using (is_staff()) with check (is_staff());

-- 3. Bucket de storage: público (a diferencia de `comprobantes`) porque
-- WhatsApp necesita bajar el archivo por URL directa al enviarlo, sin pasar
-- por una URL firmada que expira.
insert into storage.buckets (id, name, public) values ('plantillas-media', 'plantillas-media', true);

create policy "Staff can list plantillas-media objects"
on storage.objects for select to authenticated
using (bucket_id = 'plantillas-media' and is_staff());

create policy "Staff can upload plantillas-media objects"
on storage.objects for insert to authenticated
with check (bucket_id = 'plantillas-media' and is_staff());

create policy "Staff can update plantillas-media objects"
on storage.objects for update to authenticated
using (bucket_id = 'plantillas-media' and is_staff())
with check (bucket_id = 'plantillas-media' and is_staff());

create policy "Staff can delete plantillas-media objects"
on storage.objects for delete to authenticated
using (bucket_id = 'plantillas-media' and is_staff());
