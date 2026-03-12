-- =============================================================================
-- Migration 002: Grant write access for the device-db crawl service
--
-- The crawl pipeline uses the publishable (anon-role) key.
-- Add INSERT + UPDATE policies so it can populate the catalog tables.
-- DELETE is intentionally excluded — data is only added or updated, never removed.
-- =============================================================================

-- ─── brands ──────────────────────────────────────────────────────────────────
do $$ begin
  create policy "service write brands" on public.brands for insert with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "service update brands" on public.brands for update using (true) with check (true);
exception when duplicate_object then null; end $$;

-- ─── device_models ───────────────────────────────────────────────────────────
do $$ begin
  create policy "service write models" on public.device_models for insert with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "service update models" on public.device_models for update using (true) with check (true);
exception when duplicate_object then null; end $$;

-- ─── command_definitions ─────────────────────────────────────────────────────
do $$ begin
  create policy "service write commands" on public.command_definitions for insert with check (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "service update commands" on public.command_definitions for update using (true) with check (true);
exception when duplicate_object then null; end $$;
