const STORAGE_KEY = 'todoit.sidebar';

export interface SidebarPreference {
  primaryCollapsed: boolean;
  secondaryCollapsed: boolean;
}

const fallback: SidebarPreference = {
  primaryCollapsed: false,
  secondaryCollapsed: false
};

function isPreference(value: unknown): value is SidebarPreference {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.primaryCollapsed === 'boolean' && typeof record.secondaryCollapsed === 'boolean'
  );
}

export function readSidebarPreference(): SidebarPreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed: unknown = JSON.parse(raw);
    return isPreference(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function writeSidebarPreference(value: SidebarPreference) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Preferensi sidebar tidak wajib. Mode privat dapat menolak storage.
  }
}
