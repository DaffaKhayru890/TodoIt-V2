export interface InvitationEmailMessage {
  readonly recipientEmail: string;
  readonly inviterName: string;
  readonly workspaceName: string;
  readonly role: 'admin' | 'member';
  readonly invitationUrl: string;
  readonly expiresAt: Date;
}

/**
 * Port pengiriman email. Use case tidak mengenal SMTP.
 * Implementasi tidak boleh mencatat token atau kredensial.
 */
export interface InvitationEmailSender {
  sendWorkspaceInvitation(input: InvitationEmailMessage): Promise<void>;
}
