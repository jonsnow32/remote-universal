import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules } from 'react-native';

/**
 * Sentinel error code returned when the TV rejects the connection with
 * ms.channel.unauthorized (Access Notification is disabled on the TV, or the
 * user has not yet allowed the pairing popup).
 */
export const SAMSUNG_UNAUTHORIZED = '__SAMSUNG_UNAUTHORIZED__';

/** Map of layout action ids → Samsung Tizen key codes */
export const SAMSUNG_KEY_MAP: Record<string, string> = {
  POWER_TOGGLE:  'KEY_POWER',
  VOLUME_UP:     'KEY_VOLUP',
  VOLUME_DOWN:   'KEY_VOLDOWN',
  MUTE:          'KEY_MUTE',
  CHANNEL_UP:    'KEY_CHUP',
  CHANNEL_DOWN:  'KEY_CHDOWN',
  DPAD_UP:       'KEY_UP',
  DPAD_DOWN:     'KEY_DOWN',
  DPAD_LEFT:     'KEY_LEFT',
  DPAD_RIGHT:    'KEY_RIGHT',
  DPAD_OK:       'KEY_ENTER',
  HOME:          'KEY_HOME',
  BACK:          'KEY_RETURN',
  MENU:          'KEY_MENU',
  SOURCE:        'KEY_SOURCE',
  NETFLIX:       'KEY_NETFLIX',
  YOUTUBE:       'KEY_APP_YOUTUBE',
};

// Storage key prefixes
const TOKEN_PREFIX = 'samsung_token_';
const PORT_PREFIX  = 'samsung_port_';
const DEVID_KEY    = 'samsung_device_id';

/** Get the stored device ID (used when reconnecting with existing token). */
async function getSavedDeviceId(): Promise<string | null> {
  return AsyncStorage.getItem(DEVID_KEY);
}

/** Generate a fresh random device ID (used for each new pairing attempt). */
function newDeviceId(): string {
  return Math.random().toString(16).slice(2, 10);
}

/**
 * Samsung Tizen TV — LAN WebSocket remote control.
 *
 * Port strategy:
 *   2018+ TVs require WSS on port 8002 (self-signed TLS).
 *   Older TVs use plain WS on port 8001.
 *   We try 8002 first; on failure fall back to 8001. The working port is cached.
 *
 * Connection lifecycle:
 *   connect(ip)    → open persistent WebSocket, pair if needed
 *   sendKey(ip, k) → send via persistent WS (opens one if needed)
 *   disconnect(ip) → close the WebSocket
 *
 * Pairing flow (first connect):
 *   connect → TV shows popup → user clicks Allow
 *           → TV sends token in ms.channel.connect
 *           → token saved to AsyncStorage
 *   All future connects include the token → no popup again.
 */
export class SamsungTizen {
  // ── Persistent connections (ip → open WebSocket) ─────────────────────
  private static sessions = new Map<string, WebSocket>();
  private static readySessions = new Set<string>();
  // Mutex: only one connect() per IP at a time.
  private static connecting = new Map<string, Promise<void>>();

  /** Build WS URL for a given ip/port/token. */
  private static buildUrl(ip: string, port: number, token: string | null, deviceId: string): string {
    const appName = btoa(`Universal Remote ${deviceId}`);
    const scheme = port === 8002 ? 'wss' : 'ws';
    const tokenParam = token ? `&token=${token}` : '';
    return `${scheme}://${ip}:${port}/api/v2/channels/samsung.remote.control?name=${appName}${tokenParam}`;
  }

