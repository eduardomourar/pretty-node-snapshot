import { basename, dirname, join } from 'node:path';
import { snapshot } from 'node:test';
import { inspect } from 'node:util';

/** @typedef {(value: unknown, options?: Record<string, unknown>) => string} Formatter */
/** @typedef {import('pretty-format').Plugin} Plugin */

const DEFAULT_SNAPSHOT_DIR = '__snapshots__';
const DEFAULT_SNAPSHOT_EXTENSION = '.snap';

/**
 * Serializer plugins applied to every value formatted with `pretty-format`.
 *
 * @type {Plugin[]}
 */
const plugins = [];

const FORMAT = {
  escapeRegex: true,
  indent: 2,
  printFunctionName: false,
  escapeString: false,
  printBasicPrototype: false,
  highlight: false,
};

// Tuned to read as close as reasonably possible to the `pretty-format` output above,
// without trying to match it byte-for-byte (e.g. quoted keys, trailing commas, and
// Map/Set size prefixes are left as `util.inspect` renders them).
const INSPECT = {
  depth: null,
  sorted: true,
  compact: false,
  numericSeparator: false,
};

/**
 * Loads the `pretty-format` formatter, which is an optional dependency.
 * Falls back to `null` when it isn't installed, so callers can fall back to `util.inspect`.
 * @param {() => Promise<{ format: Formatter }>} [importPrettyFormat] Import hook, overridable for testing.
 * @returns {Promise<Formatter | null>}
 */
export const loadFormatter = async (importPrettyFormat = () => import('pretty-format')) => {
  try {
    const { format } = await importPrettyFormat();
    return format;
  } catch {
    return null;
  }
};

const format = await loadFormatter();

/**
 * Registers a `pretty-format` plugin for use by every serializer built afterwards.
 *
 * Plugins registered here are merged ahead of any passed through serializer options,
 * matching Jest's `expect.addSnapshotSerializer` precedence.
 * @param {Plugin} plugin A `pretty-format` plugin.
 * @returns {void}
 */
export const addSerializer = (plugin) => {
  plugins.unshift(plugin);
};

/**
 * Returns the currently registered `pretty-format` plugins.
 * @returns {Plugin[]}
 */
export const getSerializers = () => [...plugins];

/**
 * Custom snapshot serializer for node:test
 * @param {Record<string, unknown>} [options] Options forwarded to the formatter. `options.plugins` are merged ahead of globally registered plugins.
 * @param {Formatter | null} [formatter] Formatter to use; defaults to the loaded `pretty-format`, or `null` to force `util.inspect`.
 * @returns {(value: unknown) => string}
 */
export const prepareSerializer = (options = {}, formatter = format) => {
  const { plugins: optionPlugins = [], ...formatOptions } = options;
  return (value) => {
  // Pass strings through raw to avoid extra quote escaping in snapshots
    /** @type {string} */
    let result = typeof value === 'string' ? value : '';
    if (typeof value !== 'string') {
    // Format objects, arrays, DOM nodes, and complex data with pretty-format,
    // or util.inspect when pretty-format is not installed
      if (formatter) {
        const mergedPlugins = [...optionPlugins, ...plugins];
        result = formatter(value, {
          ...FORMAT,
          ...formatOptions,
          ...(mergedPlugins.length ? { plugins: mergedPlugins } : {}),
        });
      } else {
        result = inspect(value, { ...INSPECT, ...formatOptions });
      }
    }

    return result.replace(/\r\n|\r/g, '\n');
  };
};

/**
 * Registers {@link prepareSerializer} as the default snapshot serializer on `node:test`.
 * @param {Record<string, unknown>} [options] Options forwarded to {@link prepareSerializer}.
 * @returns {void}
 */
export const configureSnapshotSerializer = (options = {}) => {
  snapshot.setDefaultSnapshotSerializers([prepareSerializer(options)]);
};

/**
 * @typedef {Object} PathResolverOptions
 * @property {string} [dirSnapshot] Directory name (relative to the test file) where snapshots are stored.
 * @property {string} [extension] Extension appended to the snapshot file. Defaults to `.snap`.
 * @property {boolean} [stripTestExtension] Drop the trailing `.test`/`.spec` segment from the base name (e.g. `index.test.js` becomes `index`). Defaults to `false`.
 */

// Matches a trailing `.test` or `.spec` segment before the file extension,
// e.g. the `.test` in `index.test.js`.
const TEST_EXTENSION = /\.(test|spec)(?=\.[^.]+$)/;

/**
 * Builds a resolver that maps a test file path to its snapshot file path.
 * @param {PathResolverOptions} [options]
 * @returns {(testFilePath: string | undefined) => string}
 */
export const preparePathResolver = (options = {}) => {
  const dirSnapshot = options.dirSnapshot ?? DEFAULT_SNAPSHOT_DIR;
  const extension = options.extension ?? DEFAULT_SNAPSHOT_EXTENSION;
  const stripTestExtension = options.stripTestExtension ?? false;
  return (testFilePath) => {
    // testFilePath is undefined when a test is not associated with a file (e.g. the REPL)
    const filePath = testFilePath ?? 'repl';
    const dir = dirname(filePath);
    const base = stripTestExtension
      ? basename(filePath).replace(TEST_EXTENSION, '')
      : basename(filePath);
    return join(dir, dirSnapshot, `${base}${extension}`);
  };
};

/**
 * Registers {@link preparePathResolver} as the snapshot path resolver on `node:test`.
 * @param {PathResolverOptions} [options] Options forwarded to {@link preparePathResolver}.
 * @returns {void}
 */
export const configureSnapshotPathResolver = (options = {}) => {
  snapshot.setResolveSnapshotPath(preparePathResolver(options));
};
