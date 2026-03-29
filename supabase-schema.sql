-- ============================================================
-- The Life of Us — Supabase Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- BOOKS
create table if not exists public.books (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  title         text not null,
  occasion_type text not null check (occasion_type in ('memorial','birthday','anniversary','graduation','other')),
  deadline      date,
  invite_token  uuid unique not null default gen_random_uuid(),
  status        text not null default 'collecting'
                  check (status in ('collecting','curating','printing','delivered')),
  cover_photo_url text,
  page_count    int,
  created_at    timestamptz default now() not null
);

alter table public.books enable row level security;

create policy "Users can manage own books"
  on public.books for all
  using (auth.uid() = user_id);

-- SUBMISSIONS (no auth required — contributors use invite link)
create table if not exists public.submissions (
  id                uuid primary key default gen_random_uuid(),
  book_id           uuid references public.books(id) on delete cascade not null,
  contributor_name  text not null,
  contributor_email text,
  photo_urls        text[] not null default '{}',
  caption           text,
  submitted_at      timestamptz default now() not null
);

alter table public.submissions enable row level security;

-- Organisers can read all submissions for their books
create policy "Organisers can read submissions for their books"
  on public.submissions for select
  using (
    exists (
      select 1 from public.books b
      where b.id = submissions.book_id
        and b.user_id = auth.uid()
    )
  );

-- Anyone can insert a submission (contributors don't log in)
create policy "Anyone can submit photos"
  on public.submissions for insert
  with check (true);

-- ORDERS
create table if not exists public.orders (
  id                        uuid primary key default gen_random_uuid(),
  book_id                   uuid references public.books(id) on delete cascade not null,
  stripe_payment_intent_id  text,
  prodigi_order_id          text,
  page_count                int not null,
  amount_charged            numeric(10,2) not null,
  shipping_address          jsonb not null,
  status                    text not null default 'pending'
                              check (status in ('pending','paid','processing','shipped','delivered')),
  created_at                timestamptz default now() not null
);

alter table public.orders enable row level security;

create policy "Users can view own orders"
  on public.orders for select
  using (
    exists (
      select 1 from public.books b
      where b.id = orders.book_id
        and b.user_id = auth.uid()
    )
  );

-- Allow service role to insert orders (webhook)
create policy "Service role can insert orders"
  on public.orders for insert
  with check (true);

-- STORAGE BUCKET
-- Run this too:
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict do nothing;

-- Allow anyone to upload to submissions folder
create policy "Anyone can upload photos"
  on storage.objects for insert
  with check (bucket_id = 'photos');

-- Allow public to view photos
create policy "Public photo access"
  on storage.objects for select
  using (bucket_id = 'photos');
