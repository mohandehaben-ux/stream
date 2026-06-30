-- ELITE CRM & XTREAM MASTER DATABASE SCHEMA
-- Paste this script into Supabase SQL Editor and click RUN.

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";

-- 2. USERS TABLE
create table if not exists public.users (
    id uuid default uuid_generate_v4() primary key,
    username text not null unique,
    password_hash text not null,
    role text not null check (role in ('admin', 'reseller')),
    credits numeric(10, 2) default 0.00 not null,
    status text default 'active' not null check (status in ('active', 'disabled')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. XTREAM PANELS TABLE
create table if not exists public.xtream_panels (
    id serial primary key,
    name text not null,
    domain_url text not null,
    api_username text not null,
    api_password text not null,
    status text default 'active' not null check (status in ('active', 'disabled')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. SERVICES TABLE
create table if not exists public.services (
    id serial primary key,
    service_name text not null,
    cost_credits numeric(10, 2) not null,
    package_id integer not null,
    panel_id integer references public.xtream_panels(id) on delete cascade not null,
    status text default 'active' not null check (status in ('active', 'disabled')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. SUBSCRIPTIONS LOG TABLE
create table if not exists public.subscriptions_log (
    id text primary key,
    sub_reseller_id uuid references public.users(id) on delete cascade not null,
    line_username text not null,
    line_password text not null,
    panel_id integer references public.xtream_panels(id) on delete cascade not null,
    service_id integer references public.services(id) on delete cascade not null,
    expire_date timestamp with time zone not null,
    status text default 'active' not null check (status in ('active', 'disabled')),
    notes text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. CODE CATEGORIES TABLE
create table if not exists public.code_categories (
    id serial primary key,
    name text not null unique,
    price numeric(10, 2) not null,
    available_count integer default 0 not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. ACTIVE CODES TABLE
create table if not exists public.active_codes (
    id uuid default uuid_generate_v4() primary key,
    code text not null unique,
    category_id integer references public.code_categories(id) on delete cascade not null,
    status text default 'active' not null check (status in ('active', 'sold')),
    sold_to uuid references public.users(id) on delete set null,
    sold_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. ACTIVITY LOGS TABLE
create table if not exists public.activity_logs (
    id uuid default uuid_generate_v4() primary key,
    reseller_id uuid references public.users(id) on delete cascade not null,
    action text not null,
    credits_before numeric(10, 2) not null,
    credits_after numeric(10, 2) not null,
    details text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. DEFAULT SEED DATA
-- Insert default admin account (password is: admin123)
insert into public.users (username, password_hash, role, credits, status)
values ('admin', '$2b$10$U.g8qC6nJjV2iC9t61j2Ke6w3nQ69dD2nL91H2k0y3G8nJmN.6W1O', 'admin', 999999.00, 'active')
on conflict (username) do nothing;

-- Insert default reseller account (username: medo2026, password: password123)
insert into public.users (username, password_hash, role, credits, status)
values ('medo2026', '$2b$10$Z1e0w/C.m9dD6Hj89v34O.EwD3Fk6w91j2Ke6w3nQ69dD2nL91H2k', 'reseller', 100.00, 'active')
on conflict (username) do nothing;

-- 10. IPTV CUSTOMERS TABLE
create table if not exists public.iptv_customers (
    id uuid default uuid_generate_v4() primary key,
    username text not null,
    password text,
    expire_date timestamp with time zone,
    phone_number text,
    note text,
    mac_address text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);


