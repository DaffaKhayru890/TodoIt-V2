export class NotificationDeliveryError extends Error {
  constructor(
    readonly code: string,
    readonly permanent: boolean,
    message: string
  ) {
    super(message);
    this.name = 'NotificationDeliveryError';
  }
}

export interface NotificationEmailMessage {
  readonly recipientEmail: string;
  readonly recipientName: string;
  readonly title: string;
  readonly body: string;
  readonly todoId: string | null;
  readonly workspaceId: string;
  readonly notificationId: string;
}

export interface NotificationEmailSender {
  send(input: NotificationEmailMessage): Promise<void>;
}
