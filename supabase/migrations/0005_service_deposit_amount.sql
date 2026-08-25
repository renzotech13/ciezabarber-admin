-- Monto de adelanto por servicio (del brief del cliente), para que tanto el
-- panel admin como el futuro bot de WhatsApp lo lean de la misma fuente.
alter table services add column deposit_amount numeric;

update services set deposit_amount = 50 where id in
  ('microblading', 'micro-cejas', 'micro-labios', 'delineado', 'hidralips');
