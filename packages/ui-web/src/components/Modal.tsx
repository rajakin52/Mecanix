'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '../utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className={cn(
        'w-full max-w-lg rounded-lg p-0 shadow-xl backdrop:bg-black/50',
        className,
      )}
    >
      <div className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="modal-title" className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
