import { useMemo, useState } from 'react';
import { FiPlus } from 'react-icons/fi';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button/button';
import { ApiError } from '@/core/errors/api-error';
import { useLabels } from '@/features/labels/hooks/use-labels';
import { useTags } from '@/features/tags/hooks/use-tags';
import { useCompleteTodo } from '../../hooks/use-complete-todo';
import { useReopenTodo } from '../../hooks/use-reopen-todo';
import { useWorkspaceTodos } from '../../hooks/use-workspace-todos';
import {
  EMPTY_TODO_FILTER,
  hasActiveTodoFilters,
  type TodoFilterState
} from '../../models/todo-filter';
import { isTodoCompleted, type Todo } from '../../models/todo.model';
import {
  applyClientTodoFilter,
  parseTodoFilter,
  parseTodoSort,
  serializeTodoFilter,
  serializeTodoSort,
  toTodoListQueryPlan
} from '../../utils/filter-url';
import { sortTodos } from '../../utils/sort-todos';
import { CreateTodoDialog } from '../create-todo-dialog/CreateTodoDialog';
import { DeleteTodoDialog } from '../delete-todo-dialog/DeleteTodoDialog';
import { EditTodoDialog } from '../edit-todo-dialog/EditTodoDialog';
import { TodoFilterPanel } from '../todo-filter-panel/TodoFilterPanel';
import { TodoList } from '../todo-list/TodoList';
import { TodoSortControl } from '../todo-sort-control/TodoSortControl';

export interface WorkspaceTodoSectionProps {
  readonly workspaceId: string;
  readonly workspaceName: string;
}

function getMutationErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * Menghubungkan workspace context dengan fitur Todo. Filter dan sorting
 * disimpan di URL agar dapat di-refresh, dibagikan, dan dipulihkan lewat
 * tombol back/forward browser.
 */
