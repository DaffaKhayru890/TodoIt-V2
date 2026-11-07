import { EmailDeliveryStatus, type EmailDeliveryStatus as EmailDeliveryStatusType } from '../enums/email-delivery-status';
import { InvitationStatus, type InvitationStatus as InvitationStatusType } from '../enums/invitation-status';
import { WorkspaceRole } from '../enums/workspace-role';
import { WorkspaceError } from '../errors/workspace-error';

export type InvitationRole = typeof WorkspaceRole.ADMIN | typeof WorkspaceRole.MEMBER;

export interface WorkspaceInvitationSnapshot {
  readonly id: string;
  readonly workspaceId: string;
  readonly email: string;
  readonly normalizedEmail: string;
  readonly role: InvitationRole;
  readonly tokenHash: string;
  readonly status: InvitationStatusType;
  readonly invitedBy: string;
  readonly acceptedBy: string | null;
  readonly expiresAt: Date;
  readonly acceptedAt: Date | null;
  readonly declinedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly deliveryStatus: EmailDeliveryStatusType;
  readonly emailSentAt: Date | null;
  readonly emailLastAttemptAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateInvitationProps {
  readonly id: string;
  readonly workspaceId: string;
  readonly email: string;
  readonly normalizedEmail: string;
  readonly role: string;
  readonly tokenHash: string;
  readonly invitedBy: string;
  readonly expiresAt: Date;
  readonly now: Date;
}

function assertDate(value: Date, field: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw WorkspaceError.validationError(`${field} harus berupa tanggal yang valid.`);
  }
}

export function isInvitationRole(value: string): value is InvitationRole {
  return value === WorkspaceRole.ADMIN || value === WorkspaceRole.MEMBER;
}

/**
 * Undangan workspace. Token mentah tidak pernah menjadi bagian entity;
 * yang disimpan hanya hash.
 */
export class WorkspaceInvitation {
  private constructor(private readonly snapshot: WorkspaceInvitationSnapshot) {}

  static create(props: CreateInvitationProps): WorkspaceInvitation {
    assertDate(props.now, 'now');
    assertDate(props.expiresAt, 'expiresAt');

    if (!isInvitationRole(props.role)) {
      throw WorkspaceError.invitationRoleInvalid();
    }

    if (props.tokenHash.trim().length === 0) {
      throw WorkspaceError.validationError('Hash token undangan wajib diisi.');
    }

    if (props.expiresAt.getTime() <= props.now.getTime()) {
      throw WorkspaceError.validationError('Undangan harus kedaluwarsa di masa depan.');
    }

    return new WorkspaceInvitation({
      id: props.id,
      workspaceId: props.workspaceId,
      email: props.email,
      normalizedEmail: props.normalizedEmail,
      role: props.role,
      tokenHash: props.tokenHash,
      status: InvitationStatus.PENDING,
      invitedBy: props.invitedBy,
      acceptedBy: null,
      expiresAt: new Date(props.expiresAt.getTime()),
      acceptedAt: null,
      declinedAt: null,
      revokedAt: null,
      deliveryStatus: EmailDeliveryStatus.PENDING,
      emailSentAt: null,
      emailLastAttemptAt: null,
      createdAt: new Date(props.now.getTime()),
      updatedAt: new Date(props.now.getTime())
    });
  }

  static restore(snapshot: WorkspaceInvitationSnapshot): WorkspaceInvitation {
    if (!isInvitationRole(snapshot.role)) {
      throw WorkspaceError.invitationRoleInvalid();
    }

    return new WorkspaceInvitation({
      ...snapshot,
      expiresAt: new Date(snapshot.expiresAt.getTime()),
      acceptedAt: snapshot.acceptedAt ? new Date(snapshot.acceptedAt.getTime()) : null,
      declinedAt: snapshot.declinedAt ? new Date(snapshot.declinedAt.getTime()) : null,
      revokedAt: snapshot.revokedAt ? new Date(snapshot.revokedAt.getTime()) : null,
      emailSentAt: snapshot.emailSentAt ? new Date(snapshot.emailSentAt.getTime()) : null,
      emailLastAttemptAt: snapshot.emailLastAttemptAt
        ? new Date(snapshot.emailLastAttemptAt.getTime())
        : null,
      createdAt: new Date(snapshot.createdAt.getTime()),
      updatedAt: new Date(snapshot.updatedAt.getTime())
    });
  }

