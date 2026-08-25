-- Contenido editable del sitio (Front), testimonios y perfiles staff/alumna
-- (alumna no se usa en Cieza Barber, pero el rol queda como base para
-- distinguir staff de cualquier otro tipo de cuenta futura).

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

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'alumna' check (role in ('staff', 'alumna')),
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

create function is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.profiles where id = auth.uid() and role = 'staff'
  );
$$;

alter table profiles enable row level security;

create policy "Staff can view all profiles"
on profiles for select to authenticated using (is_staff() or id = auth.uid());

create policy "Users can update own profile"
on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();
