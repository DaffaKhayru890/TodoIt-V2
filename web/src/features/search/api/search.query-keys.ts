export interface SearchQueryScope {
  readonly query: string;
  readonly workspaceIds: readonly string[];
}

export const searchKeys = {
  all: ['search'] as const,
  results: (scope: SearchQueryScope) => [...searchKeys.all, 'results', scope] as const,
  workspaces: () => [...searchKeys.all, 'workspaces'] as const
};
