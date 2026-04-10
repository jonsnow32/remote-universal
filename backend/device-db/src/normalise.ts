/**
 * Normalise raw parsed data into a canonical NormalisedModelEntry shape.
 *
 * Two input paths:
 *  1. OEMRawDevice  → NormalisedModelEntry  (WiFi-based brands)
 *  2. IRRawEntry[]  → NormalisedModelEntry  (IR-only brands from IRDB/Flipper)
 *     Multiple IRRawEntry records with the same brand/category are grouped
 *     into a single NormalisedModelEntry where each entry becomes a command.
 */

import type {
  OEMRawDevice,
  OEMRawCommand,
  IRRawEntry,
  NormalisedModelEntry,
  NormalisedCommand,
  SourceId,
} from './types';

// ─── Brand name → slug + country ─────────────────────────────────────────

/** Well-known brand domains used to resolve Clearbit logo URIs. */
const BRAND_DOMAIN: Record<string, string> = {
  samsung:     'samsung.com',
  lg:          'lg.com',
  sony:        'sony.com',
  panasonic:   'panasonic.com',
  philips:     'philips.com',
  hisense:     'hisense.com',
  tcl:         'tcl.com',
  vizio:       'vizio.com',
  roku:        'roku.com',
  amazon:      'amazon.com',
  android_tv:  'android.com',
  xiaomi:      'mi.com',
  toshiba:     'toshiba.com',
  sharp:       'sharp.com',
  haier:       'haier.com',
  skyworth:    'skyworth.com',
  changhong:   'changhong.com',
  jvc:         'jvc.com',
  hitachi:     'hitachi.com',
  grundig:     'grundig.com',
  loewe:       'loewe.com',
  metz:        'metz-tv.de',
  vestel:      'vestel.com.tr',
  daikin:      'daikin.com',
  mitsubishi:  'mitsubishi-electric.com',
  fujitsu:     'fujitsu.com',
  denon:       'denon.com',
  yamaha:      'yamaha.com',
  pioneer:     'pioneer-audiovisual.com',
  onkyo:       'onkyo.com',
};

/** Returns a logo URL for a brand slug, or undefined if no domain is mapped.
 *  Uses Google's S2 favicon service — free, no auth, returns a PNG. */
export function brandLogoUri(slug: string): string | undefined {
  const domain = BRAND_DOMAIN[slug];
  return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : undefined;
}

const BRAND_ALIAS: Record<string, { slug: string; name: string; country?: string }> = {
  samsung:          { slug: 'samsung',    name: 'Samsung',     country: 'KR' },
  'samsung electronics': { slug: 'samsung', name: 'Samsung',   country: 'KR' },
  lg:               { slug: 'lg',         name: 'LG',          country: 'KR' },
  'lg electronics': { slug: 'lg',         name: 'LG',          country: 'KR' },
  sony:             { slug: 'sony',       name: 'Sony',        country: 'JP' },
  panasonic:        { slug: 'panasonic',  name: 'Panasonic',   country: 'JP' },
  philips:          { slug: 'philips',    name: 'Philips',     country: 'NL' },
  hisense:          { slug: 'hisense',    name: 'Hisense',     country: 'CN' },
  tcl:              { slug: 'tcl',        name: 'TCL',         country: 'CN' },
  vizio:            { slug: 'vizio',      name: 'Vizio',       country: 'US' },
  roku:             { slug: 'roku',       name: 'Roku',        country: 'US' },
  amazon:           { slug: 'amazon',     name: 'Amazon',      country: 'US' },
  'android tv':     { slug: 'android_tv', name: 'Android TV',  country: 'US' },
  xiaomi:           { slug: 'xiaomi',     name: 'Xiaomi',      country: 'CN' },
  'mi':             { slug: 'xiaomi',     name: 'Xiaomi',      country: 'CN' },
  toshiba:          { slug: 'toshiba',    name: 'Toshiba',     country: 'JP' },
  sharp:            { slug: 'sharp',      name: 'Sharp',       country: 'JP' },
  haier:            { slug: 'haier',      name: 'Haier',       country: 'CN' },
  skyworth:         { slug: 'skyworth',   name: 'Skyworth',    country: 'CN' },
  changhong:        { slug: 'changhong',  name: 'Changhong',   country: 'CN' },
  jvc:              { slug: 'jvc',        name: 'JVC',         country: 'JP' },
  hitachi:          { slug: 'hitachi',    name: 'Hitachi',     country: 'JP' },
  grundig:          { slug: 'grundig',    name: 'Grundig',     country: 'DE' },
  loewe:            { slug: 'loewe',      name: 'Loewe',       country: 'DE' },
  metz:             { slug: 'metz',       name: 'Metz',        country: 'DE' },
  vestel:           { slug: 'vestel',     name: 'Vestel',      country: 'TR' },
  daikin:           { slug: 'daikin',     name: 'Daikin',      country: 'JP' },
  mitsubishi:       { slug: 'mitsubishi', name: 'Mitsubishi',  country: 'JP' },
  fujitsu:          { slug: 'fujitsu',    name: 'Fujitsu',     country: 'JP' },
  denon:            { slug: 'denon',      name: 'Denon',       country: 'JP' },
  yamaha:           { slug: 'yamaha',     name: 'Yamaha',      country: 'JP' },
  pioneer:          { slug: 'pioneer',    name: 'Pioneer',     country: 'JP' },
  onkyo:            { slug: 'onkyo',      name: 'Onkyo',       country: 'JP' },
};

