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
  androidTvSendKey,
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
  PLAY_PAUSE:    85,  // KEYCODE_MEDIA_PLAY_PAUSE
  PLAY:         126,  // KEYCODE_MEDIA_PLAY
  PAUSE:        127,  // KEYCODE_MEDIA_PAUSE
  STOP:          86,  // KEYCODE_MEDIA_STOP
  FAST_FORWARD:  90,  // KEYCODE_MEDIA_FAST_FORWARD
  REWIND:        89,  // KEYCODE_MEDIA_REWIND
  NEXT:          87,  // KEYCODE_MEDIA_NEXT
  PREVIOUS:      88,  // KEYCODE_MEDIA_PREVIOUS
  INPUT_SELECT: 178,  // KEYCODE_TV_INPUT
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
   */
  static confirmPairing(ip: string, pin: string): Promise<void> {
    return androidTvConfirmPairing(ip, pin);
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

  /** Remove the local pairing record for this TV. */
  static unpair(ip: string): Promise<void> {
    return androidTvUnpair(ip);
  }
}

/** Error code returned by {@link AndroidTV.sendAction} when the TV is not paired. */
export const ANDROID_TV_NOT_PAIRED = 'NOT_PAIRED';
