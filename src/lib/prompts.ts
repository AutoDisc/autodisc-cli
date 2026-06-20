import inquirer from 'inquirer';

export async function confirm(message: string, defaultValue = true) {
  const { value } = await inquirer.prompt<{ value: boolean }>([
    {
      type: 'confirm',
      name: 'value',
      message,
      default: defaultValue,
    },
  ]);
  return value;
}

export async function input(message: string, options?: { default?: string; validate?: (value: string) => true | string }) {
  const { value } = await inquirer.prompt<{ value: string }>([
    {
      type: 'input',
      name: 'value',
      message,
      default: options?.default,
      validate: options?.validate,
    },
  ]);
  return value;
}
