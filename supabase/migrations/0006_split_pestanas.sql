-- El servicio único "pestanas" no reflejaba la realidad: el brief del cliente
-- describe dos servicios distintos con duración y precio propios.
-- Monto de adelanto no especificado en el brief para estos dos (solo dice
-- "sí" sin monto) — queda null hasta que se confirme, editable desde el panel.
insert into services (id, category_id, booking_group, name, duration, price, description, sort_order) values
('pestanas-pelo-a-pelo', 'pestanas', 'Opcionales', 'Pestañas pelo a pelo', '2h', '100–150', 'Extensión de pestañas pelo a pelo para un efecto natural y duradero.', 30),
('pestanas-1x1', 'pestanas', 'Opcionales', 'Pestañas 1x1', '30min', '50', 'Extensión de pestañas 1x1, técnica rápida y de acabado clásico.', 35);

delete from services where id = 'pestanas';
