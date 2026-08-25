import assert from 'node:assert/strict';
import { snapshot, describe, it, mock } from 'node:test';
import { registerSnapshot } from '../src/register.js';

describe('registerSnapshot', () => {
  it('configures the serializer and path resolver when the snapshot API is available', () => {
    const setDefaultSnapshotSerializers = mock.method(snapshot, 'setDefaultSnapshotSerializers', () => {});
    const setResolveSnapshotPath = mock.method(snapshot, 'setResolveSnapshotPath', () => {});
    try {
      registerSnapshot(snapshot);
      assert.equal(setDefaultSnapshotSerializers.mock.calls.length, 1);
      assert.equal(setResolveSnapshotPath.mock.calls.length, 1);
    } finally {
      setDefaultSnapshotSerializers.mock.restore();
      setResolveSnapshotPath.mock.restore();
    }
  });

  it('warns when the snapshot API is not available', () => {
    const warn = mock.method(console, 'warn', () => {});
    try {
      registerSnapshot(undefined);
      assert.equal(warn.mock.calls.length, 1);
      assert.match(warn.mock.calls[0].arguments[0], /Native test runner snapshot API not available/);
    } finally {
      warn.mock.restore();
    }
  });

  it('warns when the snapshot API is missing one of the expected methods', () => {
    const warn = mock.method(console, 'warn', () => {});
    try {
      registerSnapshot({ setDefaultSnapshotSerializers: () => {} });
      assert.equal(warn.mock.calls.length, 1);
    } finally {
      warn.mock.restore();
    }
  });
});
