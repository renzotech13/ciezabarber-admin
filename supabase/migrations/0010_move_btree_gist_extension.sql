-- El advisor de seguridad marca extensiones instaladas en el schema
-- public. Se mueve btree_gist (usada por el EXCLUDE constraint de citas)
-- al schema extensions, convención de Supabase.
create schema if not exists extensions;
alter extension btree_gist set schema extensions;
