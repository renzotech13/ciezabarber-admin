-- 0016 — Adelanto pagado desde la web.
--
-- Hasta ahora la captura del Yape solo podía llegar por WhatsApp (el bot la
-- recibe como imagen). Con la reserva web el cliente sube la imagen desde el
-- navegador, sin sesión ni número verificado: hace falta una credencial por
-- cita para que subir un comprobante a la cita de otro sea imposible.

-- Varios servicios elegidos juntos se agendan como citas consecutivas (una
-- por servicio). Para el cliente eso es UNA reserva con UN adelanto: este id
-- las agrupa, y así el comprobante que sube confirma las tres de una vez en
-- lugar de quedar pegado a la primera. Una cita suelta (las de WhatsApp) es
-- simplemente un grupo de una.
alter table citas add column if not exists reserva_id uuid not null default gen_random_uuid();
create index if not exists citas_reserva_idx on citas (reserva_id);

-- Token de un solo propósito, devuelto UNA vez en la respuesta de
-- /public/reservas y nunca más. No es un secreto de larga vida: solo sirve
-- mientras la cita esté en stand-by, que son minutos.
alter table citas add column if not exists upload_token uuid not null default gen_random_uuid();

-- Por dónde entró el comprobante, para que el staff sepa si la imagen la
-- mandó el cliente por WhatsApp o la subió desde la web.
alter table citas add column if not exists comprobante_origen text
  check (comprobante_origen in ('whatsapp','web'));

-- Ficha del cliente (el "historial clínico" que consulta el barbero antes de
-- atender). `notas` ya existía como cajón de sastre; esto separa lo que se
-- consulta de un vistazo en cada visita.
alter table clientes add column if not exists preferencias text;
alter table clientes add column if not exists alergias text;

-- Qué se le hizo en esa visita concretamente (el corte, el tono, el número de
-- máquina). Distinto de `citas.notas`, que es lo que el cliente pidió AL
-- reservar; esto lo escribe el barbero DESPUÉS de atender.
alter table citas add column if not exists atencion_notas text;

-- ---------------------------------------------------------------------------
-- Permisos que faltaban para que el panel pueda hacer su trabajo.
--
-- El bot escribe con la service role key, así que nunca chocó con RLS y estos
-- huecos pasaron desapercibidos. El panel entra como usuario `authenticated`
-- y sí los sufre: hasta ahora "Guardar notas" del CRM decía que guardaba y no
-- guardaba nada (un UPDATE bloqueado por RLS no falla, simplemente afecta 0
-- filas), y la captura del comprobante no se podía ni abrir.
-- ---------------------------------------------------------------------------

-- 1. El staff puede editar la ficha del cliente (preferencias, alergias, notas).
drop policy if exists "Staff can update clientes" on clientes;
create policy "Staff can update clientes"
on clientes for update to authenticated using (is_staff()) with check (is_staff());

-- 2. Y anotar en la cita qué se le hizo, además de cambiarle el estado.
drop policy if exists "Staff can update citas" on citas;
create policy "Staff can update citas"
on citas for update to authenticated using (is_staff()) with check (is_staff());

-- 3. El bucket de comprobantes nunca se creó por migración (existe en
--    producción porque el bot lo usa). Privado: las capturas son datos
--    bancarios del cliente, se ven solo por URL firmada desde el panel.
insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;

drop policy if exists "Staff can read comprobantes" on storage.objects;
create policy "Staff can read comprobantes"
on storage.objects for select to authenticated
using (bucket_id = 'comprobantes' and is_staff());
