import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.ts') ? [path] : [];
  });
}

describe('architecture boundaries', () => {
  test('domain dan application tidak mengimpor framework atau database driver', () => {
    const files = walk('src/modules').filter((file) => file.includes('/domain/') || file.includes('/application/'));
    const forbidden = ['drizzle-orm', 'elysia', 'nodemailer', "from 'pg'", 'from "pg"'];
    const offenders = files.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return forbidden.some((token) => source.includes(token));
    });

    expect(offenders).toEqual([]);
  });
});
