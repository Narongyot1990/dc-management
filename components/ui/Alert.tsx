import type { ReactNode } from 'react';

type AlertVariant = 'error' | 'success';

const styles: Record<AlertVariant, string> = {
  error: 'bg-red-50 border-red-200 text-red-700',
  success: 'bg-green-50 border-green-200 text-green-700',
};

const icons: Record<AlertVariant, string> = {
  error: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  success: 'M5 13l4 4L19 7',
};

export default function Alert({ variant = 'error', children }: { variant?: AlertVariant; children: ReactNode }) {
  return (
    <div className={`border rounded-xl p-3 flex items-center gap-2 text-sm ${styles[variant]}`}>
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icons[variant]} />
      </svg>
      <span>{children}</span>
    </div>
  );
}
