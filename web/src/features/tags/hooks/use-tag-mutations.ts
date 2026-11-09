import { useMutation, useQueryClient } from '@tanstack/react-query';
import { todoKeys } from '@/features/todos/api/todo.query-keys';
import { invalidateTodoCachesForWorkspace } from '@/features/todos/utils/invalidate-todo-cache';
import { tagApi } from '../api/tag.api';
import { tagKeys } from '../api/tag.query-keys';
import type { CreateTagInput, Tag, UpdateTagInput } from '../models/tag.model';

export interface CreateTagVariables {
  readonly workspaceId: string;
  readonly input: CreateTagInput;
}

export interface UpdateTagVariables {
  readonly workspaceId: string;
  readonly tagId: string;
  readonly input: UpdateTagInput;
}

export interface DeleteTagVariables {
  readonly workspaceId: string;
  readonly tagId: string;
}

export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation<Tag, Error, CreateTagVariables>({
    mutationFn: ({ workspaceId, input }) => tagApi.create(workspaceId, input),
    onSuccess: (_tag, { workspaceId }) => {
      void queryClient.invalidateQueries({ queryKey: tagKeys.workspaceLists(workspaceId) });
    }
  });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();

  return useMutation<Tag, Error, UpdateTagVariables>({
    mutationFn: ({ workspaceId, tagId, input }) => tagApi.update(workspaceId, tagId, input),
    onSuccess: (_tag, { workspaceId, tagId }) => {
      void queryClient.invalidateQueries({ queryKey: tagKeys.workspaceLists(workspaceId) });
      void queryClient.invalidateQueries({ queryKey: tagKeys.detail(workspaceId, tagId) });
      invalidateTodoCachesForWorkspace(queryClient, workspaceId);
    }
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, DeleteTagVariables>({
    mutationFn: ({ workspaceId, tagId }) => tagApi.remove(workspaceId, tagId),
    onSuccess: (_result, { workspaceId, tagId }) => {
      queryClient.removeQueries({ queryKey: tagKeys.detail(workspaceId, tagId) });
      void queryClient.invalidateQueries({ queryKey: tagKeys.workspaceLists(workspaceId) });
      invalidateTodoCachesForWorkspace(queryClient, workspaceId);
    }
  });
}

export interface ReplaceTodoTagsVariables {
  readonly workspaceId: string;
  readonly todoId: string;
  readonly tagIds: readonly string[];
}

export function useReplaceTodoTags() {
  const queryClient = useQueryClient();

  return useMutation<readonly { id: string; name: string }[], Error, ReplaceTodoTagsVariables>({
    mutationFn: ({ workspaceId, todoId, tagIds }) =>
      tagApi.replaceTodoTags(workspaceId, todoId, tagIds).then((tags) => [...tags]),
    onSuccess: (_tags, { workspaceId, todoId }) => {
      void queryClient.invalidateQueries({ queryKey: todoKeys.detail(workspaceId, todoId) });
      void queryClient.invalidateQueries({ queryKey: todoKeys.workspaceLists(workspaceId) });
    }
  });
}
