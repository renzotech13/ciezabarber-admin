-- Fase 4: catálogo de cursos de la academia, leído por academia.html en vez
-- del arreglo ACADEMIA_COURSES hardcodeado. El temario (course_days/
-- course_lessons) y los materiales no son públicos todavía — sus políticas
-- de lectura para alumnas se agregan en 0021, después de que exista
-- has_active_enrollment() (0020).

create table courses (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  icon text not null,
  title text not null,
  meta text not null,
  description text not null,
  images text[] not null default '{}',
  price numeric,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table course_days (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references courses(id) on delete cascade,
  title text not null,
  sort_order int not null default 0
);

create index course_days_course_id_idx on course_days (course_id);

create table course_lessons (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references course_days(id) on delete cascade,
  title text not null,
  modality text not null check (modality in ('Video', 'Presencial')),
  duration text not null default '',
  video_url text,
  sort_order int not null default 0
);

create index course_lessons_day_id_idx on course_lessons (day_id);

create table course_materials (
  id uuid primary key default gen_random_uuid(),
  course_id text not null references courses(id) on delete cascade,
  name text not null,
  meta text not null default '',
  file_url text not null,
  sort_order int not null default 0
);

create index course_materials_course_id_idx on course_materials (course_id);

create trigger courses_set_updated_at
before update on courses
for each row execute function set_updated_at();

alter table courses enable row level security;
alter table course_days enable row level security;
alter table course_lessons enable row level security;
alter table course_materials enable row level security;

create policy "Public can view active courses"
on courses for select to anon, authenticated using (active = true);

create policy "Staff can manage courses"
on courses for all to authenticated using (is_staff()) with check (is_staff());

create policy "Staff can manage course_days"
on course_days for all to authenticated using (is_staff()) with check (is_staff());

create policy "Staff can manage course_lessons"
on course_lessons for all to authenticated using (is_staff()) with check (is_staff());

create policy "Staff can manage course_materials"
on course_materials for all to authenticated using (is_staff()) with check (is_staff());
