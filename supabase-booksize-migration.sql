-- Run in Supabase SQL Editor
alter table public.books
  add column if not exists book_size text default 'portrait-8x10';
