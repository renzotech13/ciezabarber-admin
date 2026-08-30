-- El bot y la reserva web guardaban la preferencia de barbero como texto
-- suelto dentro de `citas.notas` ("Barbero preferido: Cieza."), lo que hacía
-- imposible una columna o un filtro reales en el panel de Reservas. Ahora
-- es un campo propio.
alter table citas add column barbero text check (barbero in ('Cieza', 'Nilton', 'Bryan'));
create index citas_barbero_idx on citas (barbero);
