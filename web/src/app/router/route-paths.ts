/**
 * Path yang dicadangkan untuk phase berikutnya.
 * Hanya `/` dan rute tidak dikenal yang dipasang pada router phase ini.
 */
export const reservedPaths = {
  login: '/login',
  register: '/register',
  workspace: '/workspace/:workspaceId'
} as const;
