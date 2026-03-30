'use client';

import { useRef, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '../utils';

interface ConfirmDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  loading?: boolean;
}

const VARIANT_STYLES = {
  danger: {
    icon: 'text-red-500 bg-red-50',
    button: 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-500',
  },
  warning: {
    icon: 'text-amber-500 bg-amber-50',
    button: 'bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500',
  },
  default: {
    icon: 'text-primary-500 bg-primary-50',
    button: 'bg-primary-600 hover:bg-primary-700 focus-visible:ring-primary-500',
  },
};

export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title = 'Confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading = false,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const styles = VARIANT_STYLES[variant];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
      className="m-auto max-w-sm rounded-lg bg-white p-0 shadow-xl backdrop:bg-black/50"
    >
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className={cn('rounded-full p-2', styles.icon)}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 id="confirm-dialog-title" className="text-base font-semibold text-gray-900">{title}</h3>
            <p id="confirm-dialog-message" className="mt-1 text-sm text-gray-600">{message}</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50 px-6 py-3">
        <button
          onClick={onCancel}
          disabled={loading}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={cn(
            'rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50',
            styles.button,
          )}
        >
          {loading ? 'Processing...' : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
