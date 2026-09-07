create table if not exists public.progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;

create policy "owner can read own progress"
  on public.progress for select
  using (auth.uid() = user_id);

create policy "owner can insert own progress"
  on public.progress for insert
  with check (auth.uid() = user_id);

create policy "owner can update own progress"
  on public.progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
