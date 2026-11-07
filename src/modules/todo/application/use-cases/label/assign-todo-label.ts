import type { TodoDto } from '../../dto/todo.dto';
import type { UpdateTodo } from '../update-todo';

export interface AssignTodoLabelInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly todoId: string;
  readonly labelId: string;
}

/**
 * Penugasan Label memakai jalur UpdateTodo yang sama agar validasi workspace,
 * locking, dan bentuk response konsisten dengan PATCH Todo.
 */
export class AssignTodoLabel {
  constructor(private readonly updateTodo: UpdateTodo) {}

  async execute(input: AssignTodoLabelInput): Promise<TodoDto> {
    return await this.updateTodo.execute({
      workspaceId: input.workspaceId,
      userId: input.userId,
      todoId: input.todoId,
      labelId: input.labelId
    });
  }
}
