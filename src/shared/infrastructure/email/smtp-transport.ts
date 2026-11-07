import nodemailer, { type Transporter } from 'nodemailer';
import type { SmtpConfig } from '../../../config/app-config';
import type { Logger } from '../logging/logger';

export interface SmtpOutboundMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
  readonly messageId?: string;
}

export function createSmtpTransport(config: SmtpConfig): Transporter {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    connectionTimeout: config.connectionTimeoutMs,
    socketTimeout: config.connectionTimeoutMs,
    greetingTimeout: config.connectionTimeoutMs,
    ...(config.user.length > 0 ? { auth: { user: config.user, pass: config.password } } : {})
  });
}

export async function sendSmtpMessage(
  transport: Transporter,
  from: string,
  message: SmtpOutboundMessage
): Promise<void> {
  await transport.sendMail({
    from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
    ...(message.messageId ? { messageId: message.messageId } : {})
  });
}

export function smtpFailureCode(error: unknown): { code: string; permanent: boolean } {
  const responseCode =
    typeof error === 'object' && error !== null && 'responseCode' in error
      ? Number((error as { responseCode?: number }).responseCode)
      : 0;
  const permanent = responseCode >= 500 && responseCode < 600;

  return { code: permanent ? 'SMTP_PERMANENT' : 'SMTP_TEMPORARY', permanent };
}

export function logEmailOutcome(logger: Logger, outcome: 'sent' | 'failed', fields: { notificationId?: string; role?: string }): void {
  if (outcome === 'sent') {
    logger.info('email dispatched', fields);
    return;
  }

  logger.warn('email failed', fields);
}
