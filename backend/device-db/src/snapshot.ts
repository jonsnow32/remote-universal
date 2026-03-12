/**
 * Snapshot export.
 *
 * Reads all catalog rows from Supabase and exports them to a JSON file,
 * computes an HMAC-SHA256 signature, and writes a manifest.
 *
 * The JSON snapshot is what mobile apps download via OTA update.
 * In production you would also upload it to CDN (S3, Cloudflare R2, etc.).
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SnapshotManifest {
  version: string;
  createdAt: string;
  brands: number;
  models: number;
  commands: number;
  sha256: string;
  filePath: string;
}

export async function exportSnapshot(
  client: SupabaseClient | undefined,
  version: string,
  outputDir: string
): Promise<SnapshotManifest> {
  if (!client) throw new Error('exportSnapshot called without a Supabase client');
  await fs.mkdir(outputDir, { recursive: true });

  // Fetch all catalog rows in parallel
  const [brandsRes, modelsRes, commandsRes] = await Promise.all([
    client.from('brands').select('*'),
    client.from('device_models').select('*'),
    client.from('command_definitions').select('*'),
  ]);

  for (const res of [brandsRes, modelsRes, commandsRes]) {
    if (res.error) throw new Error(`Snapshot fetch error: ${res.error.message}`);
  }

  const catalog = {
    version,
    exportedAt: new Date().toISOString(),
    brands:   brandsRes.data,
    models:   modelsRes.data,
    commands: commandsRes.data,
  };

  const json = JSON.stringify(catalog);
  const fileName = `catalog_${version}.json`;
  const filePath = path.join(outputDir, fileName);
  await fs.writeFile(filePath, json, 'utf-8');

  // HMAC-SHA256 signature using the Supabase service key as HMAC secret
  const secret = process.env['SUPABASE_SERVICE_KEY'] ?? 'dev-secret';
  const sha256 = crypto.createHmac('sha256', secret).update(json).digest('hex');

  // Write companion .sig file
  await fs.writeFile(`${filePath}.sig`, sha256, 'utf-8');

  const manifest: SnapshotManifest = {
    version,
    createdAt: new Date().toISOString(),
    brands:   (brandsRes.data ?? []).length,
    models:   (modelsRes.data ?? []).length,
    commands: (commandsRes.data ?? []).length,
    sha256,
    filePath,
  };

  // Write manifest JSON
  await fs.writeFile(
    path.join(outputDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );

  console.log(
    `[snapshot] Exported ${manifest.models} models / ${manifest.commands} commands → ${fileName}`
  );

  return manifest;
}
