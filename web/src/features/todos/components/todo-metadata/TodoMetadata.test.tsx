import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { makeTodoDto } from '@/test/fixtures/todos';
import { toTodo } from '../../models/todo.mapper';
import type { Todo } from '../../models/todo.model';
import { TodoMetadata } from './TodoMetadata';

const now = new Date(2026, 10, 9, 12, 0, 0, 0);

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return { ...toTodo(makeTodoDto()), ...overrides };
}

describe('TodoMetadata', () => {
  test('tidak merender metadata kosong selain prioritas', () => {
    render(<TodoMetadata todo={makeTodo({ priority: 'low' })} now={now} />);

    expect(screen.getByText('Rendah')).toBeInTheDocument();
    expect(screen.queryByLabelText('Label tugas')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Tag tugas')).not.toBeInTheDocument();
    expect(screen.queryByText(/Tenggat:/)).not.toBeInTheDocument();
  });

  test('merender label, tag, prioritas, dan tenggat hari ini', () => {
    render(
      <TodoMetadata
        todo={makeTodo({
          priority: 'high',
          label: { id: 'label-1', name: 'Bug', color: '#E74C3C' },
          tags: [
            { id: 'tag-1', name: 'backend' },
            { id: 'tag-2', name: 'urgent' }
          ],
          dueAt: new Date(2026, 10, 9, 15, 30)
        })}
        now={now}
      />
    );

    expect(screen.getByText('Bug')).toBeInTheDocument();
    expect(screen.getByText('backend')).toBeInTheDocument();
    expect(screen.getByText('urgent')).toBeInTheDocument();
    expect(screen.getByText('Tinggi')).toBeInTheDocument();
    expect(screen.getByText('Tenggat: Hari ini')).toBeInTheDocument();
    expect(screen.getByText(/15\.30/)).toBeInTheDocument();
  });

  test('menampilkan status terlambat untuk tenggat sebelum hari ini', () => {
    render(
      <TodoMetadata
        todo={makeTodo({ dueAt: new Date(2026, 10, 8, 9, 0), status: 'todo' })}
        now={now}
      />
    );

    expect(screen.getByText(/Terlambat/)).toBeInTheDocument();
  });

  test('tugas selesai tidak ditandai terlambat meskipun tenggat sudah lewat', () => {
    render(
      <TodoMetadata
        todo={makeTodo({ dueAt: new Date(2026, 10, 8, 9, 0), status: 'completed' })}
        now={now}
      />
    );

    expect(screen.queryByText(/Terlambat/)).not.toBeInTheDocument();
    expect(screen.getByText(/Tenggat:/)).toBeInTheDocument();
  });

  test('menggabungkan className tambahan', () => {
    const { container } = render(<TodoMetadata todo={makeTodo()} now={now} className="extra" />);
    expect(container.firstChild).toHaveClass('todo-metadata', 'extra');
  });
});
