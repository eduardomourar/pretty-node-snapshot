# pretty-node-snapshot

[![build status](https://github.com/eduardomourar/pretty-node-snapshot/actions/workflows/build.yml/badge.svg)](https://github.com/eduardomourar/pretty-node-snapshot/actions/workflows/build.yml) 
[![code coverage](https://img.shields.io/codecov/c/github/eduardomourar/pretty-node-snapshot/main.svg?style=flat-square)](https://codecov.io/gh/eduardomourar/pretty-node-snapshot) 
[![npm package](https://img.shields.io/npm/v/pretty-node-snapshot.svg?style=flat-square)](https://www.npmjs.com/package/pretty-node-snapshot) 
[![license](https://img.shields.io/github/license/eduardomourar/pretty-node-snapshot.svg?style=flat-square)](https://github.com/eduardomourar/pretty-node-snapshot/blob/main/LICENSE)

Readable, [Jest](https://jestjs.io)-style snapshot formatting and path resolution for Node.js' built-in test runner (`node:test`).

`node:test` ships with basic snapshot testing (`t.assert.snapshot()` / `--test-update-snapshots`), but by default it serializes values with `JSON.stringify` and stores snapshots next to the test file with a `.snapshot` extension. This package gives it a more familiar, Jest-like setup:

- **Readable serialization** via [`pretty-format`](https://www.npmjs.com/package/pretty-format) — the same formatter Jest uses — with a fallback to `util.inspect`, tuned to read similarly, when `pretty-format` isn't installed.
- **Familiar snapshot layout**: files are resolved into a `__snapshots__/` directory alongside each test file (e.g. `test/__snapshots__/index.test.js.snap`), instead of a sibling `.snapshot` file.

## Requirements

- Node.js >= 24

## Install

```sh
npm install --save-dev pretty-node-snapshot
```

`pretty-format` is an **optional dependency**. Install it for nicely formatted, colorized-when-supported snapshots:

```sh
npm install --save-dev pretty-format
```

If it isn't installed, serialization falls back to `util.inspect` automatically — no configuration needed.

## Usage

### Automatic setup (recommended)

Import `pretty-node-snapshot/register` before your tests run to automatically configure both the serializer and the snapshot path resolver. The easiest way is via Node's `--import` flag:

```sh
node --test --import pretty-node-snapshot/register
```

Or through a [config file](https://nodejs.org/api/cli.html#--experimental-config-fileconfig) (`node --experimental-config-file=./node.config.json`):

```json
{
  "nodeOptions": {
    "import": ["pretty-node-snapshot/register"]
  },
  "test": {
    "test": true
  }
}
```

If the `node:test` snapshot API isn't available (e.g. older Node.js versions), a warning is logged and nothing else is registered.

### Manual setup

Use the individual exports from `pretty-node-snapshot` for more control:

```js
import { configureSnapshotSerializer, configureSnapshotPathResolver } from 'pretty-node-snapshot';

configureSnapshotSerializer();
configureSnapshotPathResolver();
```

Or build a serializer/resolver without registering it globally:

```js
import { prepareSerializer, preparePathResolver } from 'pretty-node-snapshot';

const serialize = prepareSerializer();
const resolvePath = preparePathResolver({ dirSnapshot: '__custom__' });
```

## API

- `prepareSerializer(options?, formatter?)` — returns a `(value) => string` serializer. Strings are passed through unchanged; other values are formatted with `pretty-format` (or `util.inspect` as a fallback). `options` are forwarded to the formatter.
- `configureSnapshotSerializer(options?)` — registers `prepareSerializer(options)` as the default snapshot serializer via `node:test`'s `snapshot.setDefaultSnapshotSerializers`.
- `preparePathResolver(options?)` — returns a `(testFilePath) => string` resolver that maps a test file to `<dir>/<dirSnapshot>/<basename>.snap`. `options.dirSnapshot` defaults to `__snapshots__`.
- `configureSnapshotPathResolver(options?)` — registers `preparePathResolver(options)` via `node:test`'s `snapshot.setResolveSnapshotPath`.
- `loadFormatter(importPrettyFormat?)` — attempts to dynamically import `pretty-format`, resolving to `null` if it isn't installed.
- `registerSnapshot(snapshotApi)` (from `pretty-node-snapshot/register`) — wires up the serializer and path resolver on the given `node:test` `snapshot` namespace, or warns if it's unavailable/incomplete.

## Development

This project is managed with [projen](https://projen.io/) — configuration lives in `.projenrc.ts`, and most files are generated. Run `npx projen` after editing `.projenrc.ts` to regenerate them.

```sh
npm run test        # run tests with coverage and lint
npm run test:watch  # run tests in watch mode
npm run eslint       # lint only
```

Tests run against Node's native test runner using the config in `node.config.json`. Source files under `src/` are typed via JSDoc and checked against `tsconfig.projen.json` (no build step or TypeScript runtime dependency required).
