import { SearchContent } from '../components/search-content/SearchContent';
import { useDocumentTitle } from '@/hooks/use-document-title';

export function SearchPage() {
  useDocumentTitle('Cari');

  return (
    <div className="search-page">
      <header className="search-page__header">
        <h1 className="search-page__title">Cari</h1>
        <p className="search-page__description">
          Cari tugas, tag, dan label di seluruh workspace yang dapat Anda akses. Tekan Ctrl+K atau
          Cmd+K dari halaman mana pun untuk membuka pencarian cepat.
        </p>
      </header>
      <section className="search-page__panel" aria-label="Pencarian global">
        <SearchContent focusOnMount />
      </section>
    </div>
  );
}
