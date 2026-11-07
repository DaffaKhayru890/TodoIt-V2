import { SignJWT, jwtVerify } from 'jose';
import type {
  AccessTokenClaims,
  AccessTokenService,
  IssuedAccessToken
} from '../../application/ports/access-token-service';
import type { Clock } from '../../application/ports/clock';
import { systemClock } from '../../application/ports/clock';

export interface JoseAccessTokenServiceConfig {
  readonly secret: string;
  readonly issuer: string;
  readonly audience: string;
  readonly ttlSeconds: number;
  readonly clock?: Clock;
}

export class JoseAccessTokenService implements AccessTokenService {
  private readonly secretKey: Uint8Array;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly ttlSeconds: number;
  private readonly clock: Clock;

  constructor(config: JoseAccessTokenServiceConfig) {
    this.secretKey = new TextEncoder().encode(config.secret);
    this.issuer = config.issuer;
    this.audience = config.audience;
    this.ttlSeconds = config.ttlSeconds;
    this.clock = config.clock ?? systemClock;
  }

  async generate(input: { userId: string; sessionId: string }): Promise<IssuedAccessToken> {
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + this.ttlSeconds * 1000);

    const token = await new SignJWT({
      sub: input.userId,
      sid: input.sessionId
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt(Math.floor(now.getTime() / 1000))
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.secretKey);

    return {
      token,
      expiresAt
    };
  }

  async verify(token: string): Promise<AccessTokenClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.secretKey, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['HS256'],
        currentDate: this.clock.now()
      });

      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
        return null;
      }

      return {
        userId: payload.sub,
        sessionId: payload.sid
      };
    } catch {
      return null;
    }
  }
}
