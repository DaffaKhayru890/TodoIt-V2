import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AppLayout } from '@/components/layout/app-layout/app-layout';
import { LabelsPage } from '@/features/labels/pages/LabelsPage';
import { TagsPage } from '@/features/tags/pages/TagsPage';
import { TodayPage } from '@/features/todos/pages/TodayPage';
import { TodoDetailPage } from '@/features/todos/pages/TodoDetailPage';
import { UpcomingPage } from '@/features/todos/pages/UpcomingPage';
import { WorkspacePage } from '@/features/workspaces/pages/WorkspacePage';
import {
  AccessPlaceholder,
  CompletedPage,
  InboxPage,
  NewWorkspacePage,
  SearchPage,
  SettingsPage
} from '@/pages/placeholder-pages';
import { NotFoundPage } from '@/pages/not-found-page';

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <AccessPlaceholder
            title="Masuk"
            description="Alur masuk belum dibuat. Halaman ini hanya menandai rute login."
          />
        }
      />
      <Route
        path="/register"
        element={
          <AccessPlaceholder
            title="Daftar"
            description="Alur pendaftaran belum dibuat. Halaman ini hanya menandai rute register."
          />
        }
      />
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/inbox" replace />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="workspaces/new" element={<NewWorkspacePage />} />
        <Route path="workspace/:workspaceId">
          <Route index element={<WorkspacePage />} />
          <Route path="todos/:todoId" element={<TodoDetailPage />} />
          <Route path="today" element={<TodayPage />} />
          <Route path="upcoming" element={<UpcomingPage />} />
          <Route path="completed" element={<CompletedPage />} />
          <Route path="tags" element={<TagsPage />} />
          <Route path="labels" element={<LabelsPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
