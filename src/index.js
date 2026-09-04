import { basename, dirname, join } from 'node:path';
import { snapshot } from 'node:test';
import { inspect } from 'node:util';

/** @typedef {(value: unknown, options?: Record<string, unknown>) => string} Formatter */

const DEFAULT_SNAPSHOT_DIR = '__snapshots__';

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
 * Custom snapshot serializer for node:test
 * @param {Record<string, unknown>} [options] Options forwarded to the formatter.
 * @param {Formatter | null} [formatter] Formatter to use; defaults to the loaded `pretty-format`, or `null` to force `util.inspect`.
 * @returns {(value: unknown) => string}
 */
export const prepareSerializer = (options = {}, formatter = format) => {
  return (value) => {
  // Pass strings through raw to avoid extra quote escaping in snapshots
    /** @type {string} */
    let result = typeof value === 'string' ? value : '';
    if (typeof value !== 'string') {
    // Format objects, arrays, DOM nodes, and complex data with pretty-format,
    // or util.inspect when pretty-format is not installed
      result = formatter
        ? formatter(value, { ...FORMAT, ...options })
        : inspect(value, { ...INSPECT, ...options });
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
 */

/**
 * Builds a resolver that maps a test file path to its snapshot file path.
 * @param {PathResolverOptions} [options]
 * @returns {(testFilePath: string | undefined) => string}
 */
export const preparePathResolver = (options = {}) => {
  const dirSnapshot = options.dirSnapshot ?? DEFAULT_SNAPSHOT_DIR;
  return (testFilePath) => {
    // testFilePath is undefined when a test is not associated with a file (e.g. the REPL)
    const filePath = testFilePath ?? 'repl';
    const dir = dirname(filePath);
    const base = basename(filePath);
    return join(dir, dirSnapshot, `${base}.snap`);
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
