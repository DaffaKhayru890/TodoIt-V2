import { describe, expect, test, vi } from 'vitest';
import { readSidebarPreference, writeSidebarPreference } from '@/app/shell/sidebar-preference';

describe('sidebar preference', () => {
  test('mengabaikan nilai storage yang tidak valid', () => {
    localStorage.setItem('todoit.sidebar', '{');
    expect(readSidebarPreference()).toEqual({ primaryCollapsed: true, secondaryCollapsed: false });

    localStorage.setItem('todoit.sidebar', JSON.stringify({ primaryCollapsed: 'ya' }));
    expect(readSidebarPreference().primaryCollapsed).toBe(true);
  });

  test('menyimpan boolean yang valid dan bertahan bila storage gagal', () => {
    writeSidebarPreference({ primaryCollapsed: true, secondaryCollapsed: false });
    expect(readSidebarPreference()).toEqual({ primaryCollapsed: true, secondaryCollapsed: false });

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() =>
      writeSidebarPreference({ primaryCollapsed: false, secondaryCollapsed: true })
    ).not.toThrow();
  });
});
