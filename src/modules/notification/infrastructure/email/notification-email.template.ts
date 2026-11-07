import type { NotificationEmailMessage } from '../../application/ports/notification-email.sender';
import { notificationMessageId } from '../../domain/services/idempotency';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function renderNotificationEmail(input: NotificationEmailMessage, webAppUrl: string) {
  const base = webAppUrl.endsWith('/') ? webAppUrl.slice(0, -1) : webAppUrl;
  const link = input.todoId ? `${base}/workspaces/${input.workspaceId}/todos/${input.todoId}` : `${base}/notifications`;
  const subject = input.title;
  const text = [input.body, '', `Buka: ${link}`].join('\n');
  const html = `<p>${escapeHtml(input.body)}</p><p><a href="${escapeHtml(link)}">Buka di aplikasi</a></p>`;

  return { subject, text, html, messageId: notificationMessageId(input.notificationId) };
}
