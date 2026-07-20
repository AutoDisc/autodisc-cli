import { logger } from './logger.js';

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;

  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

export function reportCommandError(error: unknown): void {
  logger.error(getErrorMessage(error));

  if (process.env.AUTODISC_DEBUG && error instanceof Error && error.stack) {
    logger.debug(error.stack);
  }

  process.exitCode = 1;
}

export async function runCommand(action: () => void | Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    reportCommandError(error);
  }
}
