import { Link, useNavigate } from 'react-router';
import { paths } from '@/app/router/route-paths';
import { EmptyState } from '@/components/feedback/empty-state/empty-state';
import { CreateWorkspaceDialog } from '@/features/workspaces/components/create-workspace-dialog/CreateWorkspaceDialog';
import { PageHeader } from '@/pages/page-header';
import { useDocumentTitle } from '@/hooks/use-document-title';

const pending = 'Fitur ini belum dibuat. Halaman ini hanya menandai rute dan layout.';

export function InboxPage() {
  return <PageHeader title="Inbox" description={`Kotak masuk lintas workspace. ${pending}`} />;
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

export function NewWorkspacePage() {
  const navigate = useNavigate();
  useDocumentTitle('Tambah workspace');

  return (
    <div className="workspace-page">
      <CreateWorkspaceDialog
        open
        onClose={() => navigate(paths.inbox, { replace: true })}
        onSuccess={(workspace) => navigate(paths.workspace(workspace.id))}
      />
    </div>
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
