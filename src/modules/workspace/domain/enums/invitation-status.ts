export const InvitationStatus = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  REVOKED: 'revoked',
  EXPIRED: 'expired'
} as const;

export type InvitationStatus = (typeof InvitationStatus)[keyof typeof InvitationStatus];

export const INVITATION_STATUSES: readonly InvitationStatus[] = [
  InvitationStatus.PENDING,
  InvitationStatus.ACCEPTED,
  InvitationStatus.DECLINED,
  InvitationStatus.REVOKED,
  InvitationStatus.EXPIRED
];

export function isInvitationStatus(value: string): value is InvitationStatus {
  return (INVITATION_STATUSES as readonly string[]).includes(value);
}
