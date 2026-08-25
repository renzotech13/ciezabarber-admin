-- Corrección de seguridad: reemplaza using(true) por using(is_staff()) en
-- las tablas que solo debe poder tocar el staff — necesario en cuanto
-- exista más de un tipo de usuario "authenticated" (mismo criterio que
-- Raabta). Agrega también las columnas de logo/tarjetas/comparador de
-- site_content y el bucket de imágenes del panel.

drop policy "Authenticated can update bookings" on bookings;
create policy "Staff can update bookings"
on bookings for update to authenticated using (is_staff()) with check (is_staff());

drop policy "Authenticated can view bookings" on bookings;
create policy "Staff can view bookings"
on bookings for select to authenticated using (is_staff());

drop policy "Authenticated can view business_hours" on business_hours;
create policy "Staff can view business_hours"
on business_hours for select to authenticated using (is_staff());

drop policy "Authenticated can view citas" on citas;
create policy "Staff can view citas"
on citas for select to authenticated using (is_staff());

drop policy "Authenticated can view clientes" on clientes;
create policy "Staff can view clientes"
on clientes for select to authenticated using (is_staff());

drop policy "Authenticated can view conversaciones" on conversaciones;
create policy "Staff can view conversaciones"
on conversaciones for select to authenticated using (is_staff());

drop policy "Authenticated can view mensajes" on mensajes;
create policy "Staff can view mensajes"
on mensajes for select to authenticated using (is_staff());

drop policy "Authenticated can view bloqueos" on bloqueos;
create policy "Staff can view bloqueos"
on bloqueos for select to authenticated using (is_staff());

drop policy "Authenticated can manage products" on products;
create policy "Staff can manage products"
on products for all to authenticated using (is_staff()) with check (is_staff());

drop policy "Authenticated can manage service categories" on service_categories;
create policy "Staff can manage service categories"
on service_categories for all to authenticated using (is_staff()) with check (is_staff());

drop policy "Authenticated can manage services" on services;
create policy "Staff can manage services"
on services for all to authenticated using (is_staff()) with check (is_staff());

drop policy "Authenticated can update site content" on site_content;
create policy "Staff can update site content"
on site_content for update to authenticated using (is_staff()) with check (is_staff());

drop policy "Authenticated can manage testimonials" on testimonials;
create policy "Staff can manage testimonials"
on testimonials for all to authenticated using (is_staff()) with check (is_staff());

revoke execute on function handle_new_user() from public;
revoke execute on function handle_new_user() from anon;
revoke execute on function handle_new_user() from authenticated;

revoke execute on function is_staff() from public;
revoke execute on function is_staff() from anon;

alter table site_content
  add column salon_image_url text,
  add column academia_image_url text;

alter table site_content add column belleza_image_url text;

alter table site_content add column logo_url text;

alter table site_content
  add column logo_header_height int not null default 54,
  add column logo_footer_height int not null default 60;

alter table site_content
  add column compare_before_image text,
  add column compare_after_image text;

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
