/**
 * Aksi yang dapat diotorisasi di dalam Todo bounded context.
 *
 * Phase 3 menyamakan hak OWNER, ADMIN, dan MEMBER untuk operasi Todo. Phase 4
 * menambahkan MANAGE_METADATA yang hanya boleh dilakukan OWNER/ADMIN untuk
 * pengelolaan Tag dan Label. Assignment Tag/Label serta seluruh operasi
 * Reminder tetap memakai aksi Todo yang sudah ada sehingga berlaku untuk semua
 * member.
 */
export const TodoAction = {
  VIEW: 'view',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  COMPLETE: 'complete',
  MANAGE_METADATA: 'manage_metadata'
} as const;

export type TodoAction = (typeof TodoAction)[keyof typeof TodoAction];

const MEMBER_ROLES = new Set(['owner', 'admin', 'member']);
const METADATA_MANAGER_ROLES = new Set(['owner', 'admin']);

export class TodoAccessPolicy {
  /**
   * Policy murni: tidak mengenal Elysia, database, maupun user id. Pemanggil
   * sudah memastikan role berasal dari membership workspace.
   */
  static canPerform(role: string | null | undefined, action: TodoAction): boolean {
    if (!role || !MEMBER_ROLES.has(role)) {
      return false;
    }

    switch (action) {
      case TodoAction.VIEW:
      case TodoAction.CREATE:
      case TodoAction.UPDATE:
      case TodoAction.DELETE:
      case TodoAction.COMPLETE:
        return true;

      case TodoAction.MANAGE_METADATA:
        return METADATA_MANAGER_ROLES.has(role);

      default:
        return false;
    }
  }
}
