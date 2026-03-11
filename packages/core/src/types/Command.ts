/**
 * A command to be sent to a device.
 */
export interface DeviceCommand {
  /** Target device identifier */
  deviceId: string;
  /** Action name matching a key in CommandMap */
  action: string;
  /** Optional override value / parameter */
  value?: string | number | boolean;
}

/**
 * Result from a dispatched command.
 */
export interface CommandResult {
  success: boolean;
  deviceId: string;
  action: string;
  protocol: string;
  durationMs: number;
  error?: string;
}

// ─── Macro execution types ────────────────────────────────────────────────────

export type MacroStepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface MacroStepResult {
  stepIndex: number;
  status: MacroStepStatus;
  durationMs: number;
  retries: number;
  error?: string;
}

export interface MacroRunResult {
  /** Per-step results in execution order */
  steps: MacroStepResult[];
  totalDurationMs: number;
  successCount: number;
  failCount: number;
  /** True when caller called abort() before all steps completed */
  aborted: boolean;
}

export interface MacroRunOptions {
  /**
   * Called every time a step's status changes.
   * Useful for driving real-time progress UI.
   */
  onStepUpdate?: (index: number, status: MacroStepStatus, partial?: Partial<MacroStepResult>) => void;
  /**
   * AbortSignal — pass an AbortController.signal to stop mid-run.
   */
  signal?: AbortSignal;
  /**
   * How many times to retry a failed IR command (fire-and-forget, cheap). Default 2.
   */
  retryIR?: number;
  /**
   * How many times to retry a failed Wi-Fi/BLE command. Default 1.
   */
  retryNetwork?: number;
  /**
   * When true, continue running remaining steps even if a step fails.
   * When false, abort on first failure. Default: true.
   */
  continueOnError?: boolean;
}
