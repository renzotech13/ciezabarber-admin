-- Fase 4: una alumna con inscripción activa puede leer el temario real
-- (course_days/course_lessons, con video_url) y los materiales de ESE curso
-- — no de cualquier curso, y no solo por estar autenticada. academia.html
-- (la vitrina pública) no necesita esto: solo lee la tabla courses.

create policy "Enrolled students can view course_days"
on course_days for select to authenticated
using (has_active_enrollment(course_id));

create policy "Enrolled students can view course_lessons"
on course_lessons for select to authenticated
using (
  exists (
    select 1 from course_days
    where course_days.id = course_lessons.day_id
    and has_active_enrollment(course_days.course_id)
  )
);

create policy "Enrolled students can view course_materials"
on course_materials for select to authenticated
using (has_active_enrollment(course_id));
