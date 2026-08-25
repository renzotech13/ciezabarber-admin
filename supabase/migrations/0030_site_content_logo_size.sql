-- Fase 6 (panel admin): el logo subido puede tener una proporción muy
-- distinta al que estaba fijo antes (era height:54px header / 60px
-- footer en el HTML). Se agregan alturas configurables para cada sitio
-- donde aparece el logo; el ancho se mantiene "auto" en ambos casos
-- para no deformar la imagen.

alter table site_content
  add column logo_header_height int not null default 54,
  add column logo_footer_height int not null default 60;
