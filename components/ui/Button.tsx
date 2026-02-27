import type { ReactNode, ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'success' | 'outline' | 'danger';

const variantStyles: Record<Variant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300',
  success: 'bg-green-600 text-white hover:bg-green-700 disabled:bg-green-300',
  outline: 'border-2 border-gray-200 text-gray-600 hover:bg-gray-50',
  danger: 'border border-red-200 text-red-500 hover:bg-red-50',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  compact?: boolean;
  children: ReactNode;
}

export default function Button({
  variant = 'primary', compact, children, className = '', ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={`font-medium flex items-center justify-center gap-2 transition-colors ${
        compact ? 'py-2 px-3 rounded-lg text-xs' : 'py-2.5 px-4 rounded-xl'
      } ${variantStyles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