export function normaliseBrand(
  raw: string
): { slug: string; name: string; country?: string } {
  const key = raw.trim().toLowerCase();
  return BRAND_ALIAS[key] ?? {
    slug: key.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
    name: raw.trim(),
  };
}

// ─── Category normalisation ───────────────────────────────────────────────

const CATEGORY_MAP: Record<string, string> = {
  tv: 'tv', television: 'tv', 'smart tv': 'tv',
  ac: 'ac', 'air conditioner': 'ac', aircon: 'ac', hvac: 'ac', climate: 'ac',
  speaker: 'speaker', audio: 'speaker', soundbar: 'soundbar',
  light: 'light', lighting: 'light', bulb: 'light',
  fan: 'fan',
  projector: 'projector',
  stb: 'set_top_box', 'set top box': 'set_top_box', 'set-top box': 'set_top_box',
  sat: 'set_top_box', satellite: 'set_top_box',
  dvd: 'dvd_bluray', bluray: 'dvd_bluray', 'blu-ray': 'dvd_bluray', 'blu ray': 'dvd_bluray',
  streaming: 'streaming_stick', 'streaming stick': 'streaming_stick', dongle: 'streaming_stick',
  receiver: 'receiver', amp: 'receiver', amplifier: 'receiver',
  hub: 'hub',
};

export function normaliseCategory(raw: string): string {
  const key = raw.trim().toLowerCase();
  return CATEGORY_MAP[key] ?? 'other';
}

// ─── Command name → label + capability mappings ────────────────────────────

const CMD_META: Record<string, { label: string; capability?: string; sort?: number }> = {
  power: { label: 'Power',          capability: 'power', sort: 0 },
  power_on: { label: 'Power On',    capability: 'power', sort: 1 },
  power_off: { label: 'Power Off',  capability: 'power', sort: 2 },
  power_toggle: { label: 'Power',   capability: 'power', sort: 0 },
  vol_up: { label: 'Vol +',         capability: 'volume', sort: 10 },
  vol_down: { label: 'Vol −',       capability: 'volume', sort: 11 },
  mute: { label: 'Mute',            capability: 'volume', sort: 12 },
  unmute: { label: 'Unmute',        capability: 'volume', sort: 13 },
  mute_toggle: { label: 'Mute',     capability: 'volume', sort: 12 },
  ch_up: { label: 'CH +',           capability: 'channel', sort: 20 },
  ch_down: { label: 'CH −',         capability: 'channel', sort: 21 },
  'ch_0': { label: '0', capability: 'channel', sort: 30 },
  'ch_1': { label: '1', capability: 'channel', sort: 31 },
  'ch_2': { label: '2', capability: 'channel', sort: 32 },
  play: { label: 'Play',            capability: 'media', sort: 50 },
  pause: { label: 'Pause',          capability: 'media', sort: 51 },
  stop: { label: 'Stop',            capability: 'media', sort: 52 },
  fast_forward: { label: '⏩',      capability: 'media', sort: 53 },
  rewind: { label: '⏪',            capability: 'media', sort: 54 },
  up: { label: '▲',                 capability: 'navigation', sort: 60 },
  down: { label: '▼',               capability: 'navigation', sort: 61 },
  left: { label: '◀',               capability: 'navigation', sort: 62 },
  right: { label: '▶',              capability: 'navigation', sort: 63 },
  ok: { label: 'OK',                capability: 'navigation', sort: 64 },
  select: { label: 'OK',            capability: 'navigation', sort: 64 },
  home: { label: 'Home',            capability: 'navigation', sort: 70 },
  back: { label: 'Back',            capability: 'navigation', sort: 71 },
  menu: { label: 'Menu',            capability: 'navigation', sort: 72 },
  info: { label: 'Info',            capability: 'navigation', sort: 73 },
  guide: { label: 'Guide',          capability: 'navigation', sort: 74 },
  hdmi1: { label: 'HDMI 1',         capability: 'input_source', sort: 80 },
  hdmi2: { label: 'HDMI 2',         capability: 'input_source', sort: 81 },
  hdmi3: { label: 'HDMI 3',         capability: 'input_source', sort: 82 },
  hdmi4: { label: 'HDMI 4',         capability: 'input_source', sort: 83 },
};

