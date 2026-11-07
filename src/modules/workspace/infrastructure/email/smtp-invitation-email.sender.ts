import nodemailer, { type Transporter } from 'nodemailer';
import type { Logger } from '../../../../shared/infrastructure/logging/logger';
import type {
  InvitationEmailMessage,
  InvitationEmailSender
} from '../../application/ports/invitation-email.sender';
import { renderInvitationEmail } from './invitation-email.template';

export interface SmtpInvitationConfig {
  readonly host: string;
  readonly port: number;
  readonly user: string;
  readonly password: string;
  readonly from: string;
  readonly secure: boolean;
}

/**
 * Adapter SMTP. Kredensial dan token tidak ditulis ke log.
 * Kegagalan dilempar sebagai Error generik tanpa respons SMTP mentah.
 */
export class SmtpInvitationEmailSender implements InvitationEmailSender {
  private readonly transport: Transporter;

  constructor(
    private readonly config: SmtpInvitationConfig,
    private readonly logger: Logger
  ) {
    this.transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      ...(config.user.length > 0
        ? { auth: { user: config.user, pass: config.password } }
        : {})
    });
  }

  async sendWorkspaceInvitation(input: InvitationEmailMessage): Promise<void> {
    const content = renderInvitationEmail(input);

    try {
      await this.transport.sendMail({
        from: this.config.from,
        to: input.recipientEmail,
        subject: content.subject,
        text: content.text,
        html: content.html
      });
      this.logger.info('invitation email dispatched', {
        workspaceName: input.workspaceName,
        role: input.role
      });
    } catch (error) {
      this.logger.warn('invitation email failed', {
        errorName: error instanceof Error ? error.name : 'Error'
      });
      throw new Error('Pengiriman email undangan gagal.');
    }
  }
}
