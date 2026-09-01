-- 0019 — Costos del proveedor por producto (MUK deja el catálogo en
-- concesión): costo de proveedor, precio de venta de referencia y precio de
-- oferta — para llevar la contaduría del margen, solo visible al superadmin.
--
-- Se ejecuta de una sola vez en el SQL editor.

-- Tabla aparte y NO columnas en `products` a propósito: la página pública de
-- Productos (todo el staff la usa) hace `select("*") from products`. Si estos
-- tres precios vivieran ahí, cualquier staff los leería sin darse cuenta con
-- la misma consulta de siempre — con tabla propia y su propia RLS, es
-- físicamente imposible que ese select los traiga.
create table if not exists costos_producto (
  producto_id uuid primary key references products(id) on delete cascade,
  -- Lo que le debes a MUK por unidad vendida (precio de concesión).
  costo_proveedor numeric not null default 0 check (costo_proveedor >= 0),
  -- Precio de venta de referencia para medir margen. Vive aparte de
  -- products.price (el precio real de la tienda) porque este es el que se
  -- usó para calcular el margen en su momento — cambiar el precio público no
  -- debe reescribir en silencio un costeo ya hecho.
  costo_venta numeric not null default 0 check (costo_venta >= 0),
  -- Piso de oferta: hasta dónde se puede bajar en un descuento sin perder
  -- margen sobre el costo de proveedor.
  costo_oferta numeric not null default 0 check (costo_oferta >= 0),
  updated_at timestamptz not null default now()
);

create trigger costos_producto_set_updated_at
before update on costos_producto
for each row execute function set_updated_at();

alter table costos_producto enable row level security;

-- Solo superadmin, sin excepción: ni SELECT para el staff normal. Es la
-- pieza que garantiza "sin ver los otros precios" — no es un ocultamiento en
-- la pantalla, es que la fila nunca llega al navegador de nadie más.
drop policy if exists "Superadmin manages costos_producto" on costos_producto;
create policy "Superadmin manages costos_producto"
on costos_producto for all to authenticated
using (is_superadmin()) with check (is_superadmin());
