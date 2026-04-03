/**
 * Android TV Remote — local-network control via Android TV Remote Service (ATVRS).
 *
 * Protocol:
 *   - Port 6467: pairing service (TLS + PIN shown on TV)
 *   - Port 6466: remote-control service (TLS, after pairing)
 *
 * No developer mode or ADB required. The ATVRS protocol is implemented directly
 * on-device in the AndroidTV native module — no backend server needed.
 *
 * Pairing flow:
 *   1. AndroidTV.startPairing(ip)   → native module connects, PIN appears on TV
 *   2. User enters the 6-digit hex PIN
 *   3. AndroidTV.confirmPairing(ip, pin) → pairing complete, cert saved on-device
 *   4. AndroidTV.sendAction(ip, action)  → works for all future sessions
 */

import {
  androidTvIsPaired,
  androidTvStartPairing,
  androidTvConfirmPairing,
  androidTvConnectRemote,
  androidTvDisconnectRemote,
  androidTvSendKey,
  androidTvSendText,
  androidTvSubmitText,
  androidTvUnpair,
} from '@remote/native-modules';

/** Android KeyEvent constants used for TV remotes. */
export const ANDROID_TV_KEY_MAP: Record<string, number> = {
  POWER_TOGGLE:  26,  // KEYCODE_POWER
  VOLUME_UP:     24,  // KEYCODE_VOLUME_UP
  VOLUME_DOWN:   25,  // KEYCODE_VOLUME_DOWN
  MUTE:         164,  // KEYCODE_VOLUME_MUTE
  DPAD_UP:       19,  // KEYCODE_DPAD_UP
  DPAD_DOWN:     20,  // KEYCODE_DPAD_DOWN
  DPAD_LEFT:     21,  // KEYCODE_DPAD_LEFT
  DPAD_RIGHT:    22,  // KEYCODE_DPAD_RIGHT
  DPAD_OK:       23,  // KEYCODE_DPAD_CENTER
  HOME:           3,  // KEYCODE_HOME
  BACK:           4,  // KEYCODE_BACK
  MENU:          82,  // KEYCODE_MENU
  SEARCH:        84,  // KEYCODE_SEARCH
  VOICE_COMMAND: 219, // KEYCODE_ASSIST — opens Google Assistant on Android TV
  PLAY_PAUSE:    85,  // KEYCODE_MEDIA_PLAY_PAUSE
  PLAY:         126,  // KEYCODE_MEDIA_PLAY
  PAUSE:        127,  // KEYCODE_MEDIA_PAUSE
  STOP:          86,  // KEYCODE_MEDIA_STOP
  FAST_FORWARD:  90,  // KEYCODE_MEDIA_FAST_FORWARD
  REWIND:        89,  // KEYCODE_MEDIA_REWIND
  NEXT:          87,  // KEYCODE_MEDIA_NEXT
  PREVIOUS:      88,  // KEYCODE_MEDIA_PREVIOUS
  INPUT_SELECT: 178,  // KEYCODE_TV_INPUT
  // Digits
  DIGIT_0:   7,   // KEYCODE_0
  DIGIT_1:   8,   // KEYCODE_1
  DIGIT_2:   9,   // KEYCODE_2
  DIGIT_3:  10,   // KEYCODE_3
  DIGIT_4:  11,   // KEYCODE_4
  DIGIT_5:  12,   // KEYCODE_5
  DIGIT_6:  13,   // KEYCODE_6
  DIGIT_7:  14,   // KEYCODE_7
  DIGIT_8:  15,   // KEYCODE_8
  DIGIT_9:  16,   // KEYCODE_9
  // Letters (A–Z, case-insensitive on Android TV)
  CHAR_A:   29,   // KEYCODE_A
  CHAR_B:   30,
  CHAR_C:   31,
  CHAR_D:   32,
  CHAR_E:   33,
  CHAR_F:   34,
  CHAR_G:   35,
  CHAR_H:   36,
  CHAR_I:   37,
  CHAR_J:   38,
  CHAR_K:   39,
  CHAR_L:   40,
  CHAR_M:   41,
  CHAR_N:   42,
  CHAR_O:   43,
  CHAR_P:   44,
  CHAR_Q:   45,
  CHAR_R:   46,
  CHAR_S:   47,
  CHAR_T:   48,
  CHAR_U:   49,
  CHAR_V:   50,
  CHAR_W:   51,
  CHAR_X:   52,
  CHAR_Y:   53,
  CHAR_Z:   54,   // KEYCODE_Z
  // Editing
  DEL:      67,   // KEYCODE_DEL (backspace)
  ENTER:    66,   // KEYCODE_ENTER
  SPACE:    62,   // KEYCODE_SPACE
};

export class AndroidTV {
  /** Check whether this TV is already paired (no PIN needed). */
  static isPaired(ip: string): Promise<boolean> {
    return androidTvIsPaired(ip);
  }

  /**
   * Step 1 — Ask the TV to display its PIN.
   * Resolves once the TV is showing the 6-digit hex PIN on screen.
   */
  static startPairing(ip: string): Promise<void> {
    return androidTvStartPairing(ip);
  }

  /**
   * Step 2 — Submit the PIN shown on the TV.
   * Rejects with code "BAD_PIN" if the PIN is wrong.
   * Automatically opens a persistent remote session on success.
   */
  static async confirmPairing(ip: string, pin: string): Promise<void> {
    await androidTvConfirmPairing(ip, pin);
    // Pre-establish persistent connection so first sendAction is instant.
    try { await androidTvConnectRemote(ip); } catch (_) { /* best-effort */ }
  }

  /**
   * Open a persistent remote-control session (port 6466).
   * Called automatically after pairing; can also be called manually.
   */
  static connectRemote(ip: string): Promise<void> {
    return androidTvConnectRemote(ip);
  }

  /**
   * Close the persistent remote-control session.
   */
  static disconnectRemote(ip: string): Promise<void> {
    return androidTvDisconnectRemote(ip);
  }

  /**
   * Send a layout action to a paired Android TV device.
   * Rejects with code "NOT_PAIRED" when the TV no longer recognises our cert.
   */
  static async sendAction(ip: string, action: string): Promise<void> {
    const keyCode = ANDROID_TV_KEY_MAP[action];
    if (keyCode === undefined) {
      console.warn(`[AndroidTV] Unknown action: ${action}`);
      return;
    }
    return androidTvSendKey(ip, keyCode);
  }

  /**
   * Stream the current text to the focused IME field on the TV.
   *
   * Uses ATVRS RemoteImeKeyInject which replaces the entire field value in one
   * round-trip.  The native layer debounces calls by 300 ms so rapid keystrokes
   * collapse into a single message — call this on every keystroke without worry.
   * Resolves immediately (debounce fires in the background).
   */
  static sendText(ip: string, text: string): Promise<void> {
    return androidTvSendText(ip, text);
  }

  /**
   * Immediately inject text into the focused IME field and press ENTER.
   * Cancels any pending debounced sendText.  Use for the final submit action.
   */
  static submitText(ip: string, text: string): Promise<void> {
    return androidTvSubmitText(ip, text);
  }

  /** Remove the local pairing record for this TV. */
  static unpair(ip: string): Promise<void> {
    return androidTvUnpair(ip);
  }
}

/** Error code returned by {@link AndroidTV.sendAction} when the TV is not paired. */
export const ANDROID_TV_NOT_PAIRED = 'NOT_PAIRED';
