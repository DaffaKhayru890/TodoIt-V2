import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <main className="not-found-page">
      <h1 className="not-found-page__title">Halaman tidak ditemukan</h1>
      <p>
        <Link className="not-found-page__link" to="/">
          Kembali ke beranda
        </Link>
      </p>
    </main>
  );
}
