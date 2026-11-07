import type { Clock } from '../../../../../shared/domain/clock';
import { WorkspaceInvitation } from '../../../domain/entities/workspace-invitation';
import { WorkspaceRole } from '../../../domain/enums/workspace-role';
import { WorkspaceError } from '../../../domain/errors/workspace-error';
import { WorkspaceAction } from '../../../domain/policies/workspace-authorization.policy';
import type { WorkspaceInvitationRepository } from '../../../domain/repositories/workspace-invitation.repository';
import { toInvitationEmail } from '../../../domain/value-objects/invitation-email';
import { toInvitationDto, type InvitationDto } from '../../dto/invitation.dto';
import type { InvitationEmailSender } from '../../ports/invitation-email.sender';
import type { InvitationTokenGenerator } from '../../ports/invitation-token.generator';
import type { WorkspaceUnitOfWork } from '../../ports/workspace-unit-of-work';
import type { WorkspaceUserDirectory } from '../../ports/workspace-user-directory';
import { deliverInvitationEmail } from '../../services/invitation-mailer';
import type { WorkspaceAuthorizationService } from '../../services/workspace-authorization.service';

export interface CreateInvitationInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly inviterEmail: string;
  readonly inviterName: string;
  readonly email: string;
  readonly role: string;
}

export class CreateInvitation {
  constructor(
    private readonly authorization: WorkspaceAuthorizationService,
    private readonly uow: WorkspaceUnitOfWork,
    private readonly invitations: WorkspaceInvitationRepository,
    private readonly users: WorkspaceUserDirectory,
    private readonly tokens: InvitationTokenGenerator,
    private readonly emailSender: InvitationEmailSender,
    private readonly clock: Clock,
    private readonly webAppUrl: string,
    private readonly ttlSeconds: number
  ) {}

  async execute(input: CreateInvitationInput): Promise<{ invitation: InvitationDto }> {
    const address = toInvitationEmail(input.email);

    if (input.role !== WorkspaceRole.ADMIN && input.role !== WorkspaceRole.MEMBER) {
      throw WorkspaceError.invitationRoleInvalid();
    }

    const action =
      input.role === WorkspaceRole.ADMIN ? WorkspaceAction.INVITE_ADMIN : WorkspaceAction.INVITE_MEMBER;
    const authorized = await this.authorization.authorize({
      workspaceId: input.workspaceId,
      userId: input.userId,
      action
    });

    if (address.normalizedEmail === input.inviterEmail.trim().toLowerCase()) {
      throw WorkspaceError.validationError('Anda tidak dapat mengundang email akun sendiri.');
    }

    const existingUser = await this.users.findByNormalizedEmail(address.normalizedEmail);
    const generated = await this.tokens.generate();
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + this.ttlSeconds * 1000);
    const invitation = WorkspaceInvitation.create({
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      email: address.email,
      normalizedEmail: address.normalizedEmail,
      role: input.role,
      tokenHash: generated.tokenHash,
      invitedBy: input.userId,
      expiresAt,
      now
    });

    const stored = await this.uow.run(async (tx) => {
      const workspace = await tx.lockWorkspace(input.workspaceId);

      if (!workspace || workspace.archivedAt !== null) {
        throw WorkspaceError.accessDenied();
      }

      await tx.invitations.expirePending(
        { workspaceId: input.workspaceId, normalizedEmail: address.normalizedEmail },
        now
      );
      const pending = await tx.invitations.findPending(input.workspaceId, address.normalizedEmail);

      if (pending) {
        throw WorkspaceError.invitationAlreadyPending();
      }

      if (existingUser) {
        const member = await tx.members.find(input.workspaceId, existingUser.id);

        if (member) {
          throw WorkspaceError.memberAlreadyExists();
        }
      }

      return await tx.invitations.insert(invitation);
    });

    const delivered = await deliverInvitationEmail({
      invitation: stored,
      token: generated.token,
      inviterName: input.inviterName,
      workspaceName: authorized.workspace.name,
      webAppUrl: this.webAppUrl,
      sender: this.emailSender,
      invitations: this.invitations,
      clock: this.clock
    });

    return { invitation: toInvitationDto(delivered, this.clock.now()) };
  }
}
