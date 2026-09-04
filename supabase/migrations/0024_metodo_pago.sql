-- 0024 — Con qué pagó: Yape/Plin, tarjeta (POS) o efectivo.
--
-- Sin esto el arqueo de caja no cierra nunca: el total del turno mezcla lo
-- que entró al cajón con lo que entró al celular o al POS, y la diferencia
-- al cerrar parece un descuadre cuando en realidad es dinero que nunca pasó
-- por la caja.
--
-- Texto con check en vez de enum a propósito: agregar un medio de pago más
-- adelante (transferencia, tarjeta de otro POS) es un solo ALTER, sin el
-- lío de ALTER TYPE ... ADD VALUE y su transacción aparte.
--
-- Se ejecuta de una sola vez en el SQL editor.

alter table citas add column if not exists metodo_pago text
  check (metodo_pago in ('yape_plin', 'tarjeta', 'efectivo'));

alter table ventas_productos add column if not exists metodo_pago text
  check (metodo_pago in ('yape_plin', 'tarjeta', 'efectivo'));

-- Lo ya cobrado por adelantado entró por Yape sí o sí (es el único medio que
-- acepta la reserva por web y por WhatsApp), así que se marca solo.
update citas
   set metodo_pago = 'yape_plin'
 where metodo_pago is null
   and comprobante_estado = 'confirmado';

create index if not exists citas_metodo_pago_idx
  on citas (metodo_pago) where metodo_pago is not null;
create index if not exists ventas_metodo_pago_idx
  on ventas_productos (metodo_pago) where metodo_pago is not null;
