import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const problems: string[] = [];

function walk(directory: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      files.push(...walk(path));
      continue;
    }

    if (path.endsWith('.ts')) {
      files.push(path);
    }
  }

  return files;
}

const forbidden = ['drizzle-orm', 'elysia', 'nodemailer', 'pg', 'process.env'];

for (const file of walk(join(root, 'src/modules'))) {
  const layer = file.includes('/domain/') ? 'domain' : file.includes('/application/') ? 'application' : null;

  if (!layer) {
    continue;
  }

  const source = readFileSync(file, 'utf8');

  for (const token of forbidden) {
    if (layer === 'application' && token === 'process.env') {
      if (source.includes('process.env')) {
        problems.push(`${file} membaca process.env`);
      }
      continue;
    }

    if (source.includes(`from '${token}`) || source.includes(`from "${token}`)) {
      problems.push(`${file} mengimpor ${token}`);
    }
  }

  if (layer === 'domain' && source.includes('process.env')) {
    problems.push(`${file} membaca process.env`);
  }
}

const secretPattern = /BEGIN (RSA |OPENSSH )?PRIVATE KEY/;

for (const file of walk(join(root, 'src'))) {
  const source = readFileSync(file, 'utf8');

  if (secretPattern.test(source)) {
    problems.push(`${file} memuat pola secret`);
  }
}

if (problems.length > 0) {
  process.stderr.write(`${problems.join('\n')}\n`);
  process.exit(1);
}

process.stdout.write('boundary check ok\n');
