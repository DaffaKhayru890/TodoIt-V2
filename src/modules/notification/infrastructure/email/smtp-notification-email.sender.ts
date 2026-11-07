import type { Transporter } from 'nodemailer';
import type { Logger } from '../../../../shared/infrastructure/logging/logger';
import { sendSmtpMessage, smtpFailureCode } from '../../../../shared/infrastructure/email/smtp-transport';
import {
  NotificationDeliveryError,
  type NotificationEmailMessage,
  type NotificationEmailSender
} from '../../application/ports/notification-email.sender';
import { renderNotificationEmail } from './notification-email.template';

export class SmtpNotificationEmailSender implements NotificationEmailSender {
  constructor(
    private readonly transport: Transporter,
    private readonly from: string,
    private readonly webAppUrl: string,
    private readonly logger: Logger
  ) {}

  async send(input: NotificationEmailMessage): Promise<void> {
    const content = renderNotificationEmail(input, this.webAppUrl);

    try {
      await sendSmtpMessage(this.transport, this.from, {
        to: input.recipientEmail,
        subject: content.subject,
        text: content.text,
        html: content.html,
        messageId: content.messageId
      });
      this.logger.info('notification email dispatched', { notificationId: input.notificationId });
    } catch (error) {
      const classified = smtpFailureCode(error);
      this.logger.warn('notification email failed', {
        notificationId: input.notificationId,
        errorName: error instanceof Error ? error.name : 'Error'
      });
      throw new NotificationDeliveryError(classified.code, classified.permanent, 'Pengiriman email notifikasi gagal.');
    }
  }
}
