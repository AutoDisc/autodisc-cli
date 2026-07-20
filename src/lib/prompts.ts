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

export async function password(message: string) {
  const { value } = await inquirer.prompt<{ value: string }>([
    {
      type: 'password',
      name: 'value',
      message,
      mask: '*',
      validate: (input: string) => (input.length > 0 ? true : 'Value is required'),
    },
  ]);
  return value;
}
