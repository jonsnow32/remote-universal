-- =============================================================================
-- Migration 001: Device Catalog Schema
-- Apply via: Supabase SQL Editor or psql
-- Tables: brands, device_models, command_definitions
-- =============================================================================

-- ─── brands ──────────────────────────────────────────────────────────────────
-- One row per manufacturer brand (slug is the primary key for stable references).

create table if not exists public.brands (
  id            text        primary key,          -- slug, e.g. "samsung"
  name          text        not null,              -- display name, e.g. "Samsung"
  slug          text        not null unique,       -- same as id, kept for clarity
  logo_uri      text,                              -- CDN URL to logo image
  country       text,                              -- ISO 3166-1 alpha-2, e.g. "KR"
  website       text,
  canonical_id  text references public.brands(id), -- for brand aliases → parent brand
  created_at    bigint      not null default extract(epoch from now())::bigint,
  updated_at    bigint      not null default extract(epoch from now())::bigint
);

create index if not exists idx_brands_slug on public.brands (slug);

-- ─── device_models ───────────────────────────────────────────────────────────
-- One row per (brand, model_number) pair.
-- `protocols` and `capabilities` stored as JSON arrays for schema flexibility.

create table if not exists public.device_models (
  id              text    primary key,    -- "{brand_slug}.{model_slug}", e.g. "samsung.qn55q80c"
  brand_id        text    not null references public.brands(id) on delete cascade,
  model_number    text    not null,
  model_name      text    not null,
  category        text    not null,       -- "tv", "ac", "projector", etc.
  year_from       int,
  year_to         int,
  protocols       text    not null default '[]',  -- JSON: ["ir","wifi","bluetooth"]
  capabilities    text    not null default '[]',  -- JSON: ["power","volume","input"]
  thumbnail_uri   text,
  source          text    not null,       -- "flipper" | "irdb" | "samsung" | etc.
  catalog_version text,                   -- YYYYMMDD-HHMMSS build stamp
  created_at      bigint  not null default extract(epoch from now())::bigint,
  updated_at      bigint  not null default extract(epoch from now())::bigint
);

create index if not exists idx_device_models_brand_id   on public.device_models (brand_id);
create index if not exists idx_device_models_category   on public.device_models (category);
create index if not exists idx_device_models_model_num  on public.device_models (model_number);

-- ─── command_definitions ─────────────────────────────────────────────────────
-- One row per command (button) for a model or brand.
-- IR commands use ir_pronto / ir_raw columns.
-- WiFi/ADB/ECP commands use wifi_* columns.

create table if not exists public.command_definitions (
  id              text    primary key,    -- "{model_id}.{cmd_name}", e.g. "samsung.qn55q80c.power"
  model_id        text    references public.device_models(id) on delete cascade,
  brand_id        text    references public.brands(id)        on delete cascade,
  name            text    not null,       -- machine key, e.g. "POWER_TOGGLE"
  label           text    not null,       -- human label, e.g. "Power"
  icon            text,                   -- icon name for the UI kit
  capability      text,                   -- "power" | "volume_up" | "input_hdmi1" | etc.
  sort_order      int     not null default 0,

  -- IR transport
  ir_pronto       text,                   -- Pronto hex string
  ir_raw          text,                   -- raw on/off pulse timings
  ir_frequency    int,                    -- carrier frequency in Hz (default 38 000)
  ir_protocol     text,                   -- "NEC" | "RC5" | "SIRC" | etc.

  -- WiFi / ADB / ECP transport
  wifi_method     text,                   -- "GET" | "POST" | "PUT" | "WS" | "SOAP" | "ADB" | "ECP"
  wifi_endpoint   text,                   -- relative URL or ADB keyevent target
  wifi_payload    text,                   -- JSON body, ADB keycode, or ECP key string
  wifi_headers    text                    -- JSON object of extra HTTP headers (SOAP action, etc.)
);

create index if not exists idx_cmd_model_id   on public.command_definitions (model_id);
create index if not exists idx_cmd_brand_id   on public.command_definitions (brand_id);
create index if not exists idx_cmd_capability on public.command_definitions (capability);
create index if not exists idx_cmd_name       on public.command_definitions (name);

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- Read-only by default for anon/authenticated users.
-- Writes are done via the service-role key (bypasses RLS).

alter table public.brands              enable row level security;
alter table public.device_models       enable row level security;
alter table public.command_definitions enable row level security;

-- Allow any authenticated or anonymous user to read
do $$ begin
  create policy "public read brands"    on public.brands              for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read models"    on public.device_models       for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "public read commands"  on public.command_definitions for select using (true);
exception when duplicate_object then null; end $$;
