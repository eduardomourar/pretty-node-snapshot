import { github, javascript, typescript } from 'projen';

const project = new javascript.NodeProject({
  name: 'pretty-node-snapshot',
  description: 'Readable, Jest-style snapshot formatting and path resolution for Node.js native test runner.',
  repository: 'git+https://github.com/eduardomourar/pretty-node-snapshot.git',
  packageManager: javascript.NodePackageManager.NPM,
  minNodeVersion: '24',
  workflowNodeVersion: 'lts/*',
  entrypoint: './src/index.js',
  jest: false,
  projenrcJs: false,
  defaultReleaseBranch: 'main',
  license: 'MIT',
  copyrightOwner: 'Eduardo Rodrigues <16357187+eduardomourar@users.noreply.github.com>',
  releaseToNpm: true,
  npmTrustedPublishing: true,
  releaseEnvironment: 'release',
  dependabot: true,
  dependabotOptions: {
    scheduleInterval: github.DependabotScheduleInterval.WEEKLY,
  },
  autoMerge: false,
  devDeps: [
    '@types/node@^24',
    'pretty-format',
  ],
  keywords: ['nodejs', 'test', 'snapshot', 'pretty-format', 'node:test'],
});
project.package.addField('optionalDependencies', {
  'pretty-format': '^30',
});
project.package.addField('type', 'module');
project.package.addField('exports', {
  '.': './src/index.js',
  './register': './src/register.js',
});
project.npmignore?.exclude('.claude/');
project.npmignore?.exclude('.github/');
project.npmignore?.exclude('coverage/');
project.npmignore?.exclude('test/');
project.npmignore?.exclude('.eslintrc.json');
project.npmignore?.exclude('node.config.json');

const eslint = new javascript.Eslint(project, {
  aliasMap: {},
  ignorePatterns: [
    '*.js',
    '*.d.ts',
    'node_modules/',
    '*.generated.ts',
    'coverage',
    '!src/**.js',
    '!test/**.js',
    '!.projenrc.ts',
  ],
  dirs: ['src/'],
  devdirs: ['test/'],
  fileExtensions: ['.js', '.ts'],
  tsconfigPath: './tsconfig.projen.json',
});
const projenrc = new typescript.ProjenrcTs(project, {
  runner: typescript.TypeScriptRunner.nodejs(),
});
projenrc.tsconfig.addInclude('src/**.js');
projenrc.tsconfig.addInclude('test/**.js');
projenrc.tsconfig.addExclude('coverage');
projenrc.tsconfig.file.addOverride('compilerOptions.checkJs', true);
projenrc.tsconfig.file.addOverride('compilerOptions.allowJs', true);
projenrc.tsconfig.file.addOverride('compilerOptions.types', ['node']);
eslint.addLintPattern('.projenrc.ts');
eslint.allowDevDeps('.projenrc.ts');
eslint.addOverride({
  files: ['src/index.js'],
  rules: {
    'import/no-extraneous-dependencies': 'off',
  },
});
eslint.addOverride({
  files: ['test/**'],
  rules: {
    // node:test's `describe`/`it` return promises that tests intentionally don't await
    '@typescript-eslint/no-floating-promises': 'off',
  },
});

const baseCommand = "node --experimental-config-file='./node.config.json'";
project.testTask.prependExec(`${baseCommand} --test-update-snapshots`, { receiveArgs: true });
project.testTask.prependExec('mkdir -p coverage');
const testWatchTask = project.tasks.tryFind('test:watch');
if (!testWatchTask) {
  project.addTask('test:watch', {
    description: 'Run tests in watch mode',
    exec: `${baseCommand} --watch`,
  });
}

project.synth();
