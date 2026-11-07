export interface NotificationCursorCodec {
  fingerprint(input: { readStatus: string; type: string | null }): string;
  encode(input: { createdAt: Date; id: string; fingerprint: string }): string;
  decode(cursor: string, expectedFingerprint: string): { createdAt: Date; id: string };
}
