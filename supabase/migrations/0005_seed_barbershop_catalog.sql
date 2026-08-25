-- Catálogo de ejemplo (editable desde el panel admin) para arrancar el
-- sitio con contenido real de barbería en vez de vacío.

insert into business_hours (weekday, opens_at, closes_at)
values
  (0, '10:00', '21:00'), (1, '10:00', '21:00'), (2, '10:00', '21:00'),
  (3, '10:00', '21:00'), (4, '10:00', '21:00'), (5, '10:00', '21:00'), (6, '10:00', '21:00');

insert into service_categories (id, icon, title, description, sort_order) values
  ('cortes', '✂️', 'Cortes', 'Corte clásico, fade, corte a máquina o tijera para todos los estilos.', 0),
  ('barba', '🪒', 'Barba y afeitado', 'Diseño de barba, afeitado clásico y perfilado con navaja.', 10),
  ('color', '🎨', 'Coloración', 'Coloración de cabello y cobertura de canas.', 20);

insert into services (id, category_id, booking_group, name, duration, price, description, sort_order, duration_minutes) values
  ('corte-clasico', 'cortes', 'Principales', 'Corte clásico', '30min', '25', 'Corte tradicional a tijera y máquina, incluye lavado.', 0, 30),
  ('fade', 'cortes', 'Principales', 'Fade', '40min', '30', 'Degradado moderno, acabado preciso en los laterales.', 10, 40),
  ('corte-barba', 'cortes', 'Principales', 'Corte + barba', '45min', '45', 'Corte completo más diseño de barba en una sola cita.', 20, 45),
  ('diseno-barba', 'barba', 'Complementarios', 'Diseño de barba', '20min', '20', 'Perfilado y diseño de barba con navaja.', 30, 20),
  ('afeitado-clasico', 'barba', 'Complementarios', 'Afeitado clásico', '30min', '20', 'Afeitado tradicional con toalla caliente y navaja.', 40, 30),
  ('perfilado-barba', 'barba', 'Complementarios', 'Perfilado de barba', '15min', '15', 'Mantenimiento rápido de contornos de barba.', 50, 15),
  ('corte-nino', 'cortes', 'Opcionales', 'Corte niños', '30min', '20', 'Corte para niños hasta 12 años.', 60, 30),
  ('coloracion', 'color', 'Opcionales', 'Coloración de cabello', '60min', '60', 'Coloración completa o cobertura de canas.', 70, 60),
  ('mascarilla-facial', 'barba', 'Opcionales', 'Mascarilla facial', '20min', '25', 'Limpieza facial e hidratación post-afeitado.', 80, 20);

insert into products (name, price, description, sort_order) values
  ('Pomada clásica', 35, 'Fijación fuerte con acabado mate, para todo tipo de peinado.', 0),
  ('Cera moldeadora', 30, 'Fijación media con brillo natural, fácil de aplicar.', 10),
  ('Shampoo anticaída', 40, 'Shampoo fortalecedor de uso diario.', 20),
  ('Aceite para barba', 35, 'Hidrata y suaviza la barba, aroma amaderado.', 30);

update site_content set
  hero_eyebrow = 'Los Olivos, Lima · Todos los días',
  hero_title = 'Estilo y precisión en cada corte',
  hero_subtitle = 'Barbería profesional: cortes clásicos, fade, diseño de barba y afeitado tradicional para el hombre moderno.',
  about_eyebrow = 'Sobre Cieza Barber',
  about_title = 'Especialistas en cortes de precisión',
  about_body = 'En Cieza Barber Studio combinamos técnica clásica y tendencias actuales para que cada cliente salga con el mejor corte. Atendemos en Los Olivos todos los días.',
  footer_tagline = 'Barbería profesional en Los Olivos: cortes, barba y productos de cuidado masculino.'
where id = 1;

insert into testimonials (name, service, quote, sort_order, avatar_url) values
  ('Jorge M.', 'Corte + barba', 'Excelente atención, el corte quedó tal cual lo pedí.', 0, 'https://images.unsplash.com/photo-1641318175316-795cd2db99f8?w=100&q=60&auto=format&fit=crop'),
  ('Renzo P.', 'Fade', 'El mejor fade que me han hecho en Los Olivos.', 10, 'https://images.unsplash.com/photo-1759134248487-e8baaf31e33e?w=100&q=60&auto=format&fit=crop'),
  ('Diego C.', 'Diseño de barba', 'Muy detallistas con la barba, quedé encantado.', 20, 'https://images.unsplash.com/photo-1698365039593-5180c517bb96?w=100&q=60&auto=format&fit=crop'),
  ('Luis A.', 'Afeitado clásico', 'Ambiente cómodo y atención puntual, ya es mi barbería de siempre.', 30, 'https://images.unsplash.com/photo-1701992678962-41703126549c?w=100&q=60&auto=format&fit=crop');
