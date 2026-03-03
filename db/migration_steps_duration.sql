-- Добавляем поле "оценка времени на шаг" (в минутах)
alter table steps
  add column if not exists duration_minutes integer check (duration_minutes is null or duration_minutes > 0);
