-- Fase 6 (panel admin): imagen independiente para la tarjeta "Belleza".
-- Antes la tarjeta solo mostraba la foto del primer producto activo
-- (image_url en products); ahora el panel puede fijar una imagen propia
-- desde Front > Tarjetas, igual que Salón y Academia, sin tener que tocar
-- el producto. Si queda vacía, se sigue usando la foto del producto.

alter table site_content add column belleza_image_url text;
