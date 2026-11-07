import { NotificationError } from '../errors/notification-error';
import { isNotificationType, type NotificationType } from '../enums/notification-type';

export interface NotificationData {
  readonly todoId?: string;
  readonly workspaceId?: string;
  readonly reminderId?: string;
  readonly dueAt?: string;
  readonly offsetMinutes?: number;
  readonly effectiveAt?: string;
}

export interface NotificationSnapshot {
  readonly id: string;
  readonly recipientUserId: string;
  readonly workspaceId: string;
  readonly todoId: string | null;
  readonly reminderId: string | null;
  readonly type: NotificationType;
  readonly title: string;
  readonly body: string;
  readonly data: NotificationData;
  readonly idempotencyKey: string;
  readonly readAt: Date | null;
  readonly createdAt: Date;
}

export class Notification {
  private constructor(private readonly snapshot: NotificationSnapshot) {}

  static create(input: {
    id: string;
    recipientUserId: string;
    workspaceId: string;
    todoId: string | null;
    reminderId: string | null;
    type: string;
    title: string;
    body: string;
    data: NotificationData;
    idempotencyKey: string;
    now: Date;
  }): Notification {
    if (input.recipientUserId.trim().length === 0) {
      throw NotificationError.validation('Penerima notifikasi wajib diisi.');
    }

    if (!isNotificationType(input.type)) {
      throw NotificationError.validation('Jenis notifikasi tidak valid.');
    }

    if (input.idempotencyKey.trim().length === 0) {
      throw NotificationError.validation('Kunci idempotensi notifikasi wajib diisi.');
    }

    if (input.title.trim().length === 0 || input.title.length > 200) {
      throw NotificationError.validation('Judul notifikasi wajib diisi (maksimal 200 karakter).');
    }

    return new Notification({
      id: input.id,
      recipientUserId: input.recipientUserId,
      workspaceId: input.workspaceId,
      todoId: input.todoId,
      reminderId: input.reminderId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data,
      idempotencyKey: input.idempotencyKey,
      readAt: null,
      createdAt: new Date(input.now.getTime())
    });
  }

  static restore(snapshot: NotificationSnapshot): Notification {
    return new Notification({
      ...snapshot,
      readAt: snapshot.readAt ? new Date(snapshot.readAt.getTime()) : null,
      createdAt: new Date(snapshot.createdAt.getTime())
    });
  }

  get id(): string {
    return this.snapshot.id;
  }

  get recipientUserId(): string {
    return this.snapshot.recipientUserId;
  }

  get workspaceId(): string {
    return this.snapshot.workspaceId;
  }

  get todoId(): string | null {
    return this.snapshot.todoId;
  }

  get reminderId(): string | null {
    return this.snapshot.reminderId;
  }

  get type(): NotificationType {
    return this.snapshot.type;
  }

  get title(): string {
    return this.snapshot.title;
  }

  get body(): string {
    return this.snapshot.body;
  }

  get data(): NotificationData {
    return this.snapshot.data;
  }

  get idempotencyKey(): string {
    return this.snapshot.idempotencyKey;
  }

  get readAt(): Date | null {
    return this.snapshot.readAt ? new Date(this.snapshot.readAt.getTime()) : null;
  }

  get createdAt(): Date {
    return new Date(this.snapshot.createdAt.getTime());
  }

  /** Pembacaan ulang mempertahankan readAt pertama. */
  markRead(now: Date): Notification {
    if (this.snapshot.readAt) {
      return this;
    }

    return new Notification({ ...this.snapshot, readAt: new Date(now.getTime()) });
  }
}
