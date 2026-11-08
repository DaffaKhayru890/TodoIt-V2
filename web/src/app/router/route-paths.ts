export const paths = {
  inbox: '/inbox',
  search: '/search',
  settings: '/settings',
  login: '/login',
  register: '/register',
  newWorkspace: '/workspaces/new',
  workspace: (workspaceId: string) => `/workspace/${workspaceId}`,
  todo: (workspaceId: string, todoId: string) => `/workspace/${workspaceId}/todos/${todoId}`,
  today: (workspaceId: string) => `/workspace/${workspaceId}/today`,
  upcoming: (workspaceId: string) => `/workspace/${workspaceId}/upcoming`,
  completed: (workspaceId: string) => `/workspace/${workspaceId}/completed`,
  tags: (workspaceId: string) => `/workspace/${workspaceId}/tags`,
  labels: (workspaceId: string) => `/workspace/${workspaceId}/labels`
} as const;