  /**
   * Open a persistent WebSocket to the TV.
   * Tries WSS port 8002 first; falls back to WS port 8001.
   * Resolves once `ms.channel.connect` is received (TV is ready for keys).
   *
   * @param onUnauthorized  Called as soon as the TV sends `ms.channel.unauthorized`
   *                        (i.e. the Allow popup just appeared on the TV screen).
   *                        Use this to show a guiding modal in the UI.
   */
  static async connect(ip: string, onUnauthorized?: () => void): Promise<void> {
    // Already connected?
    if (SamsungTizen.sessions.has(ip) && SamsungTizen.readySessions.has(ip)) return;

    // Mutex: if a connect() is already in flight for this IP, piggyback on it.
    const inflight = SamsungTizen.connecting.get(ip);
    if (inflight) return inflight;

    const p = SamsungTizen.connectInner(ip, onUnauthorized).finally(() => {
      SamsungTizen.connecting.delete(ip);
    });
    SamsungTizen.connecting.set(ip, p);
    return p;
  }

  private static async connectInner(ip: string, onUnauthorized?: () => void): Promise<void> {

    // Close stale session if any.
    SamsungTizen.disconnectSync(ip);

    const storedToken = await AsyncStorage.getItem(TOKEN_PREFIX + ip);

    // When we have a token (reconnection), reuse the saved device ID so the TV
    // recognises us.  For first-time pairing (no token), generate a FRESH random
    // ID every attempt — this avoids hitting the TV's blocked-device list.
    const deviceId = storedToken
      ? (await getSavedDeviceId()) ?? newDeviceId()
      : newDeviceId();

    // SamsungTizenPairingModule uses lazy init (BaseReactPackage / New Architecture).
    // initialize() — which calls WebSocketModule.setCustomClientBuilder — only runs
    // when the module is first accessed from JS. Call pairWithTV (no-op on Android)
    // to force that initialization before any WebSocket is created.
    const pairingMod = NativeModules.SamsungTizenPairing as
      { pairWithTV(ip: string, deviceId: string): Promise<void> } | null | undefined;
    if (pairingMod) {
      try { await pairingMod.pairWithTV(ip, deviceId); } catch { /* ignore */ }
    }

    // SamsungTizenPairingModule.initialize() sets WebSocketModule.setCustomClientBuilder
    // so the JS WebSocket can negotiate Samsung's self-signed cert on WSS 8002.
    // JS handles the full pairing flow (popup → token → persistent WSS 8002 session).
    const cachedPort = await AsyncStorage.getItem(PORT_PREFIX + ip);
    console.log(`[SamsungTizen] connect ip=${ip} token=${storedToken ? 'yes' : 'none'} cachedPort=${cachedPort} deviceId=${deviceId}`);

    // Probe TV info once (helps diagnose model-specific issues).
    void SamsungTizen.probeTv(ip);

    // Prefer the last working port (cached). For no-token (first pairing) or
    // unknown port: try WSS 8002 first — the popup only appears on 8002.
    const ports = storedToken && cachedPort === '8001' ? [8001, 8002]
                : storedToken && cachedPort === '8002' ? [8002, 8001]
                : [8002, 8001];

    let lastError: Error | null = null;
    for (let i = 0; i < ports.length; i++) {
      const port = ports[i];
      // No token (first-time pairing): ALL ports get 30s so the user has time
      // to accept the TV popup even when port 8002 fails instantly (SSL cert).
      // With an existing token (reconnect): first port gets 30s, fallback 10s.
      const retryMs = i === 0 || !storedToken ? 30_000 : 10_000;
      try {
        await SamsungTizen.tryConnect(ip, port, storedToken, deviceId, retryMs, onUnauthorized);
        // Cache the working port.
        void AsyncStorage.setItem(PORT_PREFIX + ip, String(port));
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.log(`[SamsungTizen] Port ${port} failed: ${lastError.message}`);
        // If unauthorized with a stale token, clear everything and re-enter
        // connectInner to start a fresh WSS 8002 pairing (popup flow).
        if (lastError.message === SAMSUNG_UNAUTHORIZED && storedToken) {
          console.log('[SamsungTizen] Stale token — clearing and re-pairing...');
          await AsyncStorage.removeItem(TOKEN_PREFIX + ip);
          await AsyncStorage.removeItem(PORT_PREFIX + ip);
          return SamsungTizen.connectInner(ip, onUnauthorized);
        }
      }
    }
    throw lastError ?? new Error(`Cannot connect to TV at ${ip}`);
  }

