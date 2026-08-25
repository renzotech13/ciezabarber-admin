-- Fase 4: perfiles de usuario (staff vs alumna). Ambos son usuarios de
-- Supabase Auth (auth.users); esta tabla es lo único que los distingue.
-- Un trigger crea el perfil automáticamente al registrarse (rol 'alumna' por
-- defecto — el registro público en dashboard.html es para alumnas; el staff
-- se promueve a mano, ver 0018).

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
