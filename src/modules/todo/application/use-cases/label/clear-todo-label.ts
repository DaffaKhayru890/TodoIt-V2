import type { TodoDto } from '../../dto/todo.dto';
import type { UpdateTodo } from '../update-todo';

export interface ClearTodoLabelInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly todoId: string;
}

export class ClearTodoLabel {
  constructor(private readonly updateTodo: UpdateTodo) {}

  async execute(input: ClearTodoLabelInput): Promise<TodoDto> {
    return await this.updateTodo.execute({
      workspaceId: input.workspaceId,
      userId: input.userId,
      todoId: input.todoId,
      labelId: null
    });
  }
}
