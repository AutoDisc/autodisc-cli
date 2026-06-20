# Autodisc CLI

Command-line tooling for authenticating with Autodisc, deploying projects, and managing hosted apps.

## Install

When the package is published:

```bash
npm install -g @autodisc/cli
```

From this repo today:

```bash
npm install
npm run cli:build
node packages/cli/dist/index.js --help
```

## Quickstart

Authenticate:

```bash
autodisc login
```

Generate config for the current project:

```bash
autodisc init
```

Deploy the current project:

```bash
autodisc deploy
```

View logs:

```bash
autodisc logs --follow
```

Check resource usage and the latest deploy:

```bash
autodisc metrics
autodisc metrics --watch
```

## Core Commands

- `autodisc login`: authenticate with device flow, browser flow, or token.
- `autodisc init`: analyze the current project and write `autodisc.yml`.
- `autodisc deploy`: deploy the current project using `autodisc.yml`.
- `autodisc status [--json]`: show the current hosting server state.
- `autodisc logs [--tail 200] [--follow] [--json]`: fetch or stream recent logs.
- `autodisc metrics [--watch] [--interval 2] [--json]`: show CPU, memory, and latest deploy status.
- `autodisc env`: list, set, unset, pull, or push environment variables.
- `autodisc start|stop|restart|delete`: operate on the current hosting server.

## Scriptable Output

Use `--json` on `status`, `logs`, and `metrics` when another tool or agent is reading CLI output:

```bash
autodisc status --json
autodisc logs --tail 100 --json
autodisc metrics --json
```

For polling workflows, `autodisc metrics --watch --json` prints one compact JSON snapshot per line. `autodisc logs --follow --json` does the same for log snapshots.

## Development

```bash
npm run cli:build
npm run test --workspace @autodisc/cli
```

Set `AUTODISC_API_URL` if you want the CLI to target a non-default backend.
