import type { Clock } from '../../../../shared/domain/clock';
import type { WorkspaceInvitation } from '../../domain/entities/workspace-invitation';
import { EmailDeliveryStatus } from '../../domain/enums/email-delivery-status';
import type { WorkspaceInvitationRepository } from '../../domain/repositories/workspace-invitation.repository';
import type { InvitationEmailSender } from '../ports/invitation-email.sender';

export function buildInvitationUrl(webAppUrl: string, token: string): string {
  const base = webAppUrl.endsWith('/') ? webAppUrl.slice(0, -1) : webAppUrl;

  return `${base}/invitations/accept#token=${encodeURIComponent(token)}`;
}

/**
 * Email dikirim di luar transaksi database. Kegagalan hanya mengubah
 * deliveryStatus; status undangan tidak menjadi accepted atau revoked.
 */
export async function deliverInvitationEmail(input: {
  invitation: WorkspaceInvitation;
  token: string;
  inviterName: string;
  workspaceName: string;
  webAppUrl: string;
  sender: InvitationEmailSender;
  invitations: WorkspaceInvitationRepository;
  clock: Clock;
}): Promise<WorkspaceInvitation> {
  const now = input.clock.now();

  try {
    await input.sender.sendWorkspaceInvitation({
      recipientEmail: input.invitation.normalizedEmail,
      inviterName: input.inviterName,
      workspaceName: input.workspaceName,
      role: input.invitation.role,
      invitationUrl: buildInvitationUrl(input.webAppUrl, input.token),
      expiresAt: input.invitation.expiresAt
    });
    const updated = await input.invitations.update(
      input.invitation.markDelivery(EmailDeliveryStatus.SENT, now)
    );

    return updated ?? input.invitation.markDelivery(EmailDeliveryStatus.SENT, now);
  } catch {
    const updated = await input.invitations.update(
      input.invitation.markDelivery(EmailDeliveryStatus.FAILED, now)
    );

    return updated ?? input.invitation.markDelivery(EmailDeliveryStatus.FAILED, now);
  }
}
