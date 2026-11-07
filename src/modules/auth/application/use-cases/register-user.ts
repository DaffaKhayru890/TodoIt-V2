import { AuthError } from '../../domain/errors/auth-error';
import { toDisplayName } from '../../domain/value-objects/display-name';
import { toEmail } from '../../domain/value-objects/email';
import { assertPasswordPolicy } from '../../domain/services/password-policy';
import type { UserRepository } from '../../domain/repositories/user-repository';
import type { RegisteredUserDto } from '../dto/auth-result-dto';
import type { Clock } from '../ports/clock';
import type { PasswordHasher } from '../ports/password-hasher';

export interface RegisterUserInput {
  readonly email: string;
  readonly displayName: string;
  readonly password: string;
}

/**
 * Use case registrasi. Aturan bisnis (normalisasi email, kebijakan password)
 * dieksekusi di sini; hashing didelegasikan ke port PasswordHasher sehingga use
 * case ini tidak mengenal Argon2id maupun runtime-nya.
 */
export class RegisterUser {
  constructor(
    private readonly users: UserRepository,
    private readonly passwords: PasswordHasher,
    private readonly clock: Clock
  ) {}

  async execute(input: RegisterUserInput): Promise<RegisteredUserDto> {
    const email = toEmail(input.email);
    const displayName = toDisplayName(input.displayName);
    assertPasswordPolicy(input.password);

    // Pemeriksaan awal memberi pesan yang jelas untuk kasus umum; keunikan
    // sebenarnya tetap dijaga constraint database (lihat repository).
    if (await this.users.findByEmail(email)) {
      throw AuthError.emailAlreadyExists();
    }

    const passwordHash = await this.passwords.hash(input.password);
    const createdAt = this.clock.now();
    const user = await this.users.createNewUser({ email, displayName, passwordHash, now: createdAt });

    return {
      id: user.id,
      email: user.email.value,
      displayName: user.displayName,
      createdAt: user.createdAt
    };
  }
}
