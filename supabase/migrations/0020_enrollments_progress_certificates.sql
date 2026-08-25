-- Fase 4: inscripción, progreso de lecciones y certificados. lesson_progress
-- y certificates no tienen política de insert para nadie — se escriben
-- únicamente dentro de mark_lesson_complete() (0022), security definer, para
-- que una alumna no pueda marcarse lecciones completas o emitirse un
-- certificado por su cuenta escribiendo directo a la tabla.

create table enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  course_id text not null references courses(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'active', 'cancelled', 'completed')),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (student_id, course_id)
);

create index enrollments_student_id_idx on enrollments (student_id);
create index enrollments_course_id_idx on enrollments (course_id);

create function has_active_enrollment(p_course_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.enrollments
    where student_id = auth.uid() and course_id = p_course_id and status = 'active'
  );
$$;

create table lesson_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  lesson_id uuid not null references course_lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (student_id, lesson_id)
);

create index lesson_progress_student_id_idx on lesson_progress (student_id);

create table certificates (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  course_id text not null references courses(id) on delete cascade,
  code text not null unique default encode(gen_random_bytes(6), 'hex'),
  issued_at timestamptz not null default now(),
  unique (student_id, course_id)
);

create index certificates_student_id_idx on certificates (student_id);

alter table enrollments enable row level security;
alter table lesson_progress enable row level security;
alter table certificates enable row level security;

create policy "Students can view own enrollments"
on enrollments for select to authenticated using (student_id = auth.uid());

create policy "Students can request enrollment"
on enrollments for insert to authenticated
with check (student_id = auth.uid() and status = 'pending');

create policy "Staff can manage enrollments"
on enrollments for all to authenticated using (is_staff()) with check (is_staff());

create policy "Students can view own progress"
on lesson_progress for select to authenticated using (student_id = auth.uid());

create policy "Staff can view all progress"
on lesson_progress for select to authenticated using (is_staff());

create policy "Students can view own certificates"
on certificates for select to authenticated using (student_id = auth.uid());

create policy "Staff can view all certificates"
on certificates for select to authenticated using (is_staff());
