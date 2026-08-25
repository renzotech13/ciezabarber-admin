-- Fase 5: contador diario de tokens de Anthropic usados por el bot, para
-- el tope de gasto. Persistido (no en memoria) para que sobreviva a un
-- restart/crash del servidor, a diferencia del rate limiting.
create table bot_daily_usage (
  usage_date date primary key,
  tokens_used bigint not null default 0
);

alter table bot_daily_usage enable row level security;
-- Sin políticas: solo la service role key del bot la usa (ignora RLS por
-- diseño de Supabase), mismo criterio que clientes/citas/conversaciones.
