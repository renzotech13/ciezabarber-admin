-- Fase 4: único camino de escritura para lesson_progress/certificates.
-- security definer para poder escribir en tablas sin política de insert
-- para el cliente (mismo criterio ya usado en increment_bot_daily_usage,
-- Fase 5 del bot: revocar de public/anon, solo authenticated, y toda la
-- validación de negocio vive adentro de la función, no del lado cliente).

create function mark_lesson_complete(p_lesson_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course_id text;
  v_total_lessons int;
  v_completed_lessons int;
  v_certificate_issued boolean := false;
begin
  select cd.course_id into v_course_id
  from public.course_lessons cl
  join public.course_days cd on cd.id = cl.day_id
  where cl.id = p_lesson_id;

  if v_course_id is null then
    raise exception 'Lección no encontrada';
  end if;

  if not public.has_active_enrollment(v_course_id) then
    raise exception 'No tienes una inscripción activa en este curso';
  end if;

  insert into public.lesson_progress (student_id, lesson_id)
  values (auth.uid(), p_lesson_id)
  on conflict (student_id, lesson_id) do nothing;

  select count(*) into v_total_lessons
  from public.course_lessons cl
  join public.course_days cd on cd.id = cl.day_id
  where cd.course_id = v_course_id;

  select count(*) into v_completed_lessons
  from public.lesson_progress lp
  join public.course_lessons cl on cl.id = lp.lesson_id
  join public.course_days cd on cd.id = cl.day_id
  where cd.course_id = v_course_id and lp.student_id = auth.uid();

  if v_total_lessons > 0 and v_completed_lessons >= v_total_lessons then
    insert into public.certificates (student_id, course_id)
    values (auth.uid(), v_course_id)
    on conflict (student_id, course_id) do nothing;
    v_certificate_issued := true;
  end if;

  return jsonb_build_object(
    'completed_lessons', v_completed_lessons,
    'total_lessons', v_total_lessons,
    'certificate_issued', v_certificate_issued
  );
end;
$$;

revoke execute on function mark_lesson_complete(uuid) from public;
revoke execute on function mark_lesson_complete(uuid) from anon;
grant execute on function mark_lesson_complete(uuid) to authenticated;