  get id(): string {
    return this.snapshot.id;
  }

  get workspaceId(): string {
    return this.snapshot.workspaceId;
  }

  get email(): string {
    return this.snapshot.email;
  }

  get normalizedEmail(): string {
    return this.snapshot.normalizedEmail;
  }

  get role(): InvitationRole {
    return this.snapshot.role;
  }

  get tokenHash(): string {
    return this.snapshot.tokenHash;
  }

  get status(): InvitationStatusType {
    return this.snapshot.status;
  }

  get invitedBy(): string {
    return this.snapshot.invitedBy;
  }

  get acceptedBy(): string | null {
    return this.snapshot.acceptedBy;
  }

  get expiresAt(): Date {
    return new Date(this.snapshot.expiresAt.getTime());
  }

  get acceptedAt(): Date | null {
    return this.snapshot.acceptedAt ? new Date(this.snapshot.acceptedAt.getTime()) : null;
  }

  get declinedAt(): Date | null {
    return this.snapshot.declinedAt ? new Date(this.snapshot.declinedAt.getTime()) : null;
  }

  get revokedAt(): Date | null {
    return this.snapshot.revokedAt ? new Date(this.snapshot.revokedAt.getTime()) : null;
  }

  get deliveryStatus(): EmailDeliveryStatusType {
    return this.snapshot.deliveryStatus;
  }

  get emailSentAt(): Date | null {
    return this.snapshot.emailSentAt ? new Date(this.snapshot.emailSentAt.getTime()) : null;
  }

  get emailLastAttemptAt(): Date | null {
    return this.snapshot.emailLastAttemptAt
      ? new Date(this.snapshot.emailLastAttemptAt.getTime())
      : null;
  }

  get createdAt(): Date {
    return new Date(this.snapshot.createdAt.getTime());
  }

  get updatedAt(): Date {
    return new Date(this.snapshot.updatedAt.getTime());
  }

  /** Status yang dilihat klien. Pending yang lewat expiresAt dibaca sebagai expired. */
  effectiveStatus(now: Date): InvitationStatusType {
    assertDate(now, 'now');

    if (
      this.snapshot.status === InvitationStatus.PENDING &&
      this.snapshot.expiresAt.getTime() <= now.getTime()
    ) {
      return InvitationStatus.EXPIRED;
    }

    return this.snapshot.status;
  }

  matchesTokenHash(tokenHash: string): boolean {
    return this.snapshot.tokenHash === tokenHash;
  }

  expire(now: Date): WorkspaceInvitation {
    assertDate(now, 'now');

    if (this.effectiveStatus(now) !== InvitationStatus.EXPIRED) {
      throw WorkspaceError.validationError('Undangan belum kedaluwarsa.');
    }

    if (this.snapshot.status === InvitationStatus.EXPIRED) {
      return this;
    }

    return new WorkspaceInvitation({
      ...this.snapshot,
      status: InvitationStatus.EXPIRED,
      updatedAt: new Date(now.getTime())
    });
  }

  accept(userId: string, now: Date): WorkspaceInvitation {
    this.assertPendingUsable(now);

    return new WorkspaceInvitation({
      ...this.snapshot,
      status: InvitationStatus.ACCEPTED,
      acceptedBy: userId,
      acceptedAt: new Date(now.getTime()),
      updatedAt: new Date(now.getTime())
    });
  }

