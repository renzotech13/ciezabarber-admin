-- Fase 6 (panel admin): fotos del comparador "Antes/Después" en la
-- sección "Por qué elegir Raabta" de index.html, antes fijas en
-- assets/before-treatment.webp y assets/after-treatment.webp.

alter table site_content
  add column compare_before_image text,
  add column compare_after_image text;
