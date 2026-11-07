import { TodoError } from '../../domain/errors/todo-error';
import { TodoAccessPolicy, type TodoAction } from '../policies/todo-access.policy';
import type { WorkspaceAccessPort } from '../ports/workspace-access';

/**
 * Application service yang menegakkan otorisasi berbasis membership workspace.
 * Semua use case Todo memanggil service ini sebelum menyentuh repository.
 */
export class TodoAccessService {
  constructor(private readonly workspaceAccess: WorkspaceAccessPort) {}

  async assertAccess(workspaceId: string, userId: string, action: TodoAction): Promise<void> {
    const membership = await this.workspaceAccess.findMembership(workspaceId, userId);

    // Workspace tidak ada, user bukan member, atau workspace sudah diarsipkan
    // menghasilkan pesan yang sama untuk mencegah enumerasi.
    if (!membership || membership.workspaceArchivedAt !== null) {
      throw TodoError.workspaceAccessDenied();
    }

    if (!TodoAccessPolicy.canPerform(membership.role, action)) {
      // Member yang sah tetapi role-nya tidak berwenang mendapat 403; ini tidak
      // membocorkan keberadaan workspace kepada non-member karena non-member
      // sudah ditolak sebagai 404 di atas.
      throw TodoError.permissionDenied();
    }
  }
}
