import { todoFieldsSchema, type TodoFormValues } from './todo-fields.schema';

export const updateTodoSchema = todoFieldsSchema;

export type UpdateTodoFormValues = TodoFormValues;
