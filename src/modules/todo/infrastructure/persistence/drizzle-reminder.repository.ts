import {
  and,
  asc,
  eq,
  inArray,
  sql,
  type SQL
} from 'drizzle-orm';
import type { DatabaseExecutor } from '../../../../shared/infrastructure/database/client';
import { isUniqueViolation } from '../../../../shared/infrastructure/database/errors';
import type { Reminder } from '../../domain/entities/reminder';
import { ReminderStatus } from '../../domain/enums/reminder-status';
import { TodoError } from '../../domain/errors/todo-error';
import type {
  CancelReminderOutcome,
  ReminderListQuery,
  ReminderListResult,
  ReminderRepository
} from '../../domain/repositories/reminder.repository';
import { toReminderEntity } from '../mappers/reminder.mapper';
import { reminders } from './reminder.schema';

export class DrizzleReminderRepository implements ReminderRepository {
  constructor(private readonly database: DatabaseExecutor) {}

  async create(reminder: Reminder): Promise<Reminder> {
    const snapshot = reminder.toSnapshot();

    const rows = await this.database
      .insert(reminders)
      .values({
        id: snapshot.id,
        todoId: snapshot.todoId,
        createdBy: snapshot.createdBy,
        triggerType: snapshot.triggerType,
        remindAt: snapshot.remindAt,
        offsetMinutes: snapshot.offsetMinutes,
        status: snapshot.status,
        createdAt: snapshot.createdAt,
        updatedAt: snapshot.updatedAt,
        cancelledAt: snapshot.cancelledAt
      })
      // Partial unique index mencegah jadwal scheduled duplikat. Bila konflik,
      // tidak ada baris yang kembali dan application memetakannya ke 409.
      .onConflictDoNothing()
      .returning();

    const row = rows[0];

    if (!row) {
      throw TodoError.reminderDuplicate();
    }

    return toReminderEntity(row);
  }

  async findById(todoId: string, reminderId: string): Promise<Reminder | null> {
    const rows = await this.database
      .select()
      .from(reminders)
      .where(and(eq(reminders.todoId, todoId), eq(reminders.id, reminderId)))
      .limit(1);

    const row = rows[0];

    return row ? toReminderEntity(row) : null;
  }

  async update(reminder: Reminder): Promise<Reminder | null> {
    const snapshot = reminder.toSnapshot();

    try {
      const rows = await this.database
        .update(reminders)
        .set({
          remindAt: snapshot.remindAt,
          offsetMinutes: snapshot.offsetMinutes,
          updatedAt: snapshot.updatedAt
        })
        .where(
          and(
            eq(reminders.todoId, snapshot.todoId),
            eq(reminders.id, snapshot.id),
            eq(reminders.status, ReminderStatus.SCHEDULED)
          )
        )
        .returning();

      const row = rows[0];

      return row ? toReminderEntity(row) : null;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw TodoError.reminderDuplicate();
      }

      throw error;
    }
  }

  async list(query: ReminderListQuery): Promise<ReminderListResult> {
    // effectiveAt = remind_at untuk absolute, atau due_at - offset untuk
    // before_due. Nilai ini hanya ekspresi query, bukan kolom tersimpan.
    const effectiveAtExpression = sql<
      Date | null
    >`COALESCE(${reminders.remindAt}, ${query.dueAt}::timestamptz - (${reminders.offsetMinutes} * interval '1 minute'))`;

    const conditions: SQL[] = [eq(reminders.todoId, query.todoId)];

    if (query.statuses !== undefined && query.statuses.length > 0) {
      conditions.push(inArray(reminders.status, [...query.statuses]));
    }

    if (query.cursor !== null) {
      if (query.cursor.effectiveAt === null) {
        // Halaman sebelumnya berakhir di kelompok effectiveAt NULL (NULLS LAST),
        // jadi lanjutkan hanya sesama NULL berdasarkan id.
        conditions.push(
          sql`${effectiveAtExpression} IS NULL AND ${reminders.id} > ${query.cursor.id}`
        );
      } else {
        conditions.push(
          sql`(
            ${effectiveAtExpression} IS NULL
            OR ${effectiveAtExpression} > ${query.cursor.effectiveAt}
            OR (${effectiveAtExpression} = ${query.cursor.effectiveAt} AND ${reminders.id} > ${query.cursor.id})
          )`
        );
      }
    }

    const rows = await this.database
      .select()
      .from(reminders)
      .where(and(...conditions))
      .orderBy(sql`${effectiveAtExpression} ASC NULLS LAST`, asc(reminders.id))
      .limit(query.limit + 1);

    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;

    return { items: pageRows.map(toReminderEntity), hasMore };
  }

  async cancel(
    todoId: string,
    reminderId: string,
    now: Date
  ): Promise<CancelReminderOutcome> {
    const rows = await this.database
      .update(reminders)
      .set({
        status: ReminderStatus.CANCELLED,
        cancelledAt: now,
        updatedAt: now
      })
      .where(
        and(
          eq(reminders.todoId, todoId),
          eq(reminders.id, reminderId),
          eq(reminders.status, ReminderStatus.SCHEDULED)
        )
      )
      .returning({ id: reminders.id });

    if (rows.length > 0) {
      return 'cancelled';
    }

    const existing = await this.findById(todoId, reminderId);

    return existing ? 'already_cancelled' : 'not_found';
  }

  async findScheduledByTodoId(todoId: string): Promise<readonly Reminder[]> {
    const rows = await this.database
      .select()
      .from(reminders)
      .where(
        and(
          eq(reminders.todoId, todoId),
          eq(reminders.status, ReminderStatus.SCHEDULED)
        )
      )
      .orderBy(asc(reminders.id));

    return rows.map(toReminderEntity);
  }

  async cancelScheduledByTodoId(todoId: string, now: Date): Promise<number> {
    const rows = await this.database
      .update(reminders)
      .set({
        status: ReminderStatus.CANCELLED,
        cancelledAt: now,
        updatedAt: now
      })
      .where(
        and(
          eq(reminders.todoId, todoId),
          eq(reminders.status, ReminderStatus.SCHEDULED)
        )
      )
      .returning({ id: reminders.id });

    return rows.length;
  }
}
