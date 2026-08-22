# Autodisc CLI

[![npm](https://img.shields.io/npm/v/@autodisc/cli?logo=npm)](https://www.npmjs.com/package/@autodisc/cli)
[![Node.js](https://img.shields.io/node/v/@autodisc/cli)](package.json)
[![License: MIT](https://img.shields.io/badge/license-MIT-2f81f7.svg)](LICENSE)

The official command-line interface for deploying and managing applications on [Autodisc](https://autodisc.xyz).

## Install

Node.js 18 or newer is required.

```bash
npm install --global @autodisc/cli
```

The package installs the `autodisc` command.

If you are using the CLI rather than contributing to it, install the npm package;
you do not need to clone or build this repository.

## Quick start

```bash
autodisc login
cd your-project
autodisc init
autodisc deploy
```

`autodisc init` analyzes the current project and creates `autodisc.yml`. Review the generated configuration, then run `autodisc deploy` to create or update the service.

`autodisc login` uses browser authentication. For automation, use
`autodisc login --api-key <key>` or set `AUTODISC_API_KEY`. Create API keys
under **Account → Tokens** and keep them out of shell history.

Deployments start asynchronously. Follow progress with:

```bash
autodisc status
autodisc logs --follow
```

## Deploy without an account

Create a 24-hour anonymous deployment and receive a private claim link without
running `autodisc login`:

```bash
autodisc deploy --anonymous
```

Agents can request a machine-readable response containing the deployment URL,
expiration, status endpoint, control token, and claim URL:

```bash
autodisc deploy --anonymous --json
```

The CLI is optional. Any agent or HTTP client can deploy a public GitHub
repository directly:

```bash
curl https://api.autodisc.xyz/api/v1/drops \
  --request POST \
  --header 'Content-Type: application/json' \
  --data '{
    "name": "my-project",
    "source": {
      "kind": "github",
      "url": "https://github.com/example/my-project",
      "ref": "main"
    },
    "lifetime_hours": 24,
    "requested_mode": "auto"
  }'
```

ZIP uploads use `POST /api/v1/drops/upload` with the archive in the `source`
multipart field and deployment options as JSON in the `request` field. Creation
requires no Autodisc credential. Treat the returned control token and claim URL
as secrets.

If a start or deploy command reports a gateway, origin, or timeout error, the
backend may still have accepted the request. Check `autodisc status` and
`autodisc logs` before retrying.

## Project servers

Inspect the live VPS catalog and provision a server within a project:

```bash
autodisc servers regions
autodisc servers shapes
autodisc servers create preview-api \
  --project PROJECT_UUID \
  --region us-west \
  --shape micro-1 \
  --storage 20 \
  --ipv4
```

Provisioning is quote-first: the CLI displays the exact hourly rate and
730-hour estimate before submitting the request. Use `--yes --json` for trusted
automation and provide `--idempotency-key` when a workflow may retry a mutation.

Use `autodisc servers list|get|quote|create` to inspect and provision servers,
and `autodisc servers start|stop|restart|delete` for lifecycle operations.
Server commands require a canonical project UUID.

## Updates

The CLI checks npm at most once every 24 hours and prints a notice when a newer
release is available. It never replaces itself while another command is
running. Install the latest release explicitly with:

```bash
autodisc update
```

Use `autodisc update --check` to check without installing, or set
`AUTODISC_DISABLE_UPDATE_CHECK=1` to disable periodic update notices.

For configuration and usage details, visit the [Autodisc documentation](https://docs.autodisc.xyz).

## License

Autodisc CLI is available under the [MIT License](LICENSE).
