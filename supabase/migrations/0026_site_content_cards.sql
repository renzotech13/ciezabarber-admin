-- Fase 6 (panel admin): imágenes editables de las tarjetas "Salón" y
-- "Academia" en index.html (la tarjeta "Belleza" ya toma su imagen del
-- primer producto activo).

alter table site_content
  add column salon_image_url text,
  add column academia_image_url text;
