import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge/badge';
import { useDocumentTitle } from '@/hooks/use-document-title';

export function PageHeader({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  useDocumentTitle(title);

  return (
    <header className="page-header">
      <h1 className="page-header__title">{title}</h1>
      <p className="page-header__description">{description}</p>
      <Badge variant="neutral">Phase berikutnya</Badge>
      {children}
    </header>
  );
}
