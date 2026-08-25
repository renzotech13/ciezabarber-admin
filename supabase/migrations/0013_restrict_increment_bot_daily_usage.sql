-- El advisor de seguridad detectó que increment_bot_daily_usage quedó
-- ejecutable por anon/authenticated vía /rest/v1/rpc/... (grant automático
-- de Postgres a PUBLIC en CREATE FUNCTION). Solo el bot (service role,
-- que ignora estos grants) debe poder llamarla — cualquier otro caller
-- podría inflar el contador y activar el tope de gasto artificialmente.
revoke execute on function public.increment_bot_daily_usage(date, bigint) from public;
revoke execute on function public.increment_bot_daily_usage(date, bigint) from anon;
revoke execute on function public.increment_bot_daily_usage(date, bigint) from authenticated;
