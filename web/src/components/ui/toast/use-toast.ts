import { useContext } from 'react';
import { ToastContext, type ToastContextValue } from './toast-context';

const fallback: ToastContextValue = {
  showToast: () => undefined
};

export function useToast(): ToastContextValue {
  return useContext(ToastContext) ?? fallback;
}
