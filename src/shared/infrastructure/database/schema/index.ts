import { authSessions, refreshTokens, users } from '../../../../modules/auth/infrastructure/persistence/auth.schema';
import { workspaceInvitations } from '../../../../modules/workspace/infrastructure/persistence/invitation.schema';
import {
  workspaceMembers,
  workspaces
} from '../../../../modules/workspace/infrastructure/persistence/workspace.schema';
import { labels } from '../../../../modules/todo/infrastructure/persistence/label.schema';
import { reminders } from '../../../../modules/todo/infrastructure/persistence/reminder.schema';
import { notificationJobs } from '../../../../modules/notification/infrastructure/persistence/notification-job.schema';
import { notificationPreferences } from '../../../../modules/notification/infrastructure/persistence/notification-preference.schema';
import { notifications } from '../../../../modules/notification/infrastructure/persistence/notification.schema';
import { tags } from '../../../../modules/todo/infrastructure/persistence/tag.schema';
import { todoTags } from '../../../../modules/todo/infrastructure/persistence/todo-tag.schema';
import { todos } from '../../../../modules/todo/infrastructure/persistence/todo.schema';

/**
 * Entry point skema Drizzle: satu titik baca untuk drizzle-kit supaya setiap
 * module mendefinisikan tabelnya sendiri di infrastructure layer namun
 * migration tetap dihasilkan dari gambaran database yang utuh.
 */
export const schema = {
  users,
  authSessions,
  refreshTokens,
  workspaces,
  workspaceMembers,
  workspaceInvitations,
  todos,
  tags,
  labels,
  todoTags,
  reminders,
  notifications,
  notificationJobs,
  notificationPreferences
};

export {
  users,
  authSessions,
  refreshTokens,
  workspaces,
  workspaceMembers,
  workspaceInvitations,
  todos,
  tags,
  labels,
  todoTags,
  reminders,
  notifications,
  notificationJobs,
  notificationPreferences
};

export default schema;
