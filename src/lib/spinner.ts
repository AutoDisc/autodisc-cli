import ora, { Ora } from 'ora';
import { getConfigManager } from './config.js';

export function createSpinner(text?: string): Ora {
  const { colors } = getConfigManager().getEffectiveConfig().ui;
  const spinner = ora({
    text,
    isSilent: process.env.CI === 'true' || !process.stdout.isTTY,
  });
  if (!colors) {
    spinner.color = 'gray';
  }
  return spinner;
}

export async function withSpinner<T>(text: string, task: (spinner: Ora) => Promise<T>): Promise<T> {
  const spinner = createSpinner(text);
  spinner.start();
  try {
    const result = await task(spinner);
    spinner.succeed();
    return result;
  } catch (error) {
    spinner.fail();
    throw error;
  }
}
