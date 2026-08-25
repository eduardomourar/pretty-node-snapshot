import assert from 'node:assert/strict';
import { snapshot, describe, it, mock } from 'node:test';
import {
  configureSnapshotPathResolver,
  configureSnapshotSerializer,
  loadFormatter,
  preparePathResolver,
  prepareSerializer,
} from '../src/index.js';

describe('prepareSerializer', () => {
  it('passes strings through unchanged', () => {
    const serialize = prepareSerializer();
    assert.equal(serialize('hello world'), 'hello world');
  });

  it('normalizes CRLF and CR line endings to LF', () => {
    const serialize = prepareSerializer();
    assert.equal(serialize('line1\r\nline2\rline3'), 'line1\nline2\nline3');
  });

  // Adapted from jest-snapshot-utils/src/__tests__/utils.test.ts ("serialize handles \r\n")
  it('normalizes CRLF line endings within an HTML-like string', () => {
    const serialize = prepareSerializer();
    assert.equal(serialize('<div>\r\n</div>'), '<div>\n</div>');
  });

  it('formats non-string values with pretty-format when it is installed', () => {
    const serialize = prepareSerializer();
    assert.equal(serialize({ b: 2, a: 1 }), '{\n  "a": 1,\n  "b": 2,\n}');
  });

  it('formats non-string values with util.inspect when pretty-format is not installed', () => {
    const serialize = prepareSerializer({}, null);
    assert.equal(serialize({ b: 2, a: 1 }), '{\n  a: 1,\n  b: 2\n}');
  });

  it('forwards custom options to util.inspect when pretty-format is not installed', () => {
    const serialize = prepareSerializer({ compact: true }, null);
    assert.equal(serialize({ a: 1 }), '{ a: 1 }');
  });

  it('forwards custom options to the injected formatter', () => {
    const formatter = mock.fn((value, options) => JSON.stringify({ value, options }));
    const serialize = prepareSerializer({ min: true }, formatter);
    serialize({ a: 1 });
    assert.equal(formatter.mock.calls.length, 1);
    const [, options] = formatter.mock.calls[0].arguments;
    assert.equal(options.min, true);
  });

  it('formats nested arrays and objects', () => {
    const serialize = prepareSerializer({}, null);
    assert.equal(
      serialize({ list: [1, 2, { nested: true }] }),
      '{\n  list: [\n    1,\n    2,\n    {\n      nested: true\n    }\n  ]\n}',
    );
  });

  it('formats null and undefined', () => {
    const serialize = prepareSerializer({}, null);
    assert.equal(serialize(null), 'null');
    assert.equal(serialize(undefined), 'undefined');
  });
});

describe('loadFormatter', () => {
  it('returns the pretty-format formatter when the module is available', async () => {
    const formatter = await loadFormatter();
    assert.equal(typeof formatter, 'function');
  });

  it('returns null when pretty-format is not installed', async () => {
    const formatter = await loadFormatter(() => Promise.reject(new Error('Cannot find package')));
    assert.equal(formatter, null);
  });
});

describe('preparePathResolver', () => {
  it('resolves the snapshot path under __snapshots__ by default', () => {
    const resolve = preparePathResolver();
    assert.equal(resolve('/project/test/index.test.js'), '/project/test/__snapshots__/index.test.js.snap');
  });

  it('resolves the snapshot path under a custom directory', () => {
    const resolve = preparePathResolver({ dirSnapshot: '__custom__' });
    assert.equal(resolve('/project/test/index.test.js'), '/project/test/__custom__/index.test.js.snap');
  });

  // Adapted from jest-snapshot/src/__tests__/SnapshotResolver.test.ts ("resolveSnapshotPath()")
  it('resolves the snapshot path for files nested under __tests__', () => {
    const resolve = preparePathResolver();
    assert.equal(resolve('/abc/cde/__tests__/a.test.js'), '/abc/cde/__tests__/__snapshots__/a.test.js.snap');
  });

  it('resolves the snapshot path for a file with a non-standard test extension', () => {
    const resolve = preparePathResolver();
    assert.equal(resolve('/abc/cde/a.spec.js'), '/abc/cde/__snapshots__/a.spec.js.snap');
  });

  it('resolves a fallback snapshot path when the test is not associated with a file', () => {
    const resolve = preparePathResolver();
    assert.equal(resolve(undefined), '__snapshots__/repl.snap');
  });
});

describe('configureSnapshotSerializer', () => {
  it('registers the serializer with node:test', () => {
    const setDefaultSnapshotSerializers = mock.method(snapshot, 'setDefaultSnapshotSerializers', () => {});
    try {
      configureSnapshotSerializer();
      assert.equal(setDefaultSnapshotSerializers.mock.calls.length, 1);
      const [serializers] = setDefaultSnapshotSerializers.mock.calls[0].arguments;
      assert.equal(serializers.length, 1);
      assert.equal(typeof serializers[0], 'function');
    } finally {
      setDefaultSnapshotSerializers.mock.restore();
    }
  });
});

describe('configureSnapshotPathResolver', () => {
  it('registers the path resolver with node:test', () => {
    const setResolveSnapshotPath = mock.method(snapshot, 'setResolveSnapshotPath', () => {});
    try {
      configureSnapshotPathResolver();
      assert.equal(setResolveSnapshotPath.mock.calls.length, 1);
      const [resolver] = setResolveSnapshotPath.mock.calls[0].arguments;
      assert.equal(typeof resolver, 'function');
    } finally {
      setResolveSnapshotPath.mock.restore();
    }
  });
});
