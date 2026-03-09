import { DeviceCommand } from '../types/Command';
import { CommandDispatcher } from './CommandDispatcher';

/**
 * Macro: a named sequence of commands with inter-command delays.
 */
export interface Macro {
  name: string;
  commands: DeviceCommand[];
  delayMs: number;
}

/**
 * Manages named macros and executes sequences of device commands.
 */
export class MacroEngine {
  private readonly macros = new Map<string, Macro>();

  constructor(private readonly dispatcher: CommandDispatcher) {}

  /**
   * Executes a sequence of commands with a delay between each.
   * @param commands - Array of commands to run in order
   * @param delayMs - Milliseconds to wait between commands (default: 300)
   */
  async enqueueMacro(commands: DeviceCommand[], delayMs = 300): Promise<void> {
    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      await this.dispatcher.dispatch(cmd.deviceId, cmd.action, cmd.value);

      if (i < commands.length - 1) {
        await delay(delayMs);
      }
    }
  }

  /**
   * Saves a named macro for later execution.
   * @param name - Unique macro name
   * @param commands - Command sequence
   * @param delayMs - Inter-command delay in ms (default: 300)
   */
  save(name: string, commands: DeviceCommand[], delayMs = 300): void {
    this.macros.set(name, { name, commands, delayMs });
  }

  /**
   * Loads a saved macro by name.
   * @param name - Macro name
   * @returns The macro definition
   * @throws Error if macro not found
   */
  load(name: string): Macro {
    const macro = this.macros.get(name);
    if (!macro) {
      throw new Error(
        `[MacroEngine] Macro "${name}" not found. Available macros: ${this.list().join(', ') || 'none'}`
      );
    }
    return macro;
  }

  /**
   * Returns a list of all saved macro names.
   */
  list(): string[] {
    return Array.from(this.macros.keys());
  }

  /**
   * Deletes a named macro.
   * @param name - Macro name to delete
   * @returns true if deleted, false if not found
   */
  delete(name: string): boolean {
    return this.macros.delete(name);
  }

  /**
   * Executes a previously saved macro by name.
   * @param name - Macro name
   */
  async run(name: string): Promise<void> {
    const macro = this.load(name);
    await this.enqueueMacro(macro.commands, macro.delayMs);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
