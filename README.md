# instagram-mvp (Supabase Edition)

MVP giống Instagram mini: **Auth (login/register)** + **Post ảnh** + **Feed** + **Like** + **Comment**.

Repo này đã được sửa thành **frontend-only** và dùng **Supabase** (Auth + Database + Storage).
> GitHub Pages chỉ host web tĩnh, không chạy backend Node.js.

---

## 1) Setup Supabase

### 1.1 Tạo project
Tạo project mới trên Supabase.

### 1.2 Tạo bucket Storage
Storage -> Create bucket: `post-images`
- Khuyến dùng Public (để MVP chạy nhanh).

### 1.3 Tạo bảng + RLS policies
Database -> SQL Editor -> Run (copy toàn bộ):

```sql
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  caption text default ""::text,
  image_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  username text not null,
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_username_key on public.profiles (username);

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists comments_post_id_idx on public.comments (post_id, created_at desc);

alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.profiles enable row level security;

create policy "posts_select" on public.posts
for select to authenticated using (true);
create policy "posts_insert" on public.posts
for insert to authenticated with check (auth.uid() = user_id);
create policy "posts_update_own" on public.posts
for update to authenticated using (auth.uid() = user_id);
create policy "posts_delete_own" on public.posts
for delete to authenticated using (auth.uid() = user_id);

create policy "likes_select" on public.likes
for select to authenticated using (true);
create policy "likes_insert_own" on public.likes
for insert to authenticated with check (auth.uid() = user_id);
create policy "likes_delete_own" on public.likes
for delete to authenticated using (auth.uid() = user_id);

create policy "comments_select" on public.comments
for select to authenticated using (true);
create policy "comments_insert_own" on public.comments
for insert to authenticated with check (auth.uid() = user_id);
create policy "comments_delete_own" on public.comments
for delete to authenticated using (auth.uid() = user_id);

create policy "profiles_select" on public.profiles
for select to authenticated using (true);
create policy "profiles_insert_own" on public.profiles
for insert to authenticated with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles
for update to authenticated using (auth.uid() = user_id);
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
