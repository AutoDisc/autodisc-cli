declare module './setup.js' {
  export interface SetupCommandOptions {
    path?: string;
    message?: string;
  }

  export function runAgentSetup(options: SetupCommandOptions): Promise<void>;
}
