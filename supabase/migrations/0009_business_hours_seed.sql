-- Horario real del brief: Lun–Sáb, horario partido 8am–12pm y 2pm–6pm.
-- Domingo (weekday 0) queda sin filas = cerrado.
insert into business_hours (weekday, opens_at, closes_at)
values
  (1, '08:00'::time, '12:00'::time), (1, '14:00'::time, '18:00'::time),
  (2, '08:00'::time, '12:00'::time), (2, '14:00'::time, '18:00'::time),
  (3, '08:00'::time, '12:00'::time), (3, '14:00'::time, '18:00'::time),
  (4, '08:00'::time, '12:00'::time), (4, '14:00'::time, '18:00'::time),
  (5, '08:00'::time, '12:00'::time), (5, '14:00'::time, '18:00'::time),
  (6, '08:00'::time, '12:00'::time), (6, '14:00'::time, '18:00'::time);
