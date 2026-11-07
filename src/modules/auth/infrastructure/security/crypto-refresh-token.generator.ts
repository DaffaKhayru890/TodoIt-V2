import { createHash } from 'crypto';
import type {
  GeneratedRefreshToken,
  RefreshTokenGenerator
} from '../../application/ports/refresh-token-generator';
import { createOpaqueToken } from '../../../../shared/infrastructure/security/opaque-token';

export class CryptoRefreshTokenGenerator implements RefreshTokenGenerator {
  async generate(): Promise<GeneratedRefreshToken> {
    const token = createOpaqueToken();
    const hash = await this.hash(token);
    return { token, hash };
  }

  async hash(token: string): Promise<string> {
    return createHash('sha256').update(token).digest('hex');
  }
}
