export interface CollaborationFingerprintInput {
  readonly kind: 'workspace-invitations' | 'my-invitations' | 'members';
  readonly workspaceId: string | null;
  readonly status: string | null;
  readonly role: string | null;
}

export interface InvitationCursorPayload {
  readonly workspaceId: string | null;
  readonly createdAt: Date;
  readonly id: string;
  readonly fingerprint: string;
}

export interface MemberCursorPayload {
  readonly workspaceId: string;
  readonly joinedAt: Date;
  readonly userId: string;
  readonly fingerprint: string;
}

export interface CollaborationCursorCodec {
  fingerprint(input: CollaborationFingerprintInput): string;
  encodeInvitation(payload: InvitationCursorPayload): string;
  decodeInvitation(
    cursor: string,
    expected: { workspaceId: string | null; fingerprint: string }
  ): { createdAt: Date; id: string };
  encodeMember(payload: MemberCursorPayload): string;
  decodeMember(
    cursor: string,
    expected: { workspaceId: string; fingerprint: string }
  ): { joinedAt: Date; userId: string };
}
