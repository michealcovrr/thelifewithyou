-- Add layout storage to books table
alter table public.books add column if not exists layout jsonb;
