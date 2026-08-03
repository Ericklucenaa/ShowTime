import React from 'react';
import { onToast, type ToastMessage } from '../services/toast.js';

export const ToastHost: React.FC = () => {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  React.useEffect(() => {
    const unsubscribe = onToast((toast) => {
      setToasts((prev) => [...prev, toast]);

      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, toast.durationMs || 2800);
    });

    return unsubscribe;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-host">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-item toast-${toast.type}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
};
