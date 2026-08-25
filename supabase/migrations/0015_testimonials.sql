-- Fase 5 (panel admin): testimonios editables de index.html. Mismo patrón que
-- products (0003_catalog_schema.sql): público ve solo activos, autenticado
-- administra todo.

create table testimonials (
  id uuid primary key default gen_random_uuid(),
  avatar_url text,
  name text not null,
  service text not null,
  quote text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index testimonials_active_idx on testimonials (active);

create trigger testimonials_set_updated_at
before update on testimonials
for each row execute function set_updated_at();

alter table testimonials enable row level security;

create policy "Public can view active testimonials"
on testimonials for select to anon using (active = true);

create policy "Authenticated can manage testimonials"
on testimonials for all to authenticated using (true) with check (true);
