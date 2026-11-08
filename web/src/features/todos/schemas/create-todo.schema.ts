import { todoFieldsSchema, type TodoFormValues } from './todo-fields.schema';

export const createTodoSchema = todoFieldsSchema;

export type CreateTodoFormValues = TodoFormValues;
export type { TodoFormValues };
