import React, { useEffect } from 'react';
import { ToastMessage } from '../types';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const typeConfig = {
    success: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-500/30 text-emerald-800 dark:text-emerald-200',
      icon: 'check_circle',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    error: {
      bg: 'bg-red-50 dark:bg-red-950/90 border-red-500/30 text-red-800 dark:text-red-200',
      icon: 'error',
      iconColor: 'text-red-600 dark:text-red-400',
    },
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-950/90 border-amber-500/30 text-amber-800 dark:text-amber-200',
      icon: 'warning',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
    info: {
      bg: 'bg-blue-50 dark:bg-blue-950/90 border-blue-500/30 text-blue-800 dark:text-blue-200',
      icon: 'info',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
  }[toast.type];

  return (
    <div
      role="alert"
      className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-300 animate-slideUp ${typeConfig.bg}`}
    >
      <span className={`material-symbols-outlined text-[20px] flex-shrink-0 ${typeConfig.iconColor}`}>
        {typeConfig.icon}
      </span>
      <div className="flex-1 text-left">
        {toast.title && <h5 className="text-xs font-bold leading-tight">{toast.title}</h5>}
        <p className="text-xs mt-0.5 opacity-90">{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Close notification"
        className="text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 transition-colors p-1"
      >
        <span className="material-symbols-outlined text-[16px]">close</span>
      </button>
    </div>
  );
};
