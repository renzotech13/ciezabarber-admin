-- Incremento atómico del contador diario: un upsert simple desde el
-- cliente (select + update) tendría condición de carrera si dos mensajes
-- se procesan casi al mismo tiempo. Esta función hace el incremento
-- dentro de una sola sentencia SQL.
create or replace function increment_bot_daily_usage(p_usage_date date, p_tokens bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.bot_daily_usage (usage_date, tokens_used)
  values (p_usage_date, p_tokens)
  on conflict (usage_date)
  do update set tokens_used = public.bot_daily_usage.tokens_used + excluded.tokens_used;
$$;
