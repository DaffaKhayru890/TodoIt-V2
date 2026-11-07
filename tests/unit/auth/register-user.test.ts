import { describe, expect, test } from 'bun:test';
import { RegisterUser } from '../../../src/modules/auth/application/use-cases/register-user';
import { InMemoryAuthRepository } from '../../helpers/in-memory-auth-repository';
import type { PasswordHasher } from '../../../src/modules/auth/application/ports/password-hasher';
import type { Clock } from '../../../src/modules/auth/application/ports/clock';
import { AuthError } from '../../../src/modules/auth/domain/errors/auth-error';

const fakeHasher: PasswordHasher = {
  hash: async (password: string) => `hashed_${password}`,
  verify: async (pwd, hash) => hash === `hashed_${pwd}`
};

const fixedClock: Clock = {
  now: () => new Date('2026-01-01T00:00:00.000Z')
};

describe('RegisterUser use case', () => {
  test('register dengan data valid', async () => {
    const repo = new InMemoryAuthRepository();
    const useCase = new RegisterUser(repo, fakeHasher, fixedClock);

    const result = await useCase.execute({
      email: 'developer@example.com',
      displayName: 'Developer',
      password: 'a-secure-long-passphrase'
    });

    expect(result.id).toBeString();
    expect(result.email).toBe('developer@example.com');
    expect(result.displayName).toBe('Developer');
    expect(result.createdAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
  });

  test('email tidak valid melempar INVALID_EMAIL', async () => {
    const repo = new InMemoryAuthRepository();
    const useCase = new RegisterUser(repo, fakeHasher, fixedClock);

    await expect(
      useCase.execute({
        email: 'bukan-email',
        displayName: 'Developer',
        password: 'a-secure-long-passphrase'
      })
    ).rejects.toThrow(AuthError);
  });

  test('email duplikat melempar EMAIL_ALREADY_EXISTS', async () => {
    const repo = new InMemoryAuthRepository();
    const useCase = new RegisterUser(repo, fakeHasher, fixedClock);

    await useCase.execute({
      email: 'developer@example.com',
      displayName: 'Developer 1',
      password: 'a-secure-long-passphrase'
    });

    await expect(
      useCase.execute({
        email: 'developer@example.com',
        displayName: 'Developer 2',
        password: 'another-secure-passphrase'
      })
    ).rejects.toThrow('Email sudah terdaftar.');
  });

  test('password terlalu pendek (< 12 karakter) ditolak', async () => {
    const repo = new InMemoryAuthRepository();
    const useCase = new RegisterUser(repo, fakeHasher, fixedClock);

    await expect(
      useCase.execute({
        email: 'dev@example.com',
        displayName: 'Dev',
        password: 'short'
      })
    ).rejects.toThrow('Password harus minimal 12 karakter.');
  });

  test('password terlalu panjang (> 128 karakter) ditolak', async () => {
    const repo = new InMemoryAuthRepository();
    const useCase = new RegisterUser(repo, fakeHasher, fixedClock);

    const longPassword = 'a'.repeat(129);
    await expect(
      useCase.execute({
        email: 'dev@example.com',
        displayName: 'Dev',
        password: longPassword
      })
    ).rejects.toThrow('Password tidak boleh lebih dari 128 karakter.');
  });

  test('password tidak disimpan sebagai plaintext', async () => {
    const repo = new InMemoryAuthRepository();
    const useCase = new RegisterUser(repo, fakeHasher, fixedClock);

    await useCase.execute({
      email: 'dev@example.com',
      displayName: 'Dev',
      password: 'a-secure-long-passphrase'
    });

    const stored = repo.users[0];
    expect(stored).toBeDefined();
    expect(stored?.passwordHash).not.toBe('a-secure-long-passphrase');
    expect(stored?.passwordHash).toBe('hashed_a-secure-long-passphrase');
  });

  test('email dinormalisasi (lowercase dan trim)', async () => {
    const repo = new InMemoryAuthRepository();
    const useCase = new RegisterUser(repo, fakeHasher, fixedClock);

    const result = await useCase.execute({
      email: '   DeVeLoPeR@Example.COM   ',
      displayName: 'Dev',
      password: 'a-secure-long-passphrase'
    });

    expect(result.email).toBe('developer@example.com');
    const stored = repo.users[0];
    expect(stored?.email.value).toBe('developer@example.com');
  });

  test('repository gagal menyimpan user meneruskan exception', async () => {
    const repo = new InMemoryAuthRepository();
    repo.failOnCreateUser = true;
    const useCase = new RegisterUser(repo, fakeHasher, fixedClock);

    await expect(
      useCase.execute({
        email: 'dev@example.com',
        displayName: 'Dev',
        password: 'a-secure-long-passphrase'
      })
    ).rejects.toThrow('Database connection lost');
  });
});
