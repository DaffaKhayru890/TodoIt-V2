import { authSessions, refreshTokens, users } from '../../../../modules/auth/infrastructure/persistence/auth.schema';
import {
  workspaceMembers,
  workspaces
} from '../../../../modules/workspace/infrastructure/persistence/workspace.schema';
import { labels } from '../../../../modules/todo/infrastructure/persistence/label.schema';
import { reminders } from '../../../../modules/todo/infrastructure/persistence/reminder.schema';
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
  todos,
  tags,
  labels,
  todoTags,
  reminders
};

export {
  users,
  authSessions,
  refreshTokens,
  workspaces,
  workspaceMembers,
  todos,
  tags,
  labels,
  todoTags,
  reminders
};

export default schema;