  /**
   * Decline idempoten bila sudah declined. Token tetap harus cocok di pemanggil.
   */
  decline(now: Date): WorkspaceInvitation {
    assertDate(now, 'now');

    if (this.snapshot.status === InvitationStatus.DECLINED) {
      return this;
    }

    this.assertPendingUsable(now);

    return new WorkspaceInvitation({
      ...this.snapshot,
      status: InvitationStatus.DECLINED,
      declinedAt: new Date(now.getTime()),
      updatedAt: new Date(now.getTime())
    });
  }

  /** Revoke idempoten. Hanya pending yang dapat dicabut. */
  revoke(now: Date): WorkspaceInvitation {
    assertDate(now, 'now');

    if (this.snapshot.status === InvitationStatus.REVOKED) {
      return this;
    }

    if (this.effectiveStatus(now) !== InvitationStatus.PENDING) {
      throw this.terminalError(now);
    }

    return new WorkspaceInvitation({
      ...this.snapshot,
      status: InvitationStatus.REVOKED,
      revokedAt: new Date(now.getTime()),
      updatedAt: new Date(now.getTime())
    });
  }

  /**
   * Rotasi token untuk resend. Berlaku pada pending dan expired.
   * Hash lama diganti sehingga token sebelumnya langsung tidak valid.
   */
  rotateToken(tokenHash: string, expiresAt: Date, now: Date): WorkspaceInvitation {
    assertDate(now, 'now');
    assertDate(expiresAt, 'expiresAt');

    if (tokenHash.trim().length === 0) {
      throw WorkspaceError.validationError('Hash token undangan wajib diisi.');
    }

    if (expiresAt.getTime() <= now.getTime()) {
      throw WorkspaceError.validationError('Undangan harus kedaluwarsa di masa depan.');
    }

    const status = this.effectiveStatus(now);

    if (status !== InvitationStatus.PENDING && status !== InvitationStatus.EXPIRED) {
      throw this.terminalError(now);
    }

    return new WorkspaceInvitation({
      ...this.snapshot,
      tokenHash,
      status: InvitationStatus.PENDING,
      expiresAt: new Date(expiresAt.getTime()),
      deliveryStatus: EmailDeliveryStatus.PENDING,
      emailSentAt: null,
      emailLastAttemptAt: null,
      updatedAt: new Date(now.getTime())
    });
  }

  markDelivery(status: EmailDeliveryStatusType, now: Date): WorkspaceInvitation {
    assertDate(now, 'now');

    return new WorkspaceInvitation({
      ...this.snapshot,
      deliveryStatus: status,
      emailLastAttemptAt: new Date(now.getTime()),
      emailSentAt: status === EmailDeliveryStatus.SENT ? new Date(now.getTime()) : this.snapshot.emailSentAt,
      updatedAt: new Date(now.getTime())
    });
  }

  toSnapshot(): WorkspaceInvitationSnapshot {
    return {
      ...this.snapshot,
      expiresAt: new Date(this.snapshot.expiresAt.getTime()),
      acceptedAt: this.acceptedAt,
      declinedAt: this.declinedAt,
      revokedAt: this.revokedAt,
      emailSentAt: this.emailSentAt,
      emailLastAttemptAt: this.emailLastAttemptAt,
      createdAt: new Date(this.snapshot.createdAt.getTime()),
      updatedAt: new Date(this.snapshot.updatedAt.getTime())
    };
  }

  private assertPendingUsable(now: Date): void {
    const status = this.effectiveStatus(now);

    if (status === InvitationStatus.PENDING) {
      return;
    }

    throw this.terminalError(now);
  }

  private terminalError(now: Date): WorkspaceError {
    switch (this.effectiveStatus(now)) {
      case InvitationStatus.ACCEPTED:
        return WorkspaceError.invitationAlreadyAccepted();
      case InvitationStatus.DECLINED:
        return WorkspaceError.invitationAlreadyDeclined();
      case InvitationStatus.REVOKED:
        return WorkspaceError.invitationAlreadyRevoked();
      case InvitationStatus.EXPIRED:
        return WorkspaceError.invitationExpired();
      default:
        return WorkspaceError.invitationResendNotAllowed();
    }
  }
}
