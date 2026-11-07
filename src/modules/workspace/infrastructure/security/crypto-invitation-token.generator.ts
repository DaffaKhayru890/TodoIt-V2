import { createHash } from 'crypto';
import type {
  GeneratedInvitationToken,
  InvitationTokenGenerator
} from '../../application/ports/invitation-token.generator';
import { createOpaqueToken } from '../../../../shared/infrastructure/security/opaque-token';

/** 256-bit opaque token. Hash SHA-256 adalah satu-satunya bentuk yang disimpan. */
export class CryptoInvitationTokenGenerator implements InvitationTokenGenerator {
  async generate(): Promise<GeneratedInvitationToken> {
    const token = createOpaqueToken();

    return { token, tokenHash: await this.hash(token) };
  }

  async hash(token: string): Promise<string> {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }
}
