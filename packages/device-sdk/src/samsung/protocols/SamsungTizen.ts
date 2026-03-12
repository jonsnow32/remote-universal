import AsyncStorage from '@react-native-async-storage/async-storage';

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

/**
 * Samsung Tizen TV — LAN WebSocket remote control (port 8001).
 *
 * Pairing flow:
 *   1st connect → TV shows popup → user clicks Allow
 *               → TV sends token in ms.channel.connect
 *               → token saved to AsyncStorage
 *   All future connects include the token → no popup again.
 *
 * Usage:
 *   await SamsungTizen.sendKey('192.168.1.21', 'KEY_HOME');
 *   // or from a layout action:
 *   await SamsungTizen.sendAction('192.168.1.21', 'HOME');
 */
export class SamsungTizen {
  private static tokenStorageKey(ip: string): string {
    return `samsung_token_${ip}`;
  }

  /** Send a raw Tizen key code (e.g. 'KEY_HOME') to the TV at the given IP. */
  static async sendKey(ip: string, keyCode: string): Promise<void> {
    const tokenKey = SamsungTizen.tokenStorageKey(ip);
    const storedToken = await AsyncStorage.getItem(tokenKey);

    return new Promise<void>((resolve, reject) => {
      const appName = btoa('Universal Remote');
      const tokenParam = storedToken ? `&token=${storedToken}` : '';
      const url = `ws://${ip}:8001/api/v2/channels/samsung.remote.control?name=${appName}${tokenParam}`;

      console.log('[SamsungTizen] Connecting, token:', storedToken ?? 'none', 'key:', keyCode);
      const ws = new WebSocket(url);
      let settled = false;
      let keySent = false;
      let isUnauthorized = false;

      const settle = (err?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        ws.close();
        if (err) reject(err);
        else resolve();
      };

      const timer = setTimeout(() => {
        console.warn('[SamsungTizen] Timeout after 8s');
        settle(new Error(`TV at ${ip} did not respond — check TV screen for pairing prompt`));
      }, 8000);

      ws.onopen = () => {
        console.log('[SamsungTizen] WS open, waiting for TV handshake...');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            event: string;
            data?: { token?: string };
          };
          console.log('[SamsungTizen] event:', msg.event);

          if (msg.event === 'ms.channel.connect') {
            // Persist token if TV gave us a new one
            const newToken = msg.data?.token;
            if (newToken && newToken !== storedToken) {
              void AsyncStorage.setItem(tokenKey, newToken);
              console.log('[SamsungTizen] Token saved:', newToken);
            }
            // Channel ready — send the key
            ws.send(JSON.stringify({
              method: 'ms.remote.control',
              params: {
                Cmd: 'Click',
                DataOfCmd: keyCode,
                Option: 'false',
                TypeOfRemote: 'SendRemoteKey',
              },
            }));
            keySent = true;
            setTimeout(() => settle(), 400);

          } else if (msg.event === 'ms.channel.unauthorized') {
            // TV closes the socket immediately after this — mark the flag so
            // onclose treats it as an error rather than a normal close.
            console.log('[SamsungTizen] Unauthorized — Access Notification must be enabled on TV');
            isUnauthorized = true;
            settle(new Error(SAMSUNG_UNAUTHORIZED));
          }
        } catch {
          // ignore non-JSON messages
        }
      };

      ws.onerror = () => {
        settle(new Error(`Cannot reach TV at ${ip}:8001`));
      };

      ws.onclose = (e) => {
        console.log('[SamsungTizen] WS closed code:', e.code);
        if (!settled) {
          if (isUnauthorized) {
            settle(new Error(SAMSUNG_UNAUTHORIZED));
          } else if (keySent) {
            // Key was dispatched — any close is a success
            settle();
          } else if (e.code === 1000 || e.code === 1005) {
            // Normal close but key was never sent (e.g. TV closed before connect event)
            settle(new Error(`TV closed connection before key was sent (code ${e.code})`));
          } else {
            settle(new Error(`TV closed connection unexpectedly (code ${e.code})`));
          }
        }
      };
    });
  }

  /**
   * Send a layout action string (e.g. 'HOME', 'VOLUME_UP') to the TV.
   * Automatically maps via SAMSUNG_KEY_MAP; falls back to KEY_<ACTION>.
   */
  static sendAction(ip: string, action: string): Promise<void> {
    const keyCode = SAMSUNG_KEY_MAP[action] ?? `KEY_${action}`;
    return SamsungTizen.sendKey(ip, keyCode);
  }

  /** Clear the stored pairing token for a TV (forces re-pairing). */
  static async clearToken(ip: string): Promise<void> {
    await AsyncStorage.removeItem(SamsungTizen.tokenStorageKey(ip));
  }
}
