-- Fase 4: permite a una alumna volver a solicitar un curso cuya inscripción
-- fue cancelada (dashboard.html usa upsert con onConflict, que en un
-- conflicto existente requiere permiso de update, no solo insert). Acotado
-- a la única transición que una alumna puede hacer por su cuenta:
-- cancelled → pending. Cualquier otro estado (activar, completar) sigue
-- siendo exclusivo de staff vía "Staff can manage enrollments".

create policy "Students can resubmit cancelled enrollment"
on enrollments for update to authenticated
using (student_id = auth.uid() and status = 'cancelled')
with check (student_id = auth.uid() and status = 'pending');
