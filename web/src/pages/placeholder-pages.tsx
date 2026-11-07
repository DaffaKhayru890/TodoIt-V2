import { Link } from 'react-router';
import { EmptyState } from '@/components/feedback/empty-state/empty-state';
import { PageHeader } from '@/pages/page-header';
import { useDocumentTitle } from '@/hooks/use-document-title';

const pending = 'Fitur ini belum dibuat. Halaman ini hanya menandai rute dan layout.';

export function InboxPage() {
  return <PageHeader title="Inbox" description={`Kotak masuk lintas workspace. ${pending}`} />;
}

export function SearchPage() {
  return (
    <PageHeader
      title="Cari"
      description={`Pencarian todo akan tersedia pada phase berikutnya. ${pending}`}
    />
  );
}

export function TodayPage() {
  return <PageHeader title="Today" description={`Daftar tugas hari ini. ${pending}`} />;
}

export function UpcomingPage() {
  return <PageHeader title="Upcoming" description={`Tugas yang akan datang. ${pending}`} />;
}

export function AllTasksPage() {
  return (
    <PageHeader title="All Tasks" description={`Seluruh tugas workspace contoh. ${pending}`}>
      <EmptyState
        title="Belum ada tugas"
        description="Daftar tugas akan diisi setelah integrasi todo. Ilustrasi ini siap dipakai ulang."
      />
    </PageHeader>
  );
}

export function CompletedPage() {
  return <PageHeader title="Completed" description={`Tugas yang sudah selesai. ${pending}`} />;
}

export function TagsPage() {
  return <PageHeader title="Tags" description={`Pengelolaan tag. ${pending}`} />;
}

export function LabelsPage() {
  return <PageHeader title="Labels" description={`Pengelolaan label. ${pending}`} />;
}

export function SettingsPage() {
  return <PageHeader title="Settings" description={`Preferensi aplikasi. ${pending}`} />;
}

export function NewWorkspacePage() {
  return (
    <PageHeader
      title="Tambah workspace"
      description="Tombol ini adalah pintu masuk. Pembuatan workspace akan diimplementasikan pada phase berikutnya, tanpa menyimpan data sekarang."
    />
  );
}

export function AccessPlaceholder({ title, description }: { title: string; description: string }) {
  useDocumentTitle(title);

  return (
    <main className="access-page">
      <h1>{title}</h1>
      <p>{description}</p>
      <Link to="/inbox">Kembali ke aplikasi</Link>
    </main>
  );
}
