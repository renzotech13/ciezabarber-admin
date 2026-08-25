-- Fase 6 (panel admin): bucket público para subir imágenes desde el panel
-- (hero, sobre nosotros, tarjetas, productos, testimonios, categorías,
-- cursos) en vez de tener que pegar una URL externa a mano. El bucket es
-- público para lectura (las páginas públicas cargan las imágenes sin
-- pasar por RLS); solo el staff autenticado puede listar/subir/editar/borrar.

insert into storage.buckets (id, name, public) values ('site-media', 'site-media', true);

create policy "Staff can list site-media objects"
on storage.objects for select to authenticated
using (bucket_id = 'site-media' and is_staff());

create policy "Staff can upload site-media objects"
on storage.objects for insert to authenticated
with check (bucket_id = 'site-media' and is_staff());

create policy "Staff can update site-media objects"
on storage.objects for update to authenticated
using (bucket_id = 'site-media' and is_staff())
with check (bucket_id = 'site-media' and is_staff());

create policy "Staff can delete site-media objects"
on storage.objects for delete to authenticated
using (bucket_id = 'site-media' and is_staff());
