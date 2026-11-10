import { createContext } from 'react';
import type { ToastInput } from './toast.model';

export interface ToastContextValue {
  showToast(input: ToastInput): void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);
