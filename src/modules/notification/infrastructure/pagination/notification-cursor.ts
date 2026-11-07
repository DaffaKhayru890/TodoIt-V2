import { createHash } from 'node:crypto';
import type { NotificationCursorCodec as NotificationCursorPort } from '../../application/ports/notification-cursor';
import { NotificationError } from '../../domain/errors/notification-error';

const VERSION = 1;

function fingerprint(input: { readStatus: string; type: string | null }): string {
  return createHash('sha256')
    .update(`${input.readStatus}:${input.type ?? ''}`, 'utf8')
    .digest('hex');
}

export class Base64UrlNotificationCursorCodec implements NotificationCursorPort {
  fingerprint(input: { readStatus: string; type: string | null }): string {
    return fingerprint(input);
  }

  encode(input: { createdAt: Date; id: string; fingerprint: string }): string {
    return Buffer.from(
      JSON.stringify({
        version: VERSION,
        createdAt: input.createdAt.toISOString(),
        id: input.id,
        fingerprint: input.fingerprint
      }),
      'utf8'
    ).toString('base64url');
  }

  decode(cursor: string, expectedFingerprint: string): { createdAt: Date; id: string } {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
        version?: number;
        createdAt?: string;
        id?: string;
        fingerprint?: string;
      };

      if (parsed.version !== VERSION || parsed.fingerprint !== expectedFingerprint || !parsed.createdAt || !parsed.id) {
        throw NotificationError.invalidCursor();
      }

      const createdAt = new Date(parsed.createdAt);

      if (Number.isNaN(createdAt.getTime())) {
        throw NotificationError.invalidCursor();
      }

      return { createdAt, id: parsed.id };
    } catch (error) {
      if (error instanceof NotificationError) {
        throw error;
      }

      throw NotificationError.invalidCursor();
    }
  }
}
