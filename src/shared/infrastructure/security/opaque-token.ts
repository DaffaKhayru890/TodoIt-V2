import { randomBytes } from 'crypto';

/** 32 byte entropy; tidak mengandung timestamp maupun identifier user. */
const TOKEN_BYTES = 32;

export function createOpaqueToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/** Hex lowercase: stabil di seluruh runtime dan mudah dibandingkan secara case-sensitive. */
export function toHex(digest: ArrayBuffer | Uint8Array): string {
  return Buffer.from(digest instanceof Uint8Array ? digest : new Uint8Array(digest)).toString('hex');
}