export function WorkspaceTodoSection({ workspaceId, workspaceName }: WorkspaceTodoSectionProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = parseTodoFilter(searchParams);
  const sort = parseTodoSort(searchParams);

  // Clock distabilkan per mount agar query key rentang tanggal tidak berubah
  // setiap render. Pergantian hari ditangani saat halaman dimuat ulang.
  const now = useMemo(() => new Date(), []);
  const plan = useMemo(() => toTodoListQueryPlan(filter, now), [filter, now]);

  const todosQuery = useWorkspaceTodos(workspaceId, plan.params);
  const tagsQuery = useTags(workspaceId);
  const labelsQuery = useLabels(workspaceId);
  const completeMutation = useCompleteTodo();
  const reopenMutation = useReopenTodo();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Todo | null>(null);
  const [deleting, setDeleting] = useState<Todo | null>(null);
  const [updatingTodoId, setUpdatingTodoId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clearFeedback = () => {
    setSuccessMessage(null);
    setErrorMessage(null);
  };

  const updateFilter = (next: TodoFilterState) => {
    setSearchParams(serializeTodoFilter(next, searchParams));
  };

  const clearFilters = () => {
    setSearchParams(serializeTodoFilter(EMPTY_TODO_FILTER, searchParams));
  };

  const handleToggleComplete = async (todo: Todo) => {
    if (updatingTodoId !== null) {
      return;
    }

    clearFeedback();
    setUpdatingTodoId(todo.id);

    try {
      if (isTodoCompleted(todo)) {
        await reopenMutation.mutateAsync({ workspaceId, todoId: todo.id });
        setSuccessMessage('Tugas berhasil dibuka kembali.');
      } else {
        await completeMutation.mutateAsync({ workspaceId, todoId: todo.id });
        setSuccessMessage('Tugas ditandai selesai.');
      }
    } catch (error) {
      setErrorMessage(
        getMutationErrorMessage(error, 'Gagal memperbarui status tugas. Silakan coba lagi.')
      );
    } finally {
      setUpdatingTodoId(null);
    }
  };

  const items = applyClientTodoFilter(todosQuery.data?.items ?? [], plan, now);
  // `undefined` menandakan data belum pernah dimuat, sehingga TodoList masih
  // menampilkan skeleton/error. Array kosong berarti data sudah ada tetapi
  // tidak ada tugas yang cocok.
  const visibleTodos = todosQuery.data ? sortTodos(items, sort) : undefined;
  const filtered = hasActiveTodoFilters(filter);

  return (
    <section className="todo-workspace" aria-label="Daftar tugas workspace">
      <header className="todo-workspace__header">
        <div className="todo-workspace__heading-group">
          <h2 className="todo-workspace__title">Tugas</h2>
          <p className="todo-workspace__description">
            Kelola pekerjaan di workspace ini. Tugas aktif dan selesai dipisahkan otomatis.
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          leadingIcon={<FiPlus aria-hidden="true" />}
          onClick={() => {
            clearFeedback();
            setCreateOpen(true);
          }}
        >
          Buat Tugas
        </Button>
      </header>

      <div className="todo-workspace__tools">
        <TodoFilterPanel
          filter={filter}
          onChange={updateFilter}
          tags={tagsQuery.data?.items ?? []}
          labels={labelsQuery.data?.items ?? []}
          isLoadingTags={tagsQuery.isLoading}
          isLoadingLabels={labelsQuery.isLoading}
        />
        <TodoSortControl
          sort={sort}
          onChange={(next) => setSearchParams(serializeTodoSort(next, searchParams))}
        />
      </div>

      {successMessage ? (
        <div className="todo-workspace__feedback todo-workspace__feedback--success" role="status">
          <span>{successMessage}</span>
          <button
            type="button"
            className="todo-workspace__feedback-close"
            aria-label="Tutup notifikasi"
            onClick={() => setSuccessMessage(null)}
          >
            Tutup
          </button>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="todo-workspace__feedback todo-workspace__feedback--error" role="alert">
          <span>{errorMessage}</span>
          <button
            type="button"
            className="todo-workspace__feedback-close"
            aria-label="Tutup pesan kesalahan"
            onClick={() => setErrorMessage(null)}
          >
            Tutup
          </button>
        </div>
      ) : null}

      <TodoList
        workspaceId={workspaceId}
        todos={visibleTodos}
        isLoading={todosQuery.isLoading}
        isError={todosQuery.isError}
        error={todosQuery.error}
        hasMore={todosQuery.data?.pagination.hasMore ?? false}
        updatingTodoId={updatingTodoId}
        now={now}
        isFiltered={filtered}
        onClearFilters={clearFilters}
        onRetry={() => {
          void todosQuery.refetch();
        }}
        onCreate={() => {
          clearFeedback();
          setCreateOpen(true);
        }}
        onEdit={(todo) => {
          clearFeedback();
          setEditing(todo);
        }}
        onDelete={(todo) => {
          clearFeedback();
          setDeleting(todo);
        }}
        onToggleComplete={(todo) => {
          void handleToggleComplete(todo);
        }}
      />

      <CreateTodoDialog
        open={createOpen}
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        onClose={() => setCreateOpen(false)}
        onSuccess={(_todo, warning) => {
          if (warning) {
            setErrorMessage(warning);
            return;
          }

          setSuccessMessage('Tugas berhasil dibuat.');
        }}
      />

      {editing ? (
        <EditTodoDialog
          open
          todo={editing}
          onClose={() => setEditing(null)}
          onSuccess={(_todo, warning) => {
            if (warning) {
              setErrorMessage(warning);
              return;
            }

            setSuccessMessage('Perubahan tugas berhasil disimpan.');
          }}
        />
      ) : null}

      {deleting ? (
        <DeleteTodoDialog
          open
          todo={deleting}
          onClose={() => setDeleting(null)}
          onSuccess={() => {
            setSuccessMessage('Tugas berhasil dihapus.');
          }}
        />
      ) : null}
    </section>
  );
}
