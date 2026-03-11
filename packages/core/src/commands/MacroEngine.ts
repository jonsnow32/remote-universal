import {
  DeviceCommand,
  MacroStepStatus,
  MacroStepResult,
  MacroRunResult,
  MacroRunOptions,
} from '../types/Command';
import { CommandDispatcher } from './CommandDispatcher';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Macro {
  name: string;
  commands: MacroCommand[];
  /** Default inter-step delay in ms (can be overridden per step) */
  defaultDelayMs: number;
}

/** A command within a macro, with per-step delay and protocol hint */
export interface MacroCommand extends DeviceCommand {
  /** Wait this many ms AFTER sending before proceeding to next step. Default 500. */
  delayAfterMs?: number;
  /** Hint for retry strategy: 'ir' gets more retries (fire-and-forget) */
  protocolHint?: 'ir' | 'wifi' | 'ble';
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export class MacroEngine {
  private readonly macros = new Map<string, Macro>();

  constructor(private readonly dispatcher: CommandDispatcher) {}

  // ── Named macro registry ──────────────────────────────────────────────────

  save(name: string, commands: MacroCommand[], defaultDelayMs = 500): void {
    this.macros.set(name, { name, commands, defaultDelayMs });
  }

  load(name: string): Macro {
    const macro = this.macros.get(name);
    if (!macro) {
      throw new Error(
        `[MacroEngine] Macro "${name}" not found. Available: ${this.list().join(', ') || 'none'}`,
      );
    }
    return macro;
  }

  list(): string[] {
    return Array.from(this.macros.keys());
  }

  delete(name: string): boolean {
    return this.macros.delete(name);
  }

  // ── Execution ─────────────────────────────────────────────────────────────

  /**
   * Run a named macro.
   * Returns a full result object; never throws — all errors are captured per-step.
   */
  async run(name: string, options?: MacroRunOptions): Promise<MacroRunResult> {
    const macro = this.load(name);
    return this.execute(macro.commands, { ...options, defaultDelay: macro.defaultDelayMs });
  }

  /**
   * Execute an ad-hoc list of commands with retry, progress callbacks, and abort support.
   * Never throws — errors are captured in per-step results.
   */
  async execute(
    commands: MacroCommand[],
    options: MacroRunOptions & { defaultDelay?: number } = {},
  ): Promise<MacroRunResult> {
    const {
      onStepUpdate,
      signal,
      retryIR = 2,
      retryNetwork = 1,
      continueOnError = true,
      defaultDelay = 500,
    } = options;

    const stepResults: MacroStepResult[] = commands.map((_, i) => ({
      stepIndex: i,
      status: 'pending' as MacroStepStatus,
      durationMs: 0,
      retries: 0,
    }));

    const wallStart = Date.now();
    let aborted = false;

    for (let i = 0; i < commands.length; i++) {
      // Check for abort before each step
      if (signal?.aborted) {
        aborted = true;
        for (let j = i; j < commands.length; j++) {
          stepResults[j].status = 'skipped';
          onStepUpdate?.(j, 'skipped');
        }
        break;
      }

      const cmd = commands[i];
      const maxRetries = cmd.protocolHint === 'ir' ? retryIR : retryNetwork;

      onStepUpdate?.(i, 'running');
      stepResults[i].status = 'running';

      const stepStart = Date.now();
      let lastError: string | undefined;
      let succeeded = false;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (signal?.aborted) { aborted = true; break; }

        try {
          await this.dispatcher.dispatch(cmd.deviceId, cmd.action, cmd.value);
          succeeded = true;
          stepResults[i].retries = attempt;
          break;
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          if (attempt < maxRetries) {
            // Brief back-off between retries (100 ms × attempt)
            await delay(100 * (attempt + 1));
          }
        }
      }

      const stepDuration = Date.now() - stepStart;
      stepResults[i].durationMs = stepDuration;

      if (aborted) {
        stepResults[i].status = 'skipped';
        onStepUpdate?.(i, 'skipped');
        for (let j = i + 1; j < commands.length; j++) {
          stepResults[j].status = 'skipped';
          onStepUpdate?.(j, 'skipped');
        }
        break;
      }

      if (succeeded) {
        stepResults[i].status = 'success';
        onStepUpdate?.(i, 'success', { durationMs: stepDuration });
      } else {
        stepResults[i].status = 'failed';
        stepResults[i].error = lastError;
        onStepUpdate?.(i, 'failed', { error: lastError, durationMs: stepDuration });

        if (!continueOnError) {
          // Mark remaining as skipped
          for (let j = i + 1; j < commands.length; j++) {
            stepResults[j].status = 'skipped';
            onStepUpdate?.(j, 'skipped');
          }
          break;
        }
      }

      // Inter-step delay (skip after last step or if aborting)
      const waitMs = cmd.delayAfterMs ?? defaultDelay;
      if (i < commands.length - 1 && waitMs > 0 && !signal?.aborted) {
        await delay(waitMs);
      }
    }

    const successCount = stepResults.filter(s => s.status === 'success').length;
    const failCount = stepResults.filter(s => s.status === 'failed').length;

    return {
      steps: stepResults,
      totalDurationMs: Date.now() - wallStart,
      successCount,
      failCount,
      aborted,
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

