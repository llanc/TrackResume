import { spawnSync } from 'node:child_process';

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: 'pipe',
    env: process.env,
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  return {
    status: result.status ?? 1,
    output: `${result.stdout || ''}${result.stderr || ''}`,
  };
}

function runOrExit(command, args) {
  const result = run(command, args);
  if (result.status !== 0) {
    process.exit(result.status);
  }
}

function isMissingRemoteD1Bootstrap(output) {
  return output.includes('missing a database_id')
    || output.includes('Please create the remote D1 database by deploying your project');
}

const migrationArgs = ['d1', 'migrations', 'apply', 'DB', '--remote'];
const deployArgs = ['deploy'];

const initialMigration = run('wrangler', migrationArgs);
if (initialMigration.status === 0) {
  runOrExit('wrangler', deployArgs);
  process.exit(0);
}

if (!isMissingRemoteD1Bootstrap(initialMigration.output)) {
  process.exit(initialMigration.status);
}

console.log('Bootstrapping remote D1 and R2 resources before applying migrations...');
runOrExit('wrangler', deployArgs);
runOrExit('wrangler', migrationArgs);
runOrExit('wrangler', deployArgs);
