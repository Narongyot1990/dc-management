import { Search } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ringColor?: string;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = '',
  ringColor = 'focus:ring-amber-500',
  className = '',
}: SearchInputProps) {
  return (
    <div className={`relative flex-1 ${className}`}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full pl-8 pr-2 py-1.5 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:ring-2 ${ringColor}`}
      />
    </div>
  );
}
