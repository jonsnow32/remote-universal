-- =============================================================================
-- Migration 003: IR Code Library Tables
-- Apply via: pnpm db:migrate  OR  paste into Supabase SQL Editor
-- Tables: ir_brands, ir_codesets, ir_codes
-- =============================================================================

-- ─── ir_brands ───────────────────────────────────────────────────────────────
-- One row per (brand, device-category) pair in the IR database.
-- catalog_brand_id links back to public.brands.id for cross-referencing.

create table if not exists public.ir_brands (
  id               text    primary key,           -- e.g. "samsung-tv"
  name             text    not null,               -- display name, e.g. "Samsung"
  category         text    not null,               -- "tv" | "ac" | "speaker" | etc.
  catalog_brand_id text    references public.brands(id) on delete set null,
  priority         integer not null default 0,     -- higher = shown first
  code_count       integer not null default 0      -- denormalized for fast display
);

create index if not exists idx_ir_brands_catalog  on public.ir_brands (catalog_brand_id, category);
create index if not exists idx_ir_brands_category on public.ir_brands (category);

-- ─── ir_codesets ─────────────────────────────────────────────────────────────
-- A codeset is a group of IR codes that work together for a specific
-- model pattern within a brand+category.

create table if not exists public.ir_codesets (
  id                   text    primary key,
  brand_id             text    not null references public.ir_brands(id) on delete cascade,
  model_pattern        text,                       -- e.g. "QN85*" or NULL for generic
  protocol_name        text,                       -- "NEC" | "RC5" | "SIRC" | etc.
  carrier_frequency_hz integer not null default 38000,
  source               text    not null default '', -- "flipper" | "irdb" | "manual" | etc.
  match_confidence     real    not null default 0   -- 0–1, used for ranking
);

create index if not exists idx_ir_codesets_brand on public.ir_codesets (brand_id);

-- ─── ir_codes ────────────────────────────────────────────────────────────────
-- Individual IR commands within a codeset.

create table if not exists public.ir_codes (
  id               text    primary key,
  codeset_id       text    not null references public.ir_codesets(id) on delete cascade,
  function_name    text    not null,               -- machine key, e.g. "POWER_TOGGLE"
  function_label   text,                           -- human label, e.g. "Power"
  pronto_hex       text,                           -- Pronto hex string (preferred)
  raw_pattern      text,                           -- JSON array of µs timings (fallback)
  raw_frequency_hz integer                         -- carrier Hz for raw_pattern
);

create index if not exists idx_ir_codes_codeset on public.ir_codes (codeset_id);
create index if not exists idx_ir_codes_fn      on public.ir_codes (codeset_id, function_name);

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table public.ir_brands   enable row level security;
alter table public.ir_codesets enable row level security;
alter table public.ir_codes    enable row level security;

do $$ begin
  create policy "public read ir_brands"   on public.ir_brands   for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read ir_codesets" on public.ir_codesets for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read ir_codes"    on public.ir_codes    for select using (true);
exception when duplicate_object then null; end $$;

-- ─── Write policies (mirror 002_write_policies.sql for IR tables) ─────────────

do $$ begin
  create policy "service write ir_brands"   on public.ir_brands   for insert with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "service update ir_brands"  on public.ir_brands   for update using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "service write ir_codesets"  on public.ir_codesets for insert with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "service update ir_codesets" on public.ir_codesets for update using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "service write ir_codes"    on public.ir_codes    for insert with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "service update ir_codes"   on public.ir_codes    for update using (true) with check (true);
exception when duplicate_object then null; end $$;
