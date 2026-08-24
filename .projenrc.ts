import { github, javascript, typescript } from 'projen';

const project = new javascript.NodeProject({
  name: 'pretty-node-snapshot',
  description: 'Readable, Jest-style snapshot formatting and path resolution for Node.js native test runner.',
  packageManager: javascript.NodePackageManager.NPM,
  minNodeVersion: '24',
  workflowNodeVersion: 'lts/*',
  entrypoint: './src/index.js',
  jest: false,
  projenrcJs: false,
  defaultReleaseBranch: 'main',
  license: 'MIT',
  copyrightOwner: 'Eduardo Rodrigues <16357187+eduardomourar@users.noreply.github.com>',
  dependabot: true,
  dependabotOptions: {
    scheduleInterval: github.DependabotScheduleInterval.WEEKLY,
  },
  devDeps: [
    '@types/node@^24',
  ],
  deps: [
    'pretty-format',
  ],
});
project.package.addField('type', 'module');
project.package.addField('exports', {
  '.': './src/index.js',
  './register': './src/register.js',
});
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
eslint.addLintPattern('.projenrc.ts');
eslint.allowDevDeps('.projenrc.ts');

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
