export const EmailDeliveryStatus = {
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed'
} as const;

export type EmailDeliveryStatus = (typeof EmailDeliveryStatus)[keyof typeof EmailDeliveryStatus];

export const EMAIL_DELIVERY_STATUSES: readonly EmailDeliveryStatus[] = [
  EmailDeliveryStatus.PENDING,
  EmailDeliveryStatus.SENT,
  EmailDeliveryStatus.FAILED
];

export function isEmailDeliveryStatus(value: string): value is EmailDeliveryStatus {
  return (EMAIL_DELIVERY_STATUSES as readonly string[]).includes(value);
}