function commandMeta(
  name: string
): { label: string; capability?: string; sort_order?: number } {
  const lower = name.toLowerCase().replace(/[-\s]+/g, '_');
  const m = CMD_META[lower];
  if (m) return { label: m.label, capability: m.capability, sort_order: m.sort };
  // Fallback: make a readable label from the snake_case/camelCase name
  const label = lower
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase());
  return { label };
}

// ─── Protocol inference ───────────────────────────────────────────────────

function inferProtocols(device: OEMRawDevice): string[] {
  switch (device.control_type) {
    case 'ir':        return ['ir'];
    case 'wifi_rest':
    case 'wifi_ws':   return ['wifi', 'ir'];
    case 'soap':      return ['wifi', 'ir'];
    case 'ecp':       return ['wifi', 'ir'];
    case 'adb':       return ['wifi'];
    case 'ble':       return ['ble'];
    default:          return ['ir'];
  }
}

// ─── OEMRawDevice → NormalisedModelEntry ─────────────────────────────────

export function normaliseOEMDevice(device: OEMRawDevice): NormalisedModelEntry {
  const brand = normaliseBrand(device.manufacturer);
  const category = normaliseCategory(device.category);
  const protocols = inferProtocols(device);
  const capabilities = Array.from(
    new Set([...(device.capabilities ?? []).map(c => normaliseCapability(c))])
  ).filter(Boolean);

  const commands: NormalisedCommand[] = device.commands.map(c =>
    normaliseOEMCommand(c, device)
  );

  return {
    source: device.source,
    brand_slug: brand.slug,
    brand_name: brand.name,
    brand_country: brand.country,
    model_number: device.model_number,
    model_name: device.model_name,
    category,
    protocols,
    capabilities,
    commands,
  };
}

function normaliseOEMCommand(
  cmd: OEMRawCommand,
  device: OEMRawDevice
): NormalisedCommand {
  const name = toCommandSlug(cmd.name);
  const meta = commandMeta(name);

  const base: NormalisedCommand = {
    name,
    label: meta.label,
    capability: meta.capability,
    sort_order: meta.sort_order,
  };

  switch (device.control_type) {
    case 'wifi_rest':
      return { ...base, wifi_method: cmd.method, wifi_endpoint: cmd.endpoint,
                        wifi_payload: cmd.payload, wifi_headers: cmd.headers };
    case 'wifi_ws':
      return { ...base, wifi_method: 'WS', wifi_endpoint: cmd.endpoint,
                        wifi_payload: cmd.payload };
    case 'soap':
      return { ...base, wifi_method: cmd.method,
                        wifi_endpoint: cmd.endpoint,
                        soap_action: cmd.soap_action,
                        soap_body: cmd.soap_body };
    case 'ecp':
      return { ...base, ecp_key: cmd.ecp_key ?? cmd.name,
                        wifi_method: 'POST',
                        wifi_endpoint: cmd.endpoint };
    case 'adb':
      return { ...base, adb_keycode: cmd.adb_keycode,
                        wifi_method: 'ADB', wifi_payload: cmd.payload };
    default:
      return base;
  }
}

// ─── IRRawEntry[] → NormalisedModelEntry ─────────────────────────────────

/**
 * Group a flat list of IR entries (same brand + category) into model entries.
 * Each unique file_path = one model entry.
 */
