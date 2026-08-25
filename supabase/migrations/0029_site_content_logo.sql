-- Fase 6 (panel admin): el logo (header y footer de index.html) estaba
-- fijo en uploads/raabta-logo-color-primario.png sin ningún campo para
-- cambiarlo. Se agrega logo_url, editable desde Front > Logo.

alter table site_content add column logo_url text;
