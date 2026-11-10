export interface ToastInput {
  readonly title: string;
  readonly description?: string;
  readonly tone?: 'info' | 'success' | 'warning' | 'danger';
}

export interface ToastMessage extends ToastInput {
  readonly id: string;
}
