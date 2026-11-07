import { Link } from 'react-router';
import { useDocumentTitle } from '@/hooks/use-document-title';

export function NotFoundPage() {
  useDocumentTitle('Halaman tidak ditemukan');

  return (
    <div className="not-found-page">
      <h1 className="not-found-page__title">Halaman tidak ditemukan</h1>
      <p>Alamat ini tidak ada di aplikasi.</p>
      <Link className="not-found-page__link" to="/inbox">
        Kembali ke inbox
      </Link>
    </div>
  );
}
