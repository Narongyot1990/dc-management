import type { ReactNode } from 'react';

interface EmptyStateProps {
  message: string;
  icon?: ReactNode;
}

export function EmptyState({ message, icon }: EmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-xs gap-2 py-8">
      {icon}
      <span>{message}</span>
    </div>
  );
}
