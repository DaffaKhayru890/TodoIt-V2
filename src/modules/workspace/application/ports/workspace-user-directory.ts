export interface WorkspaceUserProfile {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
}

/** Lookup identitas tanpa membawa password atau session ke use case workspace. */
export interface WorkspaceUserDirectory {
  findByNormalizedEmail(normalizedEmail: string): Promise<WorkspaceUserProfile | null>;
  findByIds(userIds: readonly string[]): Promise<readonly WorkspaceUserProfile[]>;
}
