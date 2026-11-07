import type { InvitationEmailMessage } from '../../application/ports/invitation-email.sender';

export interface InvitationEmailContent {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function renderInvitationEmail(input: InvitationEmailMessage): InvitationEmailContent {
  const expires = input.expiresAt.toISOString();
  const subject = 'You have been invited to a Todo Workspace';
  const text = [
    `${input.inviterName} mengundang Anda ke workspace "${input.workspaceName}".`,
    `Role: ${input.role}.`,
    `Undangan kedaluwarsa pada ${expires}.`,
    'Buka tautan berikut, masuk ke akun dengan email yang diundang, lalu kirim token dari fragment URL melalui POST.',
    input.invitationUrl
  ].join('\n');
  const html = `<p>${escapeHtml(input.inviterName)} mengundang Anda ke workspace <strong>${escapeHtml(input.workspaceName)}</strong>.</p>
<p>Role: ${escapeHtml(input.role)}.</p>
<p>Undangan kedaluwarsa pada ${escapeHtml(expires)}.</p>
<p><a href="${escapeHtml(input.invitationUrl)}">Buka undangan</a></p>
<p>Frontend harus membaca token dari fragment URL, menghapusnya dari history, dan mengirimnya di body POST. Jangan menyimpan token di localStorage.</p>`;

  return { subject, text, html };
}
