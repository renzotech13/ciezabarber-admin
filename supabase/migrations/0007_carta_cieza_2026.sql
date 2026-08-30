-- Carta real de Cieza Barber Studio (agosto 2026).
--
-- El sitio muestra esta misma lista desde web/assets/servicios.js, pero la
-- reserva (web y WhatsApp) valida los `servicio_ids` contra esta tabla: sin
-- esta migración el modal de reserva sigue ofreciendo el catálogo de ejemplo.
--
-- Los servicios viejos se desactivan en vez de borrarse: las citas ya
-- registradas guardan su id y deben seguir siendo legibles en el admin.
--
-- PENDIENTE: 'servicio-premium' y 'ritual-barba' quedan con price
-- 'Consultar' porque el negocio todavía no fijó el precio. Cambiarlo desde
-- el admin (Servicios) o con un update aquí cuando esté definido.

-- 1. Categorías -------------------------------------------------------------
update service_categories set
  title = 'Corte & barba',
  description = 'Corte de cabello, ritual de barba con toalla caliente y masajes, y combos con facial.',
  icon = '✂️',
  images = array['assets/img/ciezabarber_1.jpg', 'assets/img/ciezabarber_2.jpg'],
  sort_order = 0,
  active = true
where id = 'cortes';

update service_categories set
  title = 'Color & textura',
  description = 'Mechas, platinado global, ondulación y camuflaje de canas con evaluación capilar previa.',
  icon = '🎨',
  images = array['assets/img/ciezabarber_4.jpg'],
  sort_order = 10,
  active = true
where id = 'color';

insert into service_categories (id, icon, title, description, images, sort_order, active)
values (
  'facial', '🧖',
  'Facial',
  'Limpieza facial con vaporizador, exfoliación, extracción, masajes y mascarilla hidratante.',
  array['assets/img/CiezaBarber_local_4.jpg'], 20, true
)
on conflict (id) do update set
  icon = excluded.icon, title = excluded.title, description = excluded.description,
  images = excluded.images, sort_order = excluded.sort_order, active = true;

update service_categories set active = false where id = 'barba';

-- 2. Servicios viejos fuera de la carta --------------------------------------
update services set active = false
where id in (
  'corte-clasico','fade','corte-barba','diseno-barba','afeitado-clasico',
  'perfilado-barba','corte-nino','coloracion','mascarilla-facial'
);

-- 3. Carta actual ------------------------------------------------------------
insert into services (id, category_id, booking_group, name, duration, price, description, sort_order, duration_minutes, active) values
  ('corte-basico', 'cortes', 'Principales', 'Corte básico', '45 min', '40',
   'Corte de cabello.', 0, 45, true),

  ('experiencia-cieza', 'cortes', 'Principales', 'Experiencia Cieza', '1 h', '60',
   'Corte de cabello, desinflamante de ojeras, asesoramiento personalizado, lavado de cabello y acabado con productos premium.', 10, 60, true),

  ('corte-ritual-barba', 'cortes', 'Principales', 'Corte + ritual de barba', '1 h', '70',
   'Corte de cabello y barba, con toalla caliente y masajes.', 20, 60, true),

  ('servicio-premium', 'cortes', 'Principales', 'Servicio premium', '1 h 20 min', 'Consultar',
   'Corte de cabello detallado + limpieza facial profunda con exfoliación, vaporizador, toallas calientes y mascarilla hidratante.', 30, 80, true),

  ('servicio-lujo', 'cortes', 'Principales', 'Servicio de lujo', '1 h 30 min', '130',
   'Corte de cabello + barba + limpieza facial.', 40, 90, true),

  ('ritual-barba', 'cortes', 'Complementarios', 'Ritual de barba', '40 min', 'Consultar',
   'Corte de barba + vaporizador + toalla caliente y masajes.', 50, 40, true),

  ('facial-basico', 'facial', 'Complementarios', 'Facial básico', '45 min', '60',
   'Limpieza facial + vaporizador + toalla caliente + masajes y mascarilla hidratante.', 60, 45, true),

  ('limpieza-facial-premium', 'facial', 'Complementarios', 'Limpieza facial premium', '1 h', '80',
   'Limpieza facial + extracción de puntos negros + doble exfoliación + masajes y mascarilla hidratante con vitamina C.', 70, 60, true),

  ('camuflaje-canas', 'color', 'Opcionales', 'Camuflaje de canas', '1 h', '80',
   'Ideal para verse más joven sin perder la apariencia natural.', 80, 60, true),

  ('ondulacion', 'color', 'Opcionales', 'Ondulación', '2 a 3 h', '220',
   'Ondulación y semi ondulación: ondas suaves, naturales o marcadas según tu preferencia, con volumen y movimiento.', 90, 150, true),

  ('mechas-iluminacion', 'color', 'Opcionales', 'Mechas e iluminación', '3 a 4 h', '250',
   'Babylights, balayage, face framing o mechas clásicas. Incluye decoloración selectiva, matización, tratamiento nutritivo y finalizado con styling.', 100, 210, true),

  ('platinado-global', 'color', 'Opcionales', 'Platinado global', '3 a 4 h', '300',
   'Gris/plata frío y uniforme. Incluye decoloración total, matización, tratamiento hidratante y sellado de color. Requiere evaluación capilar previa.', 110, 210, true)
on conflict (id) do update set
  category_id = excluded.category_id,
  booking_group = excluded.booking_group,
  name = excluded.name,
  duration = excluded.duration,
  price = excluded.price,
  description = excluded.description,
  sort_order = excluded.sort_order,
  duration_minutes = excluded.duration_minutes,
  active = true;

-- 4. Copy del sitio ----------------------------------------------------------
update site_content set
  hero_eyebrow = 'Los Olivos, Lima · Todos los días',
  hero_title = 'Más que una barbería',
  hero_subtitle = 'Cortes de precisión, ritual de barba, color y limpieza facial en Los Olivos. Todos los días de 10am a 9pm.',
  about_eyebrow = 'Nuestra historia',
  about_title = 'Estilo que se nota',
  about_body = 'En Cieza Barber Studio combinamos técnica clásica y tendencias actuales: cortes de precisión, rituales de barba con toalla caliente, color, limpieza facial y asesoría personalizada. Bebida de cortesía en todos los servicios.',
  footer_tagline = 'Barbería en Los Olivos, Lima. Distribuidor autorizado de MUK Hair Perú.'
where id = 1;
