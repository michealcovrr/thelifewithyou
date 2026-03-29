-- Run this in your Supabase SQL Editor

-- Add print details + tracking to books
alter table public.books
  add column if not exists print_details jsonb,
  add column if not exists tracking_number text;

-- Extend status check to include new values
alter table public.books
  drop constraint if exists books_status_check;

alter table public.books
  add constraint books_status_check
  check (status in (
    'collecting','curating','printing',
    'review','proof_sent','approved','shipped','delivered'
  ));
