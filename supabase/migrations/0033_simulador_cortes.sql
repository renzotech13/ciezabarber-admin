-- 0033 — Simulador de cortes: según la forma del rostro y del cráneo del cliente se le recomiendan cortes del
-- catálogo, cada uno con la foto de alguien de rasgos parecidos, y (cuando se conecte APIMart) se le pone ese
-- corte sobre su propia foto.
--
-- Se ejecuta de una sola vez en el SQL editor. Idempotente.

-- 1. Catálogo de cortes de referencia ------------------------------------------
-- Una foto real del corte (ideal: un trabajo de Cieza) marcada con las formas de rostro a las que les queda.
create table if not exists cortes_referencia (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  formas_rostro text[] not null default '{}'
    check (formas_rostro <@ array['ovalado','redondo','cuadrado','alargado','corazon','diamante','triangular']),
  tipos_cabello text[] not null default '{}'
    check (tipos_cabello <@ array['lacio','ondulado','rizado','afro']),
  storage_path text not null,
  activo boolean not null default true,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists cortes_referencia_set_updated_at on cortes_referencia;
create trigger cortes_referencia_set_updated_at
before update on cortes_referencia
for each row execute function set_updated_at();

alter table cortes_referencia enable row level security;

-- Todo el equipo lo ve (los barberos simulan desde el celular); solo el staff lo arma.
drop policy if exists "Equipo ve el catalogo de cortes" on cortes_referencia;
create policy "Equipo ve el catalogo de cortes"
on cortes_referencia for select to authenticated using (es_del_equipo());

drop policy if exists "Staff arma el catalogo de cortes" on cortes_referencia;
create policy "Staff arma el catalogo de cortes"
on cortes_referencia for all to authenticated using (is_staff()) with check (is_staff());

-- Bucket público: son fotos de catálogo (como la multimedia) y el generador de imágenes necesita bajarlas por URL.
insert into storage.buckets (id, name, public)
values ('cortes-referencia', 'cortes-referencia', true)
on conflict (id) do nothing;

drop policy if exists "Staff lista cortes-referencia" on storage.objects;
create policy "Staff lista cortes-referencia"
on storage.objects for select to authenticated
using (bucket_id = 'cortes-referencia' and is_staff());

drop policy if exists "Staff sube cortes-referencia" on storage.objects;
create policy "Staff sube cortes-referencia"
on storage.objects for insert to authenticated
with check (bucket_id = 'cortes-referencia' and is_staff());

drop policy if exists "Staff cambia cortes-referencia" on storage.objects;
create policy "Staff cambia cortes-referencia"
on storage.objects for update to authenticated
using (bucket_id = 'cortes-referencia' and is_staff())
with check (bucket_id = 'cortes-referencia' and is_staff());

drop policy if exists "Staff borra cortes-referencia" on storage.objects;
create policy "Staff borra cortes-referencia"
on storage.objects for delete to authenticated
using (bucket_id = 'cortes-referencia' and is_staff());

-- 2. Simulaciones ---------------------------------------------------------------
-- La foto del cliente es un dato personal: se guarda en un bucket privado, solo con su consentimiento, y el bot la
-- borra sola a los 7 días (con sus resultados). Todo se escribe desde el bot (service role); el navegador no toca
-- este bucket.
create table if not exists simulaciones_corte (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references clientes(id) on delete set null,
  creado_por uuid references auth.users(id) on delete set null,
  barbero text,
  foto_path text not null,
  analisis jsonb not null,
  resultados jsonb not null default '[]'::jsonb,
  consentimiento boolean not null check (consentimiento),
  created_at timestamptz not null default now(),
  expira_at timestamptz not null default now() + interval '7 days'
);

create index if not exists simulaciones_corte_expira_idx on simulaciones_corte (expira_at);

alter table simulaciones_corte enable row level security;

drop policy if exists "Staff ve las simulaciones" on simulaciones_corte;
create policy "Staff ve las simulaciones"
on simulaciones_corte for select to authenticated
using (is_staff() or (es_del_equipo() and creado_por = auth.uid()));

insert into storage.buckets (id, name, public)
values ('simulaciones', 'simulaciones', false)
on conflict (id) do nothing;
