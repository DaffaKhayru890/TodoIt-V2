export interface NewAuditEvent {
  readonly actorUserId: string | null;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string | null;
  readonly workspaceId: string | null;
  readonly requestId: string | null;
  readonly outcome: 'success' | 'failure';
  readonly metadata: Readonly<Record<string, string | number | boolean>>;
  readonly occurredAt: Date;
}

export interface AuditRecorder {
  record(event: NewAuditEvent): Promise<void>;
}

export async function safeRecord(recorder: AuditRecorder, event: NewAuditEvent): Promise<void> {
  try {
    await recorder.record(event);
  } catch {
    return undefined;
  }
}

export const noopAuditRecorder: AuditRecorder = {
  async record(): Promise<void> {
    return undefined;
  }
};
