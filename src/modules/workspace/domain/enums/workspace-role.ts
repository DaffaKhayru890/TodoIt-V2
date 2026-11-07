/**
 * Role keanggotaan workspace. ADMIN dan MEMBER sudah dideklarasikan karena
 * matriks permission dan skema database dipakai sejak sekarang, tetapi endpoint
 * untuk menambah/mengubah member baru ada pada Phase 5.
 */
export const WorkspaceRole = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member'
} as const;

export type WorkspaceRole = (typeof WorkspaceRole)[keyof typeof WorkspaceRole];

export const WORKSPACE_ROLES: readonly WorkspaceRole[] = [
  WorkspaceRole.OWNER,
  WorkspaceRole.ADMIN,
  WorkspaceRole.MEMBER
];

export function isWorkspaceRole(value: string): value is WorkspaceRole {
  return (WORKSPACE_ROLES as readonly string[]).includes(value);
}
