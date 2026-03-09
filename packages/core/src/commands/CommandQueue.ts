import { DeviceCommand, CommandResult } from '../types/Command';

type CommandHandler = (command: DeviceCommand) => Promise<CommandResult>;

interface QueueEntry {
  command: DeviceCommand;
  resolve: (result: CommandResult) => void;
  reject: (error: Error) => void;
}

/**
 * Thread-safe FIFO queue for device commands.
 * Ensures commands are processed one at a time to avoid race conditions.
 */
export class CommandQueue {
  private readonly queue: QueueEntry[] = [];
  private processing = false;

  constructor(private readonly handler: CommandHandler) {}

  /**
   * Adds a command to the queue.
   * @param command - The command to enqueue
   * @returns A promise that resolves with the command result
   */
  enqueue(command: DeviceCommand): Promise<CommandResult> {
    return new Promise<CommandResult>((resolve, reject) => {
      this.queue.push({ command, resolve, reject });
      void this.process();
    });
  }

  /** Returns the number of commands waiting in the queue */
  get size(): number {
    return this.queue.length;
  }

  private async process(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const entry = this.queue.shift();
      if (!entry) break;

      try {
        const result = await this.handler(entry.command);
        entry.resolve(result);
      } catch (err) {
        entry.reject(err instanceof Error ? err : new Error(String(err)));
      }
    }

    this.processing = false;
  }
}
