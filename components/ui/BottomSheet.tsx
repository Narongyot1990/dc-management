import type { ReactNode } from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: string;
  children: ReactNode;
  cancelLabel?: string;
}

export function BottomSheet({ isOpen, onClose, title, subtitle, children, cancelLabel = 'Cancel' }: BottomSheetProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose}>
      <div
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        {(title || subtitle) && (
          <div className="px-4 pb-2 border-b border-gray-100">
            {title && (typeof title === 'string' ? (
              <p className="font-mono text-sm font-medium text-gray-900">{title}</p>
            ) : title)}
            {subtitle && <p className="text-[10px] text-gray-400">{subtitle}</p>}
          </div>
        )}

        {/* Content */}
        <div className="p-2 space-y-0.5">
          {children}
        </div>

        {/* Cancel */}
        <div className="p-2 pt-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-600 transition-colors"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
