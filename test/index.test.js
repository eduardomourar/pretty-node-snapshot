import assert from 'node:assert/strict';
import { snapshot, describe, it, mock } from 'node:test';
import {
  addSerializer,
  configureSnapshotPathResolver,
  configureSnapshotSerializer,
  getSerializers,
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

  it('does not add numeric separators when pretty-format is not installed', () => {
    const serialize = prepareSerializer({}, null);
    assert.equal(serialize(123456789), '123456789');
  });

  it('applies plugins passed through options', () => {
    const plugin = {
      test: (value) => typeof value === 'object' && value !== null && 'brand' in value,
      serialize: (value) => `BRAND<${value.brand}>`,
    };
    const serialize = prepareSerializer({ plugins: [plugin] });
    assert.equal(serialize({ brand: 'acme' }), 'BRAND<acme>');
  });

  it('does not pass a plugins option to util.inspect fallback', () => {
    const formatter = null;
    const serialize = prepareSerializer({ plugins: [{ test: () => true, serialize: () => 'x' }] }, formatter);
    assert.equal(serialize({ a: 1 }), '{\n  a: 1\n}');
  });
});

describe('addSerializer', () => {
  it('registers a plugin used by serializers built afterwards', () => {
    const before = getSerializers();
    const plugin = {
      test: (value) => typeof value === 'object' && value !== null && 'secret' in value,
      serialize: () => 'REDACTED',
    };
    try {
      addSerializer(plugin);
      const serialize = prepareSerializer();
      assert.equal(serialize({ secret: 'password' }), 'REDACTED');
      assert.equal(getSerializers().length, before.length + 1);
    } finally {
      // Restore the registry so this test does not leak into others.
      const current = getSerializers();
      current.splice(0, current.length - before.length);
    }
  });

  it('gives option plugins precedence over registered plugins', () => {
    const before = getSerializers();
    const registered = {
      test: (value) => typeof value === 'object' && value !== null && 'kind' in value,
      serialize: () => 'REGISTERED',
    };
    const optionPlugin = {
      test: (value) => typeof value === 'object' && value !== null && 'kind' in value,
      serialize: () => 'OPTION',
    };
    try {
      addSerializer(registered);
      const serialize = prepareSerializer({ plugins: [optionPlugin] });
      assert.equal(serialize({ kind: 'a' }), 'OPTION');
    } finally {
      const current = getSerializers();
      current.splice(0, current.length - before.length);
    }
  });

  it('returns a copy of the registry that cannot mutate internal state', () => {
    const snapshotList = getSerializers();
    snapshotList.push({ test: () => true, serialize: () => 'x' });
    assert.equal(getSerializers().length, snapshotList.length - 1);
  });
});

describe('pretty-format similarity', () => {
  const withPrettyFormat = prepareSerializer();
  const withInspectFallback = prepareSerializer({}, null);

  // Strips the cosmetic differences between pretty-format and util.inspect that this
  // package doesn't try to reconcile (quoted keys, trailing commas, string quote style,
  // Map/Set size prefixes), so the two outputs can be compared on shape and content.
  const normalize = (text) => text
    .replace(/^(\s*)"([^"]+)":/gm, '$1$2:')
    .replace(/,(\s*[}\])])/g, '$1')
    .replace(/"/g, '\'')
    .replace(/\b(Map|Set)\(\d+\)/g, '$1');

  const cases = {
    'plain object': { b: 2, a: 1 },
    'nested object and array': { list: [1, 2, { nested: true }], other: null },
    'empty object': {},
    'empty array': [],
    'number': 42,
    'boolean': true,
    'null': null,
    undefined,
    'regexp': /abc/gi,
    'map': new Map([['a', 1], ['b', 2]]),
    'set': new Set([1, 2, 3]),
    'nested arrays of objects': [{ a: 1 }, { b: 2 }],
  };

  for (const [name, value] of Object.entries(cases)) {
    it(`formats ${name} with the same shape with and without pretty-format`, () => {
      assert.equal(normalize(withInspectFallback(value)), normalize(withPrettyFormat(value)));
    });
  }
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

  it('resolves the snapshot path with a custom extension', () => {
    const resolve = preparePathResolver({ extension: '.snapshot' });
    assert.equal(resolve('/project/test/index.test.js'), '/project/test/__snapshots__/index.test.js.snapshot');
  });

  it('strips the trailing .test segment when stripTestExtension is set', () => {
    const resolve = preparePathResolver({ stripTestExtension: true });
    assert.equal(resolve('/project/test/index.test.js'), '/project/test/__snapshots__/index.js.snap');
  });

  it('strips the trailing .spec segment when stripTestExtension is set', () => {
    const resolve = preparePathResolver({ stripTestExtension: true });
    assert.equal(resolve('/project/test/index.spec.js'), '/project/test/__snapshots__/index.js.snap');
  });

  it('leaves a base name without a test segment unchanged when stripTestExtension is set', () => {
    const resolve = preparePathResolver({ stripTestExtension: true });
    assert.equal(resolve('/project/test/index.js'), '/project/test/__snapshots__/index.js.snap');
  });

  it('combines dirSnapshot, extension, and stripTestExtension options', () => {
    const resolve = preparePathResolver({ dirSnapshot: '__custom__', extension: '.snapshot', stripTestExtension: true });
    assert.equal(resolve('/project/test/index.test.js'), '/project/test/__custom__/index.js.snapshot');
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
