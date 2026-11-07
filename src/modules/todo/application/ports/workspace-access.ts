/**
 * Port akses workspace yang dibutuhkan Todo module.
 *
 * Todo tidak mengimpor repository workspace secara langsung; composition root
 * yang mengadaptasi implementasi konkret. Dengan begini application layer Todo
 * tetap independen dan mudah diuji.
 */
export interface WorkspaceMembershipView {
  readonly role: string;
  readonly workspaceArchivedAt: Date | null;
}

export interface WorkspaceAccessPort {
  findMembership(workspaceId: string, userId: string): Promise<WorkspaceMembershipView | null>;
}
