export interface WorkspaceFixture {
  id: string;
  name: string;
  mark: string;
}

export const userFixture = {
  displayName: 'Pengguna contoh'
} as const;

export const workspaceFixtures: readonly WorkspaceFixture[] = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Personal', mark: 'P' },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Kerja tim dengan nama yang sangat panjang',
    mark: 'K'
  },
  { id: '33333333-3333-4333-8333-333333333333', name: 'Belajar', mark: 'B' },
  { id: '44444444-4444-4444-8444-444444444444', name: 'Rumah', mark: 'R' },
  { id: '55555555-5555-4555-8555-555555555555', name: 'Arsip visual', mark: 'A' },
  { id: '66666666-6666-4666-8666-666666666666', name: 'Catatan', mark: 'C' },
  { id: '77777777-7777-4777-8777-777777777777', name: 'Proyek sampingan', mark: 'S' },
  { id: '88888888-8888-4888-8888-888888888888', name: 'Bacaan', mark: 'D' }
];