export function normaliseIREntries(entries: IRRawEntry[]): NormalisedModelEntry[] {
  const byFile = new Map<string, IRRawEntry[]>();
  for (const e of entries) {
    const arr = byFile.get(e.file_path) ?? [];
    arr.push(e);
    byFile.set(e.file_path, arr);
  }

  const results: NormalisedModelEntry[] = [];
  for (const [filePath, fileEntries] of byFile) {
    if (fileEntries.length === 0) continue;
    const first = fileEntries[0]!;
    const brand = normaliseBrand(first.brand_raw);
    const category = normaliseCategory(first.category_raw);
    // Derive model number: prefer explicit hint (e.g. SmartIR supportedModels),
    // otherwise fall back to the filename with all known extensions stripped.
    const modelNumber = first.model_hint
      ?? (filePath.split(/[/\\]/).pop() ?? filePath)
           .replace(/\.ir$|\.csv$|\.json$/, '')
           .replace(/,/g, '_');

    const commands: NormalisedCommand[] = fileEntries.map(e =>
      normaliseIRCommand(e)
    );

    // When model_hint is a comma-separated list (e.g. SmartIR supportedModels),
    // expand into one entry per individual model number so each is searchable.
    const modelNumbers = modelNumber.includes(',')
      ? modelNumber.split(',').map(s => s.trim()).filter(Boolean)
      : [modelNumber];

    const capabilities = inferIRCapabilities(commands.map(c => c.name));
    for (const mn of modelNumbers) {
      results.push({
        source: first.source,
        brand_slug: brand.slug,
        brand_name: brand.name,
        brand_country: brand.country,
        model_number: mn,
        model_name: `${brand.name} ${mn}`,
        category,
        protocols: ['ir'],
        capabilities,
        commands,
      });
    }
  }
  return results;
}

function normaliseIRCommand(entry: IRRawEntry): NormalisedCommand {
  const name = entry.function_name;
  const meta = commandMeta(name);

  const cmd: NormalisedCommand = {
    name,
    label: meta.label,
    capability: meta.capability,
    sort_order: meta.sort_order,
    ir_protocol: entry.protocol,
    ir_frequency: entry.frequency,
  };

  if (entry.pronto) {
    cmd.ir_pronto = entry.pronto;
  } else if (entry.raw_data && entry.raw_data.length > 0) {
    cmd.ir_raw = JSON.stringify({ frequency: entry.frequency ?? 38000, pattern: entry.raw_data });
    cmd.ir_frequency = entry.frequency ?? 38000;
  } else if (entry.protocol && entry.address && entry.command) {
    // Store parsed Flipper signal as structured ir_raw for app-side decode
    cmd.ir_raw = JSON.stringify({
      protocol: entry.protocol,
      address: entry.address,
      command: entry.command,
    });
  }

  return cmd;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function toCommandSlug(name: string): string {
  return name
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')   // camelCase → snake
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase();
}

const CAPABILITY_ALIAS: Record<string, string> = {
  switch: 'power', power: 'power',
  audiovolume: 'volume', volume: 'volume',
  audiomute: 'volume', mute: 'volume',
  tvchannel: 'channel', channel: 'channel',
  mediainputsource: 'input_source', input_source: 'input_source',
  mediaplayback: 'media', media: 'media',
  launcher: 'navigation', navigation: 'navigation',
  temperature: 'temperature', climatecontrol: 'temperature',
  fan_speed: 'fan_speed', fanspeed: 'fan_speed',
  swing: 'swing', mode: 'mode',
};

function normaliseCapability(raw: string): string {
  return CAPABILITY_ALIAS[raw.toLowerCase().replace(/[^a-z]/g, '')] ?? raw.toLowerCase();
}

function inferIRCapabilities(commandNames: string[]): string[] {
  const caps = new Set<string>();
  for (const name of commandNames) {
    const lc = name.toLowerCase();
    if (lc.includes('power') || lc.includes('standby')) caps.add('power');
    if (lc.includes('vol'))     caps.add('volume');
    if (lc.includes('ch') || lc.includes('channel')) caps.add('channel');
    if (lc.includes('play') || lc.includes('pause') || lc.includes('stop')) caps.add('media');
    if (lc.includes('up') || lc.includes('down') || lc.includes('left') || lc.includes('right') || lc.includes('ok')) caps.add('navigation');
    if (lc.includes('hdmi') || lc.includes('input')) caps.add('input_source');
  }
  return Array.from(caps);
}
