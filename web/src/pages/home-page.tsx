import { FiCheckCircle } from 'react-icons/fi';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button/button';

export function HomePage() {
  return (
    <main className="home-page">
      <p className="home-page__mark">
        <FiCheckCircle aria-hidden="true" />
        <span>TodoIt</span>
      </p>
      <h1 className="home-page__title">Fondasi frontend siap.</h1>
      <p className="home-page__text">Fitur workspace dan todo belum dibangun pada phase ini.</p>
      <Button type="button">Tombol contoh</Button>
      <p>
        <Link className="home-page__link" to="/rute-tidak-ada">
          Buka rute yang tidak dikenal
        </Link>
      </p>
    </main>
  );
}