  /**
   * Attempt a WebSocket connection on a specific port.
   * Resolves on ms.channel.connect.
   *
   * With token: single attempt, fail fast on unauthorized (stale token).
   * Without token: retry every 2s until ms.channel.connect or deadline (popup flow).
   */
  private static tryConnect(ip: string, port: number, token: string | null, deviceId: string, retryMs = 30_000, onUnauthorized?: () => void): Promise<void> {
    if (token) {
      // Have a token — single attempt. Unauthorized means stale token; don't retry.
      return SamsungTizen.tryConnectOnce(ip, port, token, Math.min(retryMs, 10_000), deviceId, onUnauthorized);
    }
    // No token — retry every 2s until the TV shows the popup and user clicks Allow.
    return new Promise<void>((resolve, reject) => {
      const deadline = Date.now() + retryMs;
      let cancelled = false;

      const attempt = () => {
        if (cancelled || Date.now() > deadline) {
          reject(new Error(SAMSUNG_UNAUTHORIZED));
          return;
        }

        const remaining = deadline - Date.now();
        SamsungTizen.tryConnectOnce(ip, port, null, remaining, deviceId, onUnauthorized)
          .then(resolve)
          .catch((err) => {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg === SAMSUNG_UNAUTHORIZED && Date.now() < deadline) {
              console.log('[SamsungTizen] TV closed WS after unauthorized, reconnecting in 2s...');
              setTimeout(attempt, 2_000);
            } else {
              cancelled = true;
              reject(err);
            }
          });
      };

      attempt();
    });
  }

  /**
   * Single WS connection attempt. Resolves on ms.channel.connect, rejects on error.
   *
   * Key: does NOT close the WS on ms.channel.unauthorized. Keeps the connection
   * open so older TVs can send ms.channel.connect on the same socket after the
   * user clicks Allow. If the TV itself closes the WS, onclose fires and we
   * settle with SAMSUNG_UNAUTHORIZED so the caller's retry loop can reconnect.
   */
  private static tryConnectOnce(ip: string, port: number, token: string | null, timeoutMs: number, deviceId: string, onUnauthorized?: () => void): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const url = SamsungTizen.buildUrl(ip, port, token, deviceId);
      console.log(`[SamsungTizen] Connecting ${port === 8002 ? 'WSS' : 'WS'} port ${port}, token: ${token ? 'yes' : 'none'}, deviceId: ${deviceId}`);
      console.log(`[SamsungTizen] URL: ${url}`);

      const ws = new WebSocket(url);
      let settled = false;
      let gotUnauthorized = false;
      // Ensure onUnauthorized fires at most once regardless of which trigger fires first.
      let firedUnauthorized = false;
      const fireUnauthorized = () => {
        if (!firedUnauthorized) {
          firedUnauthorized = true;
          onUnauthorized?.();
        }
      };

      const settle = (err?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err) {
          try { ws.close(); } catch (_) {}
          SamsungTizen.sessions.delete(ip);
          SamsungTizen.readySessions.delete(ip);
          reject(err);
        } else {
          resolve();
        }
      };

      const timer = setTimeout(() => {
        if (gotUnauthorized) {
          // Waited the full timeout after unauthorized — user never accepted.
          settle(new Error(SAMSUNG_UNAUTHORIZED));
        } else {
          settle(new Error(`TV at ${ip}:${port} did not respond`));
        }
      }, timeoutMs);

      ws.onopen = () => {
        console.log(`[SamsungTizen] WS open port ${port}, waiting for TV handshake...`);
        // No token means the TV will show an Allow popup immediately after the WS opens.
        // Fire the callback now so the UI guide appears before the popup can disappear.
        if (!token) {
          fireUnauthorized();
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            event: string;
            data?: { token?: string };
          };
          console.log('[SamsungTizen] event:', msg.event);

          if (msg.event === 'ms.channel.connect') {
            const newToken = msg.data?.token;
            if (newToken && newToken !== token) {
              void AsyncStorage.setItem(TOKEN_PREFIX + ip, newToken);
              console.log('[SamsungTizen] Token saved');
            }
            // Persist the device ID that the TV accepted so future reconnects
            // use the same name.
            void AsyncStorage.setItem(DEVID_KEY, deviceId);
            SamsungTizen.sessions.set(ip, ws);
            SamsungTizen.readySessions.add(ip);
            settle();

          } else if (msg.event === 'ms.channel.unauthorized') {
            // DON'T close the WS! Older TVs keep it open and will send
            // ms.channel.connect on this same socket after user clicks Allow.
            if (!gotUnauthorized) {
              gotUnauthorized = true;
              // For the stale-token case this is the first trigger; for the no-token
              // case fireUnauthorized() is a no-op (already fired on ws.onopen).
              fireUnauthorized();
            }
            console.log('[SamsungTizen] Unauthorized on port', port, '— keeping WS open, waiting for Allow...');
          }
        } catch {
          // ignore non-JSON messages
        }
      };

      ws.onerror = () => {
        // If the TV already sent ms.channel.unauthorized, an error/abnormal-close
        // (code 1006) is just the TV dropping the WS after showing the popup.
        // Treat it the same as onclose-after-unauthorized so the retry loop
        // reconnects instead of surfacing "Cannot reach TV".
        if (gotUnauthorized) {
          settle(new Error(SAMSUNG_UNAUTHORIZED));
        } else {
          settle(new Error(`Cannot reach TV at ${ip}:${port}`));
        }
      };

      ws.onclose = (e) => {
        console.log(`[SamsungTizen] WS closed port ${port} code: ${e.code}`);
        SamsungTizen.readySessions.delete(ip);
        if (SamsungTizen.sessions.get(ip) === ws) {
          SamsungTizen.sessions.delete(ip);
        }
        if (!settled) {
          if (gotUnauthorized) {
            // TV closed the WS after unauthorized (newer TV behavior).
            // Let the retry loop in tryConnect reconnect.
            settle(new Error(SAMSUNG_UNAUTHORIZED));
          } else {
            settle(new Error(`TV closed connection (port ${port}, code ${e.code})`));
          }
        }
      };
    });
  }

  /** Close the persistent WebSocket for an IP. */
  static disconnect(ip: string): void {
    SamsungTizen.connecting.delete(ip);
    SamsungTizen.disconnectSync(ip);
  }

  private static disconnectSync(ip: string): void {
    const ws = SamsungTizen.sessions.get(ip);
    if (ws) {
      SamsungTizen.sessions.delete(ip);
      SamsungTizen.readySessions.delete(ip);
      try { ws.close(); } catch (_) {}
    }
  }

  /**
   * Send a raw Tizen key code (e.g. 'KEY_HOME') to the TV at the given IP.
   * Opens a persistent connection if one isn't already established.
   */
  static async sendKey(ip: string, keyCode: string): Promise<void> {
    // Ensure we have a live connection.
    if (!SamsungTizen.readySessions.has(ip)) {
      await SamsungTizen.connect(ip);
    }

    const ws = SamsungTizen.sessions.get(ip);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      // Session died between check and use — reconnect once.
      SamsungTizen.disconnectSync(ip);
      await SamsungTizen.connect(ip);
      return SamsungTizen.sendKey(ip, keyCode);
    }

    ws.send(JSON.stringify({
      method: 'ms.remote.control',
      params: {
        Cmd: 'Click',
        DataOfCmd: keyCode,
        Option: 'false',
        TypeOfRemote: 'SendRemoteKey',
      },
    }));
  }

  /**
   * Send a layout action string (e.g. 'HOME', 'VOLUME_UP') to the TV.
   * Automatically maps via SAMSUNG_KEY_MAP; falls back to KEY_<ACTION>.
   */
  static sendAction(ip: string, action: string): Promise<void> {
    const keyCode = SAMSUNG_KEY_MAP[action] ?? `KEY_${action}`;
    return SamsungTizen.sendKey(ip, keyCode);
  }

  /**
   * Open the TV's built-in search / voice input UI.
   * Triggers the same behaviour as pressing the mic/search button on a physical
   * Samsung remote — the TV opens its search overlay and waits for text input.
   */
  static openVoiceSearch(ip: string): Promise<void> {
    return SamsungTizen.sendKey(ip, 'KEY_SEARCH');
  }

  // ── Raw audio voice streaming (ms.remote.voice protocol) ─────────────────
  //
  // Physical Samsung remotes stream raw PCM audio over the same WebSocket
  // connection used for key events.  The TV's built-in ASR engine processes
  // the audio and displays results on screen (search, app launch, etc.) —
  // exactly what happens when you hold the mic button on a physical remote.
  //
  // Sequence:
  //   1. startVoiceSession  → TV opens voice UI + starts ASR
  //   2. sendVoiceAudioChunk (called repeatedly, ~80 ms per chunk)
  //   3. stopVoiceSession   → TV finalises recognition, executes command

  /**
   * Signal the TV to open its voice recognition overlay and start ASR.
   * Call this immediately when the user presses the mic button, before
   * sending any audio chunks.
   */
  static async startVoiceSession(ip: string): Promise<void> {
    if (!SamsungTizen.readySessions.has(ip)) await SamsungTizen.connect(ip);

    const ws = SamsungTizen.sessions.get(ip);
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      SamsungTizen.disconnectSync(ip);
      await SamsungTizen.connect(ip);
      return SamsungTizen.startVoiceSession(ip);
    }

    ws.send(JSON.stringify({
      method: 'ms.remote.voice',
      params: { Cmd: 'Start', TypeOfRemote: 'VoiceReq' },
    }));
  }

  /**
   * Stream a ~80 ms chunk of base64-encoded 16 kHz / mono / 16-bit PCM audio
   * to the TV.  Call this inside your mic chunk listener while the user is speaking.
   *
   * The TV feeds these chunks into its ASR engine in real-time and updates the
   * on-screen transcript, exactly like the physical remote's mic button.
   */
  static sendVoiceAudioChunk(ip: string, base64Pcm: string): void {
    const ws = SamsungTizen.sessions.get(ip);
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({
      method: 'ms.remote.voice',
      params: {
        Cmd: 'Audio',
        AudioData: base64Pcm,
        TypeOfRemote: 'VoiceReq',
      },
    }));
  }

  /**
   * Tell the TV that the user has stopped speaking.
   * The TV finalises ASR, executes the recognised command (search, app launch,
   * etc.) and dismisses the voice overlay — no further processing in the app.
   */
  static async stopVoiceSession(ip: string): Promise<void> {
    const ws = SamsungTizen.sessions.get(ip);
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({
      method: 'ms.remote.voice',
      params: { Cmd: 'Stop', TypeOfRemote: 'VoiceReq' },
    }));
  }

  /** Clear the stored pairing token for a TV (forces re-pairing). */
  static async clearToken(ip: string): Promise<void> {
    await AsyncStorage.removeItem(TOKEN_PREFIX + ip);
    await AsyncStorage.removeItem(PORT_PREFIX + ip);
    await AsyncStorage.removeItem(DEVID_KEY);
    SamsungTizen.connecting.delete(ip);
    SamsungTizen.disconnectSync(ip);
  }

  /**
   * Probe TV REST API to learn model, firmware, etc.
   * Non-blocking fire-and-forget — just logs for diagnostics.
   */
  static async probeTv(ip: string): Promise<Record<string, unknown> | null> {
    try {
      const res = await fetch(`http://${ip}:8001/api/v2/`);
      const info = await res.json() as Record<string, unknown>;
      console.log('[SamsungTizen] TV info:', JSON.stringify(info, null, 2));
      return info;
    } catch (err) {
      console.log('[SamsungTizen] TV probe failed:', err instanceof Error ? err.message : String(err));
      return null;
    }
  }
}
