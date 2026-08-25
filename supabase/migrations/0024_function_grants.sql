-- Fase 4: cierre de los warnings del advisor de seguridad sobre funciones
-- security definer expuestas por PostgREST.
--
-- handle_new_user() solo la dispara el trigger on_auth_user_created — nunca
-- se llama directo, revocar de todos los roles no rompe el trigger (la
-- ejecución de un trigger no depende del EXECUTE grant del rol que hizo el
-- INSERT).
--
-- is_staff()/has_active_enrollment() SÍ deben seguir siendo ejecutables por
-- "authenticated": las políticas RLS que las usan se evalúan con los
-- privilegios del rol que hace la consulta, así que revocarle "authenticated"
-- rompería esas políticas para usuarios reales. Solo se le quita a "anon" y
-- "public", que no las necesitan (ninguna política de anon las usa). El
-- warning restante del advisor para "authenticated" es esperado: ambas
-- funciones solo exponen el propio rol/inscripción del que llama, no datos
-- de otros usuarios.

revoke execute on function handle_new_user() from public;
revoke execute on function handle_new_user() from anon;
revoke execute on function handle_new_user() from authenticated;

revoke execute on function is_staff() from public;
revoke execute on function is_staff() from anon;

revoke execute on function has_active_enrollment(text) from public;
revoke execute on function has_active_enrollment(text) from anon;
