-- Fase 5 (panel admin): contenido editable de index.html — hero y "sobre
-- nosotros". Fila única (id fijo en 1), mismo criterio que otras tablas de
-- configuración de una sola fila del proyecto.

create table site_content (
  id int primary key default 1 check (id = 1),
  hero_eyebrow text not null default '',
  hero_title text not null default '',
  hero_subtitle text not null default '',
  hero_image_url text,
  about_eyebrow text not null default '',
  about_title text not null default '',
  about_body text not null default '',
  about_image_big text,
  about_image_small1 text,
  about_image_small2 text,
  footer_tagline text not null default '',
  updated_at timestamptz not null default now()
);

insert into site_content (id) values (1);

create trigger site_content_set_updated_at
before update on site_content
for each row execute function set_updated_at();

alter table site_content enable row level security;

create policy "Public can view site content"
on site_content for select to anon, authenticated using (true);

create policy "Authenticated can update site content"
on site_content for update to authenticated using (true) with check (true);
