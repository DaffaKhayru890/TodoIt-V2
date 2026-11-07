import { authSessions, refreshTokens, users } from '../../../../modules/auth/infrastructure/persistence/auth.schema';
import {
  workspaceMembers,
  workspaces
} from '../../../../modules/workspace/infrastructure/persistence/workspace.schema';

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
  workspaceMembers
};

export { users, authSessions, refreshTokens, workspaces, workspaceMembers };

export default schema;
