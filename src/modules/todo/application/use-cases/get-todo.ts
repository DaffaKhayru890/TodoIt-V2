import { TodoError } from '../../domain/errors/todo-error';
import type { TodoRepository } from '../../domain/repositories/todo.repository';
import { toTodoDto, type TodoDto } from '../dto/todo.dto';
import { TodoAction } from '../policies/todo-access.policy';
import type { TodoMetadataService } from '../services/todo-metadata.service';
import type { TodoAccessService } from '../services/todo-access.service';

export interface GetTodoInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly todoId: string;
}

export class GetTodo {
  constructor(
    private readonly todos: TodoRepository,
    private readonly access: TodoAccessService,
    private readonly metadata: TodoMetadataService
  ) {}

  async execute(input: GetTodoInput): Promise<TodoDto> {
    await this.access.assertAccess(input.workspaceId, input.userId, TodoAction.VIEW);

    const todo = await this.todos.findActiveById(input.workspaceId, input.todoId);

    if (!todo) {
      throw TodoError.notFound();
    }

    const relations = await this.metadata.loadOne(input.workspaceId, todo);

    return toTodoDto(todo, relations);
  }
}
