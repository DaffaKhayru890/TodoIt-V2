import { spawnSync } from 'node:child_process';

const steps = [
  ['bun', 'run', 'typecheck'],
  ['bun', 'run', 'lint'],
  ['bun', 'run', 'openapi:validate'],
  ['bun', 'test', '--env-file=.env.test'],
  ['bun', 'run', 'build']
];

for (const step of steps) {
  process.stdout.write(`\n> ${step.join(' ')}\n`);
  const result = spawnSync(step[0]!, step.slice(1), { stdio: 'inherit' });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
