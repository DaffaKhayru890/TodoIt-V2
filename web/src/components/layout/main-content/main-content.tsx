import { Outlet } from 'react-router';

export function MainContent() {
  return (
    <main id="main-content" className="main-content scroll-area">
      <Outlet />
    </main>
  );
}
