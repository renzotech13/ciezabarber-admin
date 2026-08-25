-- Endurece set_updated_at() (definida en 0001_bookings.sql) contra search_path
-- mutable, señalado por el advisor de seguridad de Supabase. Ya se había aplicado
-- directamente al proyecto; este archivo solo deja el registro en el historial.

alter function public.set_updated_at() set search_path = '';
