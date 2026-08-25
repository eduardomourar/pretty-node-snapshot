import { snapshot } from 'node:test';
import { configureSnapshotPathResolver, configureSnapshotSerializer } from './index.js';

/**
 * Registers the snapshot serializer and path resolver on the given `node:test` snapshot API,
 * or warns when the API is unavailable or incomplete (e.g. on older Node.js versions).
 * @param {Partial<typeof snapshot> | undefined} snapshotApi The `node:test` `snapshot` namespace.
 * @returns {void}
 */
export const registerSnapshot = (snapshotApi) => {
  if (snapshotApi && typeof snapshotApi.setDefaultSnapshotSerializers === 'function' && typeof snapshotApi.setResolveSnapshotPath === 'function') {
    configureSnapshotSerializer();
    configureSnapshotPathResolver();
  } else {
    console.warn(
      '[pretty-node-snapshot] Native test runner snapshot API not available in this Node version.',
    );
  }
};

// Automatically register serializer globally in node:test
registerSnapshot(snapshot);
