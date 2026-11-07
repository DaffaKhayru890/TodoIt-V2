import type { Clock } from '../../../../shared/domain/clock';
import { Todo } from '../../domain/entities/todo';
import { isTodoPriority, type TodoPriority } from '../../domain/enums/todo-priority';
import { TodoError } from '../../domain/errors/todo-error';
import type { TodoRepository } from '../../domain/repositories/todo.repository';
import { toTodoDto, type TodoDto } from '../dto/todo.dto';
import { TodoAction } from '../policies/todo-access.policy';
import type { TodoAccessService } from '../services/todo-access.service';

export interface CreateTodoInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly title: string;
  readonly description?: string | null | undefined;
  readonly priority?: string | undefined;
  readonly dueAt?: Date | null | undefined;
}

export class CreateTodo {
  constructor(
    private readonly todos: TodoRepository,
    private readonly access: TodoAccessService,
    private readonly clock: Clock
  ) {}

  async execute(input: CreateTodoInput): Promise<TodoDto> {
    await this.access.assertAccess(input.workspaceId, input.userId, TodoAction.CREATE);

    let priority: TodoPriority | undefined;

    if (input.priority !== undefined) {
      if (!isTodoPriority(input.priority)) {
        throw TodoError.invalidPriority();
      }

      priority = input.priority;
    }

    const todo = Todo.create({
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      title: input.title,
      description: input.description ?? null,
      ...(priority !== undefined ? { priority } : {}),
      dueAt: input.dueAt ?? null,
      createdBy: input.userId,
      now: this.clock.now()
    });

    const created = await this.todos.create(todo);

    return toTodoDto(created);
  }
}
