-- Fase 4: corrección de seguridad obligatoria. Hasta ahora "authenticated"
-- solo podía ser el staff (un usuario). Con alumnas registrándose vía
-- supabase.auth.signUp también son "authenticated" — sin este cambio,
-- cualquier alumna podría leer/escribir reservas, teléfonos de clientas y
-- el catálogo completo. Se reemplaza using(true) por using(is_staff()) en
-- toda política que hasta ahora asumía "authenticated == staff".

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
