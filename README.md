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

## Quick start

```bash
autodisc login
cd your-project
autodisc init
autodisc deploy
```

`autodisc init` analyzes the current project and creates `autodisc.yml`. Review the generated configuration, then run `autodisc deploy` to create or update the service.

For configuration and usage details, visit the [Autodisc documentation](https://docs.autodisc.xyz).

## License

Autodisc CLI is available under the [MIT License](LICENSE).
