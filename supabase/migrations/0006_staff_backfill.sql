-- Backfill: promueve la cuenta inicial de staff (creada directo en Supabase,
-- ya que el panel todavía no tiene registro propio) a role='staff'. El
-- trigger on_auth_user_created la crea como 'alumna' por defecto.

update profiles set role = 'staff'
where id = '587ef0fa-f0a3-47a4-98ba-bff2b9b05f0c';
