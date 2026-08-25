-- Fase 5: siembra site_content/testimonials con el texto que hoy está
-- hardcodeado en index.html, para que activar el fetch no deje la página
-- vacía.

update site_content set
  hero_eyebrow = 'Los Olivos, Lima · Lun–Sáb',
  hero_title = 'Belleza, formación y cuidado para la mujer',
  hero_subtitle = 'Cremas y skincare para el cuidado de tu piel, salón especializado en microblading y academia con cursos certificados.',
  hero_image_url = 'assets/hero-image.webp',
  about_eyebrow = 'Sobre Raabta',
  about_title = 'Especialistas en realzar tu belleza natural',
  about_body = 'En Raabta Beauty Academy creamos un espacio dedicado a la mujer: cremas y cuidado de la piel, tratamientos de belleza especializados y la formación de nuevas profesionales. Atendemos en Los Olivos con cita previa.',
  about_image_big = 'assets/gallery-1.webp',
  about_image_small1 = 'assets/gallery-5.webp',
  about_image_small2 = 'assets/gallery-4.webp',
  footer_tagline = 'Portal de belleza, salón y academia de formación para la mujer en Los Olivos, Lima.'
where id = 1;

insert into testimonials (avatar_url, name, service, quote, sort_order) values
  ('assets/avatar-1.webp', 'María F.', 'Microblading', 'Quedé encantada con mis cejas. El trabajo es muy natural y la atención de primera.', 0),
  ('assets/avatar-2.webp', 'Karla T.', 'Curso Microblading básico', 'El curso mixto me permitió practicar en el local y repasar con las clases grabadas.', 10),
  ('assets/avatar-3.webp', 'Daniela R.', 'Micropigmentación de labios', 'Resultado precioso y duradero. El adelanto para reservar da seguridad a ambas partes.', 20),
  ('assets/avatar-4.webp', 'Sofía L.', 'Cuidado facial', 'Las cremas son de excelente calidad y el pago contra entrega me dio confianza.', 30);
