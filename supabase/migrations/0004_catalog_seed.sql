-- Fase 3: datos reales existentes en salon.html / reserva.html / index.html,
-- migrados literalmente (mismos ids, nombres, precios, descripciones y orden).

insert into service_categories (id, icon, title, description, images, sort_order) values
('cejas', '✎', 'Cejas y microblading', 'Trazos finos pelo a pelo o efecto polvo para cejas de aspecto natural y definido.', ARRAY['assets/service-2.webp','assets/about-4.webp','assets/gallery-1.webp'], 0),
('labios', '❀', 'Labios y delineado', 'Micropigmentación de labios, delineado de ojo semipermanente e hidratación con Hidralips.', ARRAY['assets/service-11.webp','assets/service-8.webp','assets/service-1.webp'], 10),
('pestanas', '✧', 'Pestañas', 'Lifting de pestañas y extensiones en distintos estilos para realzar la mirada.', ARRAY['assets/service-14.webp','assets/gallery-4.webp','assets/gallery-5.webp'], 20),
('faciales', '☀', 'Faciales y rejuvenecimiento', 'Limpieza facial profunda, rejuvenecimiento y planing para una piel renovada y luminosa.', ARRAY['assets/before-treatment.webp','assets/after-treatment.webp','assets/hero-image.webp'], 30),
('manos', '✦', 'Manos, pies y depilación', 'Manicure, pedicure y depilación con cera en distintas zonas.', ARRAY['assets/left-hand.webp','assets/right-hand.webp','assets/service-2.webp'], 40);

insert into services (id, category_id, booking_group, name, duration, price, description, sort_order) values
('microblading', 'cejas', 'Principales', 'Microblading', '2h', '250', 'Técnica de trazos finos para cejas de aspecto natural, pelo a pelo.', 0),
('micro-cejas', 'cejas', 'Principales', 'Micropigmentación de cejas', '2h', '450', 'Efecto polvo con acabado suave y duradero, ideal para cejas más definidas.', 10),
('micro-labios', 'labios', 'Principales', 'Micropigmentación de labios', '3h', '550', 'Realza el contorno y color natural de los labios de forma semipermanente.', 20),
('delineado', 'labios', 'Principales', 'Delineado de ojo', '1h', '180', 'Delineado semipermanente que define la mirada sin necesidad de maquillaje diario.', 30),
('hidralips', 'labios', 'Principales', 'Hidralips', '1h', '180', 'Tratamiento hidratante que aporta volumen y suavidad natural a los labios.', 40),
('depilacion', 'manos', 'Complementarios', 'Depilación', '—', '15–40', 'Depilación con cera en distintas zonas, según tratamiento elegido.', 0),
('faciales', 'faciales', 'Complementarios', 'Faciales', '—', '90', 'Limpieza facial profunda que renueva y equilibra la piel.', 10),
('rejuvenecimiento', 'faciales', 'Complementarios', 'Rejuvenecimiento facial', '—', '450', 'Tratamiento facial avanzado enfocado en firmeza y luminosidad.', 20),
('planing', 'faciales', 'Complementarios', 'Planing', '—', '50', 'Exfoliación facial suave que retira vello fino e impurezas.', 30),
('pedicure', 'manos', 'Opcionales', 'Pedicure', '—', '50', 'Cuidado completo de pies con esmaltado incluido.', 0),
('manicure', 'manos', 'Opcionales', 'Manicure', '—', '80', 'Cuidado de manos y uñas con esmaltado a elección.', 10),
('lifting', 'pestanas', 'Opcionales', 'Lifting de pestañas', '—', '80', 'Curvatura duradera que realza la mirada sin extensiones.', 20),
('pestanas', 'pestanas', 'Opcionales', 'Pestañas', '—', '50–150', 'Extensión de pestañas en distintos estilos y densidades.', 30),
('henna', 'cejas', 'Opcionales', 'Henna', '—', '40', 'Diseño de cejas con tinte natural de larga duración.', 40);

insert into products (name, price, description, image_url, sort_order) values
('Crema facial Raabta', 89, 'Cremas faciales, sueros y cuidado post-tratamiento pensados para la piel de la mujer. Pago contra entrega disponible.', null, 0);
