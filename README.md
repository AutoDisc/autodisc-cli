# Autodisc CLI

[![npm](https://img.shields.io/npm/v/@autodisc/cli?logo=npm)](https://www.npmjs.com/package/@autodisc/cli)
[![Node.js](https://img.shields.io/node/v/@autodisc/cli)](package.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-2f81f7.svg)](LICENSE)

**Deploy and manage applications on [Autodisc](https://autodisc.xyz) from your terminal.**

Autodisc CLI is the open-source command-line client for authentication, project configuration, deployments, logs, metrics, environment variables, and service operations.

[Documentation](https://docs.autodisc.xyz) · [Report a bug](https://github.com/AutoDisc/autodisc-cli/issues/new) · [Autodisc platform](https://github.com/AutoDisc/Autodisc)

> [!NOTE]
> Autodisc is under active development ahead of 1.0. Commands and configuration may change between minor releases.

## Install

Node.js 18 or newer is required.

```bash
npm install --global @autodisc/cli
```

The package is named `@autodisc/cli`; the executable it installs is `autodisc`:

```bash
autodisc --version
autodisc --help
```

## Quick start

```bash
# Sign in through your browser
autodisc login

# Move into an application and generate its deployment config
cd your-project
autodisc init

# Review autodisc.yml, then deploy
autodisc deploy
```

`autodisc init` analyzes the current directory and creates `autodisc.yml`. `autodisc deploy` uses that file to create or update a service and starts it automatically. Pass `--project <id-or-name>` to deploy into an existing project or `--no-start` to skip the automatic start.

## Commands

### Authentication

| Command | Description |
| --- | --- |
| `autodisc login` | Sign in with the browser flow |
| `autodisc login --device` | Sign in with a device code |
| `autodisc login --token` | Enter an API token using a masked prompt |
| `autodisc whoami` | Show the authenticated user |
| `autodisc logout` | Remove locally saved credentials |

### Deployments and services

| Command | Description |
| --- | --- |
| `autodisc init` | Analyze the current directory and generate `autodisc.yml` |
| `autodisc deploy` | Create or update the service described by `autodisc.yml` |
| `autodisc status [--json]` | Show the selected service and deployment state |
| `autodisc logs [--tail 200] [--follow] [--json]` | Fetch or stream service logs |
| `autodisc metrics [--watch] [--interval 2] [--json]` | Show CPU, memory, and recent deployment status |
| `autodisc start` | Start the selected service |
| `autodisc stop` | Stop the selected service |
| `autodisc restart` | Restart the selected service |
| `autodisc delete` | Permanently delete the selected service after confirmation |

### Projects

Use explicit projects when you do not want service commands to rely on the current selection:

```bash
autodisc project list
autodisc project create my-project
autodisc project use my-project
autodisc project redeploy
```

Run `autodisc project --help` for project and service selection, stop, redeploy, and delete options.

### Environment variables

List keys without revealing values:

```bash
autodisc env
```

Set a secret with a masked prompt so the value does not enter shell history:

```bash
autodisc env set DATABASE_URL
```

Set or remove several values, or synchronize a local environment file:

```bash
autodisc env set NODE_ENV=production PORT=3000
autodisc env unset OLD_TOKEN UNUSED_KEY
autodisc env push .env.production
autodisc env pull --output .env.autodisc
```

Values are redacted by default. Use `--show-values` only when you intentionally want secrets printed in the terminal.

### AI-assisted configuration

```bash
autodisc agent:setup
autodisc agent:chat --message "Use the production start script"
```

`agent:setup` generates or refines `autodisc.yml`; `agent:chat` continues the configuration conversation for the current project.

### Diagnostics

```bash
autodisc doctor
autodisc doctor --offline
autodisc doctor --json
```

The doctor checks Node.js, credentials, project configuration, and API connectivity. `--offline` skips the network check.

## Automation and JSON output

`status`, `logs`, `metrics`, and `env` support machine-readable output:

```bash
autodisc status --json
autodisc logs --tail 100 --json
autodisc metrics --json
autodisc env --json
```

`autodisc metrics --watch --json` and `autodisc logs --follow --json` print newline-delimited JSON snapshots for polling workflows.

For non-interactive authentication, set `AUTODISC_TOKEN` in the process environment. Do not pass secrets directly on a shared command line.

## Global options

| Option | Environment variable | Description |
| --- | --- | --- |
| `--api-url <url>` | `AUTODISC_API_URL` | Target another Autodisc API |
| `--verbose` | `AUTODISC_DEBUG=1` | Include diagnostic details |
| `--no-color` | `AUTODISC_NO_COLOR=1` | Disable ANSI color output |

Set `AUTODISC_CONFIG_PATH` to override the directory used for local CLI configuration.

## Development

```bash
git clone https://github.com/AutoDisc/autodisc-cli.git
cd autodisc-cli
npm install
npm test
npm run build
node dist/index.js --help
```

## Contributing

Issues and focused pull requests are welcome. Please describe the behavior change, add or update tests where practical, and run `npm test` and `npm run build` before submitting a pull request.

For security issues, follow the private reporting process in the [Autodisc security policy](https://github.com/AutoDisc/Autodisc/security/policy) instead of opening a public issue.

## License

Autodisc CLI is available under the [MIT License](LICENSE).
