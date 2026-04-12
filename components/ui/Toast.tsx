"use client";

import { useEffect } from "react";

type Props = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
  duration?: number;
};

export default function Toast({
  message,
  actionLabel,
  onAction,
  onClose,
  duration = 5000,
}: Props) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex items-center gap-3 rounded-xl bg-zinc-900 text-white shadow-xl px-4 py-3 text-sm max-w-sm animate-in">
      <span className="flex-1">{message}</span>
      {actionLabel && onAction && (
        <button
          onClick={() => { onAction(); onClose(); }}
          className="flex-shrink-0 font-medium text-blue-400 hover:text-blue-300 transition-colors whitespace-nowrap"
        >
          {actionLabel}
        </button>
      )}
      <button
        onClick={onClose}
        className="flex-shrink-0 text-zinc-400 hover:text-white transition-colors"
        aria-label="Закрыть"
      >
        ✕
      </button>
    </div>
  );
}
