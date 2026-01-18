# instagram-mvp (Supabase Edition)

MVP giống Instagram mini: **Auth (login/register)** + **Post ảnh** + **Feed** + **Like** + **Comment**.

Repo này đã được sửa thành **frontend-only** và dùng **Supabase** (Auth + Database + Storage).
> GitHub Pages chỉ host web tĩnh, không chạy backend Node.js.

---

## 1) Setup Supabase

### 1.1 Tạo project
Tạo project mới trên Supabase.

### 1.2 Tạo bucket Storage
Storage -> Create bucket:
- `post-images`
- `stories`
- `chat-media`

Khuyến dùng Public cho MVP (để chạy nhanh).

### 1.3 Tạo bảng + RLS policies (đầy đủ)
Database -> SQL Editor -> Run (copy toàn bộ):

```sql
create extension if not exists pgcrypto;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  caption text default ''::text,
  image_path text not null,
  location text,
  music_url text,
  created_at timestamptz not null default now()
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);
alter table public.posts enable row level security;

create policy "posts_select" on public.posts
for select to authenticated using (true);
create policy "posts_insert_own" on public.posts
for insert to authenticated with check (auth.uid() = user_id);
create policy "posts_update_own" on public.posts
for update to authenticated using (auth.uid() = user_id);
create policy "posts_delete_own" on public.posts
for delete to authenticated using (auth.uid() = user_id);

create table if not exists public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists likes_post_id_idx on public.likes (post_id);
alter table public.likes enable row level security;

create policy "likes_select" on public.likes
for select to authenticated using (true);
create policy "likes_insert_own" on public.likes
for insert to authenticated with check (auth.uid() = user_id);
create policy "likes_delete_own" on public.likes
for delete to authenticated using (auth.uid() = user_id);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists comments_post_id_idx on public.comments (post_id, created_at desc);
alter table public.comments enable row level security;

create policy "comments_select" on public.comments
for select to authenticated using (true);
create policy "comments_insert_own" on public.comments
for insert to authenticated with check (auth.uid() = user_id);
create policy "comments_delete_own" on public.comments
for delete to authenticated using (auth.uid() = user_id);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  username text not null,
  avatar_url text,
  bio text,
  updated_at timestamptz not null default now()
);
create unique index if not exists profiles_username_key on public.profiles (username);
alter table public.profiles enable row level security;

create policy "profiles_select" on public.profiles
for select to authenticated using (true);
create policy "profiles_insert_own" on public.profiles
for insert to authenticated with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles
for update to authenticated using (auth.uid() = user_id);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  image_path text not null,
  music_url text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists stories_user_id_idx on public.stories (user_id, created_at desc);
alter table public.stories enable row level security;

create policy "stories_select" on public.stories
for select to authenticated using (true);
create policy "stories_insert_own" on public.stories
for insert to authenticated with check (auth.uid() = user_id);
create policy "stories_delete_own" on public.stories
for delete to authenticated using (auth.uid() = user_id);

create table if not exists public.highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  cover_path text not null,
  created_at timestamptz not null default now()
);
create index if not exists highlights_user_id_idx on public.highlights (user_id, created_at desc);
alter table public.highlights enable row level security;

create policy "highlights_select" on public.highlights
for select to authenticated using (true);
create policy "highlights_insert_own" on public.highlights
for insert to authenticated with check (auth.uid() = user_id);
create policy "highlights_update_own" on public.highlights
for update to authenticated using (auth.uid() = user_id);
create policy "highlights_delete_own" on public.highlights
for delete to authenticated using (auth.uid() = user_id);

create table if not exists public.bookmarks (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.bookmarks enable row level security;

create policy "bookmarks_select" on public.bookmarks
for select to authenticated using (true);
create policy "bookmarks_insert_own" on public.bookmarks
for insert to authenticated with check (auth.uid() = user_id);
create policy "bookmarks_delete_own" on public.bookmarks
for delete to authenticated using (auth.uid() = user_id);

create table if not exists public.hidden_posts (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.hidden_posts enable row level security;

create policy "hidden_posts_select" on public.hidden_posts
for select to authenticated using (auth.uid() = user_id);
create policy "hidden_posts_insert_own" on public.hidden_posts
for insert to authenticated with check (auth.uid() = user_id);
create policy "hidden_posts_delete_own" on public.hidden_posts
for delete to authenticated using (auth.uid() = user_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null,
  post_id uuid references public.posts(id) on delete set null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_id_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;

create policy "notifications_select_own" on public.notifications
for select to authenticated using (auth.uid() = user_id);
create policy "notifications_insert" on public.notifications
for insert to authenticated with check (auth.uid() = actor_id);
create policy "notifications_update_own" on public.notifications
for update to authenticated using (auth.uid() = user_id);

create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id)
);
alter table public.follows enable row level security;

create policy "follows_select" on public.follows
for select to authenticated using (true);
create policy "follows_insert_own" on public.follows
for insert to authenticated with check (auth.uid() = follower_id);
create policy "follows_delete_own" on public.follows
for delete to authenticated using (auth.uid() = follower_id);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;

create policy "reports_insert_own" on public.reports
for insert to authenticated with check (auth.uid() = reporter_id);
create policy "reports_select_own" on public.reports
for select to authenticated using (auth.uid() = reporter_id);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_a, user_b)
);
alter table public.conversations enable row level security;

create policy "conversations_select_member" on public.conversations
for select to authenticated using (auth.uid() = user_a or auth.uid() = user_b);
create policy "conversations_insert_member" on public.conversations
for insert to authenticated with check (auth.uid() = user_a or auth.uid() = user_b);
create policy "conversations_delete_member" on public.conversations
for delete to authenticated using (auth.uid() = user_a or auth.uid() = user_b);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  text text,
  image_url text,
  sticker_url text,
  is_recalled boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at desc);
alter table public.messages enable row level security;

create policy "messages_select_member" on public.messages
for select to authenticated using (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
  )
);
create policy "messages_insert_sender" on public.messages
for insert to authenticated with check (
  auth.uid() = sender_id
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
  )
);
create policy "messages_update_sender" on public.messages
for update to authenticated using (auth.uid() = sender_id);
create policy "messages_delete_sender" on public.messages
for delete to authenticated using (auth.uid() = sender_id);
```

### 1.4 Lấy keys
Supabase Dashboard -> Project Settings -> API:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## 2) Chạy local

### 2.1 Tạo file .env
Tạo file `.env` tại thư mục gốc project:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 2.2 Cài đặt và chạy

```bash
npm install
npm run dev
```

---

## 3) Deploy GitHub Pages

1. Push repo lên GitHub (branch `main`).
2. Settings -> Pages -> Source: **GitHub Actions**.
3. Settings -> Secrets and variables -> Actions -> New repository secret:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

Workflow sẽ build Vite và deploy lên Pages.

---

## 4) Commit code lên repo

```bash
git status -sb
git add -A
git commit -m "your message"
git push origin main
```
